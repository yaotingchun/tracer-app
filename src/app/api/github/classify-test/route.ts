// GET /api/github/classify-test?repoId=<id>&limit=6
//
// Runs classification against real cached commit data and returns structured
// results showing department + module + per-file classification method.
// Use this to verify the classification logic against your repo BEFORE the
// toggle UI is wired up.
//
// Works on commits already cached in commitFiles/{sha}.
// For any commit without a cache entry it classifies from commit message only
// and flags data_source as "message_only".

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { classifyCommit, type FileClassification } from '@/lib/classify';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase-admin/firestore';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT     = 10;

interface TestResult {
  sha:          string;
  short_sha:    string;
  message:      string;
  author:       string;
  date:         string;
  data_source:  'commitFiles_cache' | 'message_only';
  department:   string[];
  module:       string[];
  module_classification_method: string[];
  file_results: Array<{
    filename:      string;
    department:    string;
    module:        string;
    module_method: string;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    const repoId = req.nextUrl.searchParams.get('repoId');
    const n      = Math.min(
      parseInt(req.nextUrl.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10),
      MAX_LIMIT
    );

    if (!repoId) {
      return NextResponse.json(
        { error: 'Missing ?repoId= query param' },
        { status: 400 }
      );
    }

    // ── 1. Pull recent commits for this repo ────────────────────────────────
    // Use single-field filter to avoid requiring a composite index,
    // then sort in memory.
    const commitsSnap = await adminDb
      .collection('commits')
      .where('repoId', '==', repoId)
      .get();

    if (commitsSnap.empty) {
      return NextResponse.json(
        { error: 'No commits found for this repoId. Sync the repo first.' },
        { status: 404 }
      );
    }

    // Sort by date desc in-memory, take top n*3 to fill n slots after cache check
    const allCommitDocs = (commitsSnap.docs as QueryDocumentSnapshot<DocumentData>[])
      .sort((a, b) => {
        const da = a.data().date ?? '';
        const db_ = b.data().date ?? '';
        return da < db_ ? 1 : da > db_ ? -1 : 0;
      })
      .slice(0, n * 3);

    // ── 2. For each commit, use cached file data if available ───────────────
    const results: TestResult[] = [];

    for (const commitDoc of allCommitDocs) {
      if (results.length >= n) break;
      const c = commitDoc.data();
      const sha: string = c.sha ?? commitDoc.id;

      // Check commitFiles cache
      const cacheSnap = await adminDb.collection('commitFiles').doc(sha).get();

      if (cacheSnap.exists) {
        // ── Full classification from cached file content ──────────────────
        const cached = cacheSnap.data() as {
          changed_files?: Array<{
            filename:      string;
            content_after: string;
            patch?:        string;
          }>;
          message?: string;
        };

        const files  = cached.changed_files ?? [];
        const msg    = cached.message ?? c.message ?? '';
        const classification = classifyCommit(
          files.map(f => ({
            filename:      f.filename,
            content_after: f.content_after,
            patch:         f.patch,
          })),
          msg
        );

        results.push({
          sha,
          short_sha:   sha.slice(0, 7),
          message:     (msg).split('\n')[0].slice(0, 80),
          author:      c.author ?? 'unknown',
          date:        c.date   ?? '',
          data_source: 'commitFiles_cache',
          department:  classification.department,
          module:      classification.module,
          module_classification_method: classification.module_classification_method,
          file_results: classification.file_classifications.map(
            (fc: FileClassification) => ({
              filename:      fc.filename,
              department:    fc.department,
              module:        fc.module,
              module_method: fc.module_method,
            })
          ),
        });
      } else {
        // ── Message-only fallback — no file content available yet ─────────
        const msg: string = c.message ?? '';
        const classification = classifyCommit([], msg);

        results.push({
          sha,
          short_sha:   sha.slice(0, 7),
          message:     msg.split('\n')[0].slice(0, 80),
          author:      c.author ?? 'unknown',
          date:        c.date   ?? '',
          data_source: 'message_only',
          department:  classification.department,
          module:      classification.module,
          module_classification_method: classification.module_classification_method,
          file_results: [],
        });
      }
    }

    // ── 3. Summary stats ────────────────────────────────────────────────────
    const totalCached    = results.filter(r => r.data_source === 'commitFiles_cache').length;
    const totalMsgOnly   = results.filter(r => r.data_source === 'message_only').length;

    const allMethods     = results.flatMap(r => r.module_classification_method);
    const methodCounts   = allMethods.reduce<Record<string, number>>((acc, m) => {
      acc[m] = (acc[m] ?? 0) + 1;
      return acc;
    }, {});

    const allModules     = Array.from(new Set(results.flatMap(r => r.module)));
    const allDepartments = Array.from(new Set(results.flatMap(r => r.department)));

    return NextResponse.json({
      repoId,
      tested_commits: results.length,
      with_file_content: totalCached,
      message_only:      totalMsgOnly,
      unique_departments: allDepartments,
      unique_modules:     allModules,
      method_breakdown:   methodCounts,
      note: totalMsgOnly > 0
        ? `${totalMsgOnly} commit(s) had no cached file content — open their detail page first to trigger file fetching, then re-run this test for full accuracy.`
        : 'All tested commits had full file content — classification is fully accurate.',
      results,
    });

  } catch (err) {
    console.error('[GET /api/github/classify-test]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
