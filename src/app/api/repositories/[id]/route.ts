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

    await adminDb.collection('repositories').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/repositories/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete repository' }, { status: 500 });
  }
}
