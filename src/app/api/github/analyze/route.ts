// POST /api/github/analyze  — run the 4-agent insight pipeline for a commit
// GET  /api/github/analyze?sha=  — retrieve cached insight only
//
// The POST handler is self-contained: if commit files aren't yet cached, it
// fetches them first (so this can be triggered from the commit list page
// without needing the detail page to have been visited).

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { runInsightPipeline, type AgentInput } from '@/lib/aiInsight';
import { FieldValue } from 'firebase-admin/firestore';
import {
  fetchCommitDetail,
  fetchFileContent,
  isRelevantFile,
} from '@/lib/github';
import { classifyCommit } from '@/lib/classify';

const MAX_FILES = 40;

// ── GET — read cached insight ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sha = req.nextUrl.searchParams.get('sha');
  if (!sha) {
    return NextResponse.json({ error: 'Missing ?sha= param' }, { status: 400 });
  }

  const doc = await adminDb.collection('commitInsights').doc(sha).get();
  if (!doc.exists) {
    return NextResponse.json({ error: 'not_cached' }, { status: 404 });
  }

  return NextResponse.json(doc.data());
}

// ── POST — run pipeline ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { sha, repoId } = await req.json() as { sha?: string; repoId?: string };

    if (!sha || !repoId) {
      return NextResponse.json({ error: 'Missing sha or repoId' }, { status: 400 });
    }

    // ── 1. Return cached insight if it already exists ────────────────────────
    const insightRef = adminDb.collection('commitInsights').doc(sha);
    const cached = await insightRef.get();
    if (cached.exists) {
      console.log(`[analyze] Returning cached insight for ${sha}`);
      return NextResponse.json(cached.data());
    }

    // ── 2. Load repo record ──────────────────────────────────────────────────
    const repoSnap = await adminDb.collection('repositories').doc(repoId).get();
    if (!repoSnap.exists) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }
    const repoData = repoSnap.data() as {
      fullName: string; token: string; owner: string;
    };
    const [owner, repoName] = repoData.fullName.split('/');
    const token = repoData.token;

    // ── 3. Get commit files (from cache or fresh fetch) ──────────────────────
    let commitFilesData: Record<string, unknown> | null = null;

    const filesRef = adminDb.collection('commitFiles').doc(sha);
    const filesCached = await filesRef.get();

    if (filesCached.exists) {
      commitFilesData = filesCached.data() as Record<string, unknown>;
      console.log(`[analyze] Using cached commit files for ${sha}`);
    } else {
      // Fetch from GitHub (self-contained, same logic as commit-files route)
      console.log(`[analyze] Fetching commit files from GitHub for ${sha}`);
      const detail = await fetchCommitDetail(owner, repoName, sha, token);
      if (!detail) {
        return NextResponse.json({ error: 'Could not fetch commit from GitHub' }, { status: 502 });
      }

      const parentSha = detail.parents[0]?.sha ?? null;
      const allFiles  = detail.files ?? [];
      const relevant  = allFiles.filter(f => isRelevantFile(f.filename)).slice(0, MAX_FILES);

      const changedFiles = await Promise.all(
        relevant.map(async f => {
          const [after, before] = await Promise.all([
            f.status === 'removed' ? null : fetchFileContent(owner, repoName, f.filename, sha, token),
            f.status === 'added' || !parentSha ? null : fetchFileContent(owner, repoName, f.filename, parentSha, token),
          ]);
          return {
            filename: f.filename,
            status: f.status,
            content_before: before ?? '',
            content_after:  after  ?? '',
            patch: f.patch ?? '',
          };
        })
      );

      const classification = classifyCommit(
        changedFiles.map(f => ({ filename: f.filename, content_after: f.content_after, patch: f.patch })),
        detail.commit.message
      );

      commitFilesData = {
        sha, owner, repo: repoName, repoId, parentSha,
        message: detail.commit.message,
        author:  detail.commit.author.name,
        date:    detail.commit.author.date,
        total_files_changed: allFiles.length,
        relevant_files_count: relevant.length,
        changed_files: changedFiles,
        ...classification,
        fetchedAt: new Date().toISOString(),
      };

      // Persist for future use
      filesRef.set({ ...commitFilesData, fetchedAt: FieldValue.serverTimestamp() }).catch(() => {});
      adminDb.collection('commits').doc(sha).set({
        department: classification.department,
        module:     classification.module,
        module_classification_method: classification.module_classification_method,
        classifiedAt: FieldValue.serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }

    // ── 4. Build agent input ─────────────────────────────────────────────────
    const changedFiles = (commitFilesData.changed_files as Array<{
      filename: string; status: string; patch?: string;
    }>) ?? [];

    const agentInput: AgentInput = {
      sha,
      message:      String(commitFilesData.message ?? ''),
      author:       String(commitFilesData.author  ?? ''),
      changedFiles: changedFiles.map(f => ({
        filename: f.filename,
        status:   f.status,
        patch:    f.patch,
      })),
      department:    commitFilesData.department as string[] | undefined,
      module:        commitFilesData.module     as string[] | undefined,
      repoFullName:  repoData.fullName,
    };

    // ── 5. Run the pipeline ──────────────────────────────────────────────────
    console.log(`[analyze] Running 4-agent pipeline for ${sha}…`);
    const insight = await runInsightPipeline(agentInput);

    // ── 6. Persist full insight to commitInsights/{sha} ──────────────────────
    insightRef.set({ ...insight, generatedAt: FieldValue.serverTimestamp() }).catch(() => {});

    // ── 7. Write summary back to commits/{sha} (real-time listener picks it up)
    adminDb.collection('commits').doc(sha).set({
      aiRiskLevel:    insight.riskLevel,
      aiSummaryLine1: insight.summaryLine1,
      aiSummaryLine2: insight.summaryLine2,
      aiGeneratedAt:  FieldValue.serverTimestamp(),
    }, { merge: true }).catch(() => {});

    console.log(`[analyze] Done for ${sha}: riskLevel=${insight.riskLevel}`);
    return NextResponse.json({ ...insight, generatedAt: new Date().toISOString() });

  } catch (err) {
    console.error('[analyze] Pipeline error:', err);
    return NextResponse.json({ error: 'Insight pipeline failed', detail: String(err) }, { status: 500 });
  }
}
