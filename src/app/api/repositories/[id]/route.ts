// GET /api/repositories/[id] - fetch details for a single repository
// PUT /api/repositories/[id] - update repository settings
// DELETE /api/repositories/[id] - remove repository
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const doc = await adminDb.collection('repositories').doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
    }

    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('[GET /api/repositories/[id]]', err);
    return NextResponse.json({ error: 'Failed to fetch repository' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json();
    const { customModules, businessDescription, pdfFilename, documentationText } = body;

    const updateData: Record<string, any> = {};
    if (customModules !== undefined) updateData.customModules = customModules;
    if (businessDescription !== undefined) updateData.businessDescription = businessDescription;
    if (pdfFilename !== undefined) updateData.pdfFilename = pdfFilename;
    if (documentationText !== undefined) updateData.documentationText = documentationText;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await adminDb.collection('repositories').doc(id).update(updateData);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/repositories/[id]]', err);
    return NextResponse.json({ error: 'Failed to update repository' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    console.log(`[DELETE /api/repositories/${id}] Starting repository and data cleanup`);

    // ── 1. Query all commits belonging to this repository ────────────────────
    const commitsSnap = await adminDb
      .collection('commits')
      .where('repoId', '==', id)
      .get();

    const commitDocs = commitsSnap.docs;
    console.log(`[DELETE /api/repositories/${id}] Found ${commitDocs.length} commits to clean up`);

    // ── 2. Batch delete commits, commitFiles caches, and commitInsights ─────
    // Firestore batch limit is 500 operations. We'll commit in chunks of 150 commits
    // (since each commit has up to 3 deletions: commits, commitFiles, commitInsights).
    const chunkSize = 150;
    for (let i = 0; i < commitDocs.length; i += chunkSize) {
      const chunk = commitDocs.slice(i, i + chunkSize);
      const batch = adminDb.batch();

      for (const doc of chunk) {
        const sha = doc.id;
        // Delete commit doc
        batch.delete(adminDb.collection('commits').doc(sha));
        // Delete commitFiles cache doc
        batch.delete(adminDb.collection('commitFiles').doc(sha));
        // Delete commitInsights cache doc
        batch.delete(adminDb.collection('commitInsights').doc(sha));
      }

      await batch.commit();
      console.log(`[DELETE /api/repositories/${id}] Deleted batch of ${chunk.length} commits`);
    }

    // ── 3. Delete the repository document itself ─────────────────────────────
    await adminDb.collection('repositories').doc(id).delete();
    console.log(`[DELETE /api/repositories/${id}] Repository document deleted successfully`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/repositories/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete repository and associated data' }, { status: 500 });
  }
}
