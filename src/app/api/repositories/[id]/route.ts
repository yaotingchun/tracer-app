// DELETE /api/repositories/[id]
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

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
