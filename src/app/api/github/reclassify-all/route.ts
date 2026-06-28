// POST /api/github/reclassify-all
//
// One-shot endpoint: iterates every document in the `commitFiles` collection,
// runs classifyCommit on the cached file content, and batch-writes
// { department, module, module_classification_method, classifiedAt }
// back to the matching `commits/{sha}` document.
//
// Safe to call multiple times — uses merge:true so nothing else is overwritten.
// Returns a summary of how many commits were processed.

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { classifyCommit } from '@/lib/classify';
import { FieldValue } from 'firebase-admin/firestore';

const BATCH_SIZE = 400; // Firestore max is 500

export async function POST() {
  try {
    const snap = await adminDb.collection('commitFiles').get();

    if (snap.empty) {
      return NextResponse.json({
        message: 'No cached commitFiles found. Open some commit detail pages first.',
        processed: 0,
      });
    }

    let processed = 0;
    let skipped   = 0;
    const errors:  string[] = [];

    // Process in Firestore batch chunks
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const chunk = docs.slice(i, i + BATCH_SIZE);
      const batch = adminDb.batch();

      for (const doc of chunk) {
        const data = doc.data() as {
          sha?:           string;
          message?:       string;
          changed_files?: Array<{
            filename:      string;
            content_after?: string;
            patch?:         string;
          }>;
        };

        const sha     = data.sha ?? doc.id;
        const message = data.message ?? '';
        const files   = data.changed_files ?? [];

        if (files.length === 0 && !message) {
          skipped++;
          continue;
        }

        try {
          const classification = classifyCommit(
            files.map(f => ({
              filename:      f.filename,
              content_after: f.content_after,
              patch:         f.patch,
            })),
            message
          );

          const commitRef = adminDb.collection('commits').doc(sha);
          batch.set(commitRef, {
            department:                   classification.department,
            module:                       classification.module,
            module_classification_method: classification.module_classification_method,
            classifiedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          processed++;
        } catch (e) {
          errors.push(`${sha}: ${String(e)}`);
        }
      }

      await batch.commit();
    }

    return NextResponse.json({
      message:   `Reclassification complete.`,
      processed,
      skipped,
      errors:    errors.length > 0 ? errors.slice(0, 10) : undefined,
      total_cached_files: docs.length,
    });

  } catch (err) {
    console.error('[POST /api/github/reclassify-all]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET — just a status check / dry-run count
export async function GET() {
  try {
    const snap = await adminDb.collection('commitFiles').get();
    return NextResponse.json({
      cached_commit_files: snap.size,
      instructions: 'POST to this endpoint to reclassify all cached commits. Existing department/module fields will be overwritten.',
    });
  } catch (err) {
    console.error('[GET /api/github/reclassify-all]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
