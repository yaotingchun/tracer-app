import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing repository ID' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Dynamic require to prevent compilation issues with TS/Webpack
    const pdf = require('pdf-parse');
    const pdfData = await pdf(buffer);
    const text = pdfData.text || '';

    // Update repository document with the extracted text and filename
    await adminDb.collection('repositories').doc(id).update({
      pdfFilename: file.name,
      documentationText: text,
    });

    return NextResponse.json({ ok: true, filename: file.name, textLength: text.length });
  } catch (err: any) {
    console.error('[POST /api/repositories/[id]/upload-pdf]', err);
    return NextResponse.json({ error: err.message || 'Failed to extract text from PDF' }, { status: 500 });
  }
}
