// POST /api/github/fetch
// Fetches commits, PRs, branches, contributors from GitHub and upserts to Firestore
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import {
  fetchCommits,
  fetchPullRequests,
  fetchBranches,
  fetchContributors,
} from '@/lib/github';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { repoId, owner, repo, token } = await req.json();

    if (!repoId || !owner || !repo || !token) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all in parallel
    const [commits, prs, branches, contributors] = await Promise.all([
      fetchCommits(owner, repo, token),
      fetchPullRequests(owner, repo, token),
      fetchBranches(owner, repo, token),
      fetchContributors(owner, repo, token),
    ]);

    const batch = adminDb.batch();

    // Store commits
    for (const c of commits) {
      const ref = adminDb.collection('commits').doc(c.sha);
      batch.set(ref, {
        repoId,
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        author: c.commit.author.name,
        authorEmail: c.commit.author.email,
        authorAvatar: c.author?.avatar_url ?? null,
        authorLogin: c.author?.login ?? null,
        date: c.commit.author.date,
        url: c.html_url,
        fetchedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Store PRs
    for (const pr of prs) {
      const ref = adminDb.collection('pullRequests').doc(`${repoId}_${pr.number}`);
      batch.set(ref, {
        repoId,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user.login,
        authorAvatar: pr.user.avatar_url,
        headBranch: pr.head.ref,
        baseBranch: pr.base.ref,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        url: pr.html_url,
        fetchedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Update repo document with branch list and contributor count
    const repoRef = adminDb.collection('repositories').doc(repoId);
    batch.update(repoRef, {
      branches: branches.map((b) => b.name),
      contributors: contributors.slice(0, 20).map((c) => ({
        login: c.login,
        avatar: c.avatar_url,
        contributions: c.contributions,
      })),
      commitCount: commits.length,
      lastSyncedAt: FieldValue.serverTimestamp(),
      status: 'synced',
    });

    await batch.commit();

    return NextResponse.json({
      ok: true,
      synced: {
        commits: commits.length,
        pullRequests: prs.length,
        branches: branches.length,
        contributors: contributors.length,
      },
    });
  } catch (err) {
    console.error('[fetch]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
