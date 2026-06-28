// GET  /api/repositories  — list all connected repos
// POST /api/repositories  — add a new repo
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const snap = await adminDb
      .collection('repositories')
      .orderBy('connectedAt', 'desc')
      .get();

    const repos = snap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ repositories: repos });
  } catch (err) {
    console.error('[GET /api/repositories]', err);
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url, token, name, fullName, owner, ownerAvatar,
      description, private: isPrivate, defaultBranch,
      stars, forks, language, htmlUrl,
    } = body;

    if (!url || !token || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check for duplicate
    const existing = await adminDb
      .collection('repositories')
      .where('fullName', '==', fullName)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json(
        { error: 'Repository already connected', repoId: existing.docs[0].id },
        { status: 409 }
      );
    }

    const repoRef = adminDb.collection('repositories').doc();
    await repoRef.set({
      url,
      token,  // ⚠️ Store PAT — encrypt in production
      name,
      fullName,
      owner,
      ownerAvatar,
      description: description ?? null,
      private: isPrivate ?? false,
      defaultBranch: defaultBranch ?? 'main',
      stars: stars ?? 0,
      forks: forks ?? 0,
      language: language ?? null,
      htmlUrl,
      status: 'connected',
      commitCount: 0,
      branches: [],
      contributors: [],
      connectedAt: FieldValue.serverTimestamp(),
      lastSyncedAt: null,
    });

    return NextResponse.json({ ok: true, repoId: repoRef.id });
  } catch (err) {
    console.error('[POST /api/repositories]', err);
    return NextResponse.json({ error: 'Failed to save repository' }, { status: 500 });
  }
}
