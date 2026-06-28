// POST /api/github/webhook
// Receives GitHub webhook events: push, pull_request, create, delete
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

interface CommitPayload {
  id: string;
  message: string;
  timestamp: string;
  url: string;
  author: {
    name?: string;
    email?: string;
    username?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const eventType = req.headers.get('x-github-event') ?? 'unknown';
    const delivery  = req.headers.get('x-github-delivery') ?? Date.now().toString();
    const payload   = await req.json();

    const repoFullName: string = payload.repository?.full_name ?? 'unknown';

    // Find repository in Firestore by full_name
    const reposSnap = await adminDb
      .collection('repositories')
      .where('fullName', '==', repoFullName)
      .limit(1)
      .get();

    const repoId = reposSnap.empty ? null : reposSnap.docs[0].id;

    // Store raw webhook event
    await adminDb.collection('webhookEvents').doc(delivery).set({
      repoId,
      repoFullName,
      type: eventType,
      delivery,
      payload,
      receivedAt: FieldValue.serverTimestamp(),
    });

    // ── Handle specific events ──────────────────────────────────────
    if (eventType === 'push' && repoId) {
      const commits: CommitPayload[] = payload.commits ?? [];
      const branch: string = (payload.ref as string).replace('refs/heads/', '');

      const batch = adminDb.batch();

      for (const c of commits) {
        const ref = adminDb.collection('commits').doc(c.id);
        batch.set(ref, {
          repoId,
          sha: c.id,
          shortSha: (c.id as string).slice(0, 7),
          message: c.message,
          author: c.author?.name ?? 'Unknown',
          authorEmail: c.author?.email ?? '',
          authorAvatar: null,
          authorLogin: c.author?.username ?? null,
          date: c.timestamp,
          url: c.url,
          branch,
          source: 'webhook',
          fetchedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      // Update repo last activity
      batch.update(adminDb.collection('repositories').doc(repoId), {
        lastPushAt: FieldValue.serverTimestamp(),
        lastBranch: branch,
      });

      // Trigger impact analysis pipeline (placeholder — extend here)
      batch.set(adminDb.collection('impactAnalysis').doc(delivery), {
        repoId,
        branch,
        commits: commits.map((c) => c.id),
        status: 'pending',
        triggeredAt: FieldValue.serverTimestamp(),
      });

      await batch.commit();
    }

    if (eventType === 'pull_request' && repoId) {
      const pr = payload.pull_request;
      if (pr) {
        await adminDb
          .collection('pullRequests')
          .doc(`${repoId}_${pr.number}`)
          .set({
            repoId,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            author: pr.user?.login ?? 'Unknown',
            authorAvatar: pr.user?.avatar_url ?? null,
            headBranch: pr.head?.ref ?? '',
            baseBranch: pr.base?.ref ?? '',
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            mergedAt: pr.merged_at,
            url: pr.html_url,
            source: 'webhook',
            fetchedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
      }
    }

    return NextResponse.json({ ok: true, event: eventType, delivery });
  } catch (err) {
    console.error('[webhook]', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// GitHub sends a ping on webhook setup
export async function GET() {
  return NextResponse.json({ ok: true, message: 'TRACER GitHub Webhook endpoint ready' });
}
