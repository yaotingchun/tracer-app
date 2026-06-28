// POST /api/github/commit-files
//
// Fetches the full before/after source content for every relevant file in a commit.
// Stores the result in Firestore at commitFiles/{sha} and returns it as JSON.
//
// Request body: { repoId: string; sha: string }
// Response:     { sha, owner, repo, parentSha, changed_files: ChangedFile[] }

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import {
  fetchCommitDetail,
  fetchFileContent,
  isRelevantFile,
  type ChangedFile,
} from '@/lib/github';
import { classifyCommit } from '@/lib/classify';
import { FieldValue } from 'firebase-admin/firestore';

// GitHub caps the files list at 300 entries per commit.
// We also self-cap to avoid blowing past secondary-rate-limits on content fetches.
const MAX_FILES_TO_FETCH = 40;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repoId, sha } = body as { repoId?: string; sha?: string };

    if (!repoId || !sha) {
      return NextResponse.json(
        { error: 'Missing required fields: repoId, sha' },
        { status: 400 }
      );
    }

    // ── 1. Load repo record (need owner, repo name, PAT) ──────────────────────
    const repoSnap = await adminDb.collection('repositories').doc(repoId).get();
    if (!repoSnap.exists) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }
    const repoData = repoSnap.data() as {
      fullName: string;
      token: string;
      owner: string;
    };

    const [owner, repoName] = repoData.fullName.split('/');
    const token = repoData.token;

    if (!owner || !repoName || !token) {
      return NextResponse.json({ error: 'Repository record is incomplete' }, { status: 500 });
    }

    // ── 2. Check Firestore cache — don't re-fetch if already stored ───────────
    const cacheRef = adminDb.collection('commitFiles').doc(sha);
    const cached = await cacheRef.get();
    if (cached.exists) {
      const cachedData = cached.data() as Record<string, unknown>;
      // If this cached entry pre-dates classification, back-fill it now
      if (!cachedData.department) {
        const files = (cachedData.changed_files as Array<{
          filename: string; content_after?: string; patch?: string;
        }> ?? []);
        const classification = classifyCommit(
          files.map(f => ({ filename: f.filename, content_after: f.content_after, patch: f.patch })),
          String(cachedData.message ?? '')
        );
        const classFields = {
          department:                   classification.department,
          module:                       classification.module,
          module_classification_method: classification.module_classification_method,
          file_classifications:         classification.file_classifications,
        };
        // Write back async — don't block the response
        cacheRef.update(classFields).catch(() => {});
        adminDb.collection('commits').doc(sha).set({
          ...classFields,
          classifiedAt: FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => {});
        return NextResponse.json({ ...cachedData, ...classFields });
      }
      return NextResponse.json(cachedData);
    }


    // ── 3. Fetch commit detail from GitHub ────────────────────────────────────
    const detail = await fetchCommitDetail(owner, repoName, sha, token);
    if (!detail) {
      return NextResponse.json(
        { error: `GitHub returned no detail for commit ${sha}` },
        { status: 502 }
      );
    }

    const parentSha: string | null = detail.parents[0]?.sha ?? null;
    const allFiles = detail.files ?? [];

    // ── 4. Filter to relevant files only ─────────────────────────────────────
    const relevantFiles = allFiles
      .filter((f) => isRelevantFile(f.filename))
      .slice(0, MAX_FILES_TO_FETCH);

    // ── 5. Fetch before/after content for each relevant file ─────────────────
    //
    // We fetch before and after in parallel per file, then collect.
    // "before" = parent SHA  (null for root commits or 'added' files)
    // "after"  = this SHA    (null for 'removed' files)
    const changed_files: ChangedFile[] = await Promise.all(
      relevantFiles.map(async (f): Promise<ChangedFile> => {
        const isAdded   = f.status === 'added';
        const isRemoved = f.status === 'removed';

        const [contentAfter, contentBefore] = await Promise.all([
          // After: fetch at this commit SHA unless the file was removed
          isRemoved
            ? Promise.resolve(null)
            : fetchFileContent(owner, repoName, f.filename, sha, token),

          // Before: fetch at parent SHA unless the file was newly added or there's no parent
          isAdded || !parentSha
            ? Promise.resolve(null)
            : fetchFileContent(owner, repoName, f.filename, parentSha, token),
        ]);

        return {
          filename:       f.filename,
          status:         f.status,
          content_before: contentBefore ?? '',
          content_after:  contentAfter  ?? '',
          patch:          f.patch ?? '',
        };
      })
    );

    // ── 6. Classify commit (department + module) — fully deterministic ─────────
    const classification = classifyCommit(
      changed_files.map(f => ({
        filename:       f.filename,
        content_after:  f.content_after,
        patch:          f.patch,
      })),
      detail.commit.message
    );

    // ── 7. Build result payload ───────────────────────────────────────────────
    const result = {
      sha,
      owner,
      repo:        repoName,
      repoId,
      parentSha,
      message:     detail.commit.message,
      author:      detail.commit.author.name,
      date:        detail.commit.author.date,
      total_files_changed: allFiles.length,
      relevant_files_count: relevantFiles.length,
      changed_files,
      // Classification fields
      department:                   classification.department,
      module:                       classification.module,
      module_classification_method: classification.module_classification_method,
      file_classifications:         classification.file_classifications,
      fetchedAt:   FieldValue.serverTimestamp(),
    };

    // ── 8. Persist to Firestore (async — don't block response) ───────────────
    // Write full detail to commitFiles/{sha}
    cacheRef.set(result).catch((err) =>
      console.error('[commit-files] commitFiles write failed:', err)
    );
    // Write classification back to commits/{sha} so the real-time feed can filter
    adminDb.collection('commits').doc(sha).set({
      department:                   classification.department,
      module:                       classification.module,
      module_classification_method: classification.module_classification_method,
      classifiedAt: FieldValue.serverTimestamp(),
    }, { merge: true }).catch((err) =>
      console.error('[commit-files] commits classification write failed:', err)
    );

    // Return without Firestore sentinels so it serialises cleanly
    return NextResponse.json({
      ...result,
      fetchedAt: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[POST /api/github/commit-files]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/github/commit-files?sha=<sha>  — retrieve cached result only
export async function GET(req: NextRequest) {
  const sha = req.nextUrl.searchParams.get('sha');
  if (!sha) {
    return NextResponse.json({ error: 'Missing ?sha= query param' }, { status: 400 });
  }
  const doc = await adminDb.collection('commitFiles').doc(sha).get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'Not cached — POST first' }, { status: 404 });
  }
  return NextResponse.json(doc.data());
}
