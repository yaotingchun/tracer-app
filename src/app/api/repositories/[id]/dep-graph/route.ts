// GET /api/repositories/[id]/dep-graph
//
// Builds a dependency graph for the repository using GitHub's REST API.
// No git clone, no filesystem checkout — everything goes through GitHub's API.
// Uses the same auth token already stored with the repo in Firestore.

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { buildDependencyGraph } from '@/lib/depGraph';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing repository id' }, { status: 400 });
    }

    // Load repo metadata (owner, name, token, branch) from Firestore
    const doc = await adminDb.collection('repositories').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    const data = doc.data()!;
    const { owner, fullName, token, defaultBranch } = data as {
      owner: string;
      fullName: string;
      token: string;
      defaultBranch: string;
    };

    if (!owner || !fullName || !token) {
      return NextResponse.json(
        { error: 'Repository is missing owner, name, or token' },
        { status: 422 }
      );
    }

    const repoPart = fullName.split('/')[1];
    const branch = defaultBranch || 'main';

    console.log(`[dep-graph] Starting dependency graph build for ${fullName} @ ${branch}`);

    const result = await buildDependencyGraph(owner, repoPart, branch, token);

    console.log(
      `[dep-graph] Done — ${result.stats.totalFiles} files, ` +
      `${result.stats.totalEdges} edges, ` +
      `${result.stats.externalImports} external imports, ` +
      `${result.stats.unresolvedImports} unresolved`
    );

    return NextResponse.json({
      ok: true,
      repoId: id,
      fullName,
      branch,
      ...result,
      cachedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[dep-graph] Unhandled error:', err);
    return NextResponse.json({ error: 'Failed to build dependency graph' }, { status: 500 });
  }
}
