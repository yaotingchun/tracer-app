// POST /api/github/webhook
// Receives GitHub webhook events: push, pull_request, create, delete
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  fetchCommitDetail,
  fetchFileContent,
  isRelevantFile,
} from '@/lib/github';
import { classifyCommit } from '@/lib/classify';
import { runInsightPipeline, type AgentInput } from '@/lib/aiInsight';

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

    const repoId   = reposSnap.empty ? null : reposSnap.docs[0].id;
    const repoData = reposSnap.empty ? null : reposSnap.docs[0].data() as { fullName: string; token: string };

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

      // ── Auto-analysis: run the 4-agent pipeline for each new commit (fire-and-forget)
      // We respond to GitHub first (below), then kick off analysis in the background.
      // Results are cached in commitInsights/{sha} and merged back to commits/{sha}.
      if (repoData) {
        const [owner, repoName] = repoData.fullName.split('/');
        for (const c of commits) {
          autoAnalyzeCommit({
            sha: c.id,
            message: c.message,
            author: c.author?.name ?? 'Unknown',
            repoId: repoId!,
            owner,
            repoName,
            token: repoData.token,
          }).catch(err => console.error(`[webhook] auto-analyze failed for ${c.id}:`, err));
        }
      }
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

// ── Auto-analysis helper ─────────────────────────────────────────────────────────
async function autoAnalyzeCommit(opts: {
  sha: string;
  message: string;
  author: string;
  repoId: string;
  owner: string;
  repoName: string;
  token: string;
}): Promise<void> {
  const { sha, message, author, repoId, owner, repoName, token } = opts;

  // Skip if already analyzed
  const existingInsight = await adminDb.collection('commitInsights').doc(sha).get();
  if (existingInsight.exists) {
    console.log(`[webhook/autoAnalyze] Skipping ${sha} — already cached`);
    return;
  }

  console.log(`[webhook/autoAnalyze] Starting pipeline for ${sha}`);

  // Fetch commit detail + files from GitHub
  const MAX_FILES = 40;
  const detail = await fetchCommitDetail(owner, repoName, sha, token);
  if (!detail) {
    console.warn(`[webhook/autoAnalyze] Could not fetch detail for ${sha}`);
    return;
  }

  const parentSha = detail.parents[0]?.sha ?? null;
  const relevant  = (detail.files ?? []).filter(f => isRelevantFile(f.filename)).slice(0, MAX_FILES);

  const changedFiles = await Promise.all(
    relevant.map(async f => {
      const [after, before] = await Promise.all([
        f.status === 'removed' ? null : fetchFileContent(owner, repoName, f.filename, sha, token),
        f.status === 'added' || !parentSha ? null : fetchFileContent(owner, repoName, f.filename, parentSha, token),
      ]);
      return { filename: f.filename, status: f.status, content_before: before ?? '', content_after: after ?? '', patch: f.patch ?? '' };
    })
  );

  // Classify and persist commit files (so detail page can skip re-fetching)
  const classification = classifyCommit(
    changedFiles.map(f => ({ filename: f.filename, content_after: f.content_after, patch: f.patch })),
    message
  );
  adminDb.collection('commitFiles').doc(sha).set({
    sha, owner, repo: repoName, repoId, parentSha, message, author,
    total_files_changed: (detail.files ?? []).length,
    relevant_files_count: relevant.length,
    changed_files: changedFiles,
    ...classification,
    fetchedAt: FieldValue.serverTimestamp(),
  }).catch(() => {});

  // Write classification back to commit doc
  adminDb.collection('commits').doc(sha).set({
    department: classification.department,
    module:     classification.module,
    module_classification_method: classification.module_classification_method,
    classifiedAt: FieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});

  // Build agent input and run the pipeline
  const agentInput: AgentInput = {
    sha,
    message,
    author,
    changedFiles: changedFiles.map(f => ({ filename: f.filename, status: f.status, patch: f.patch })),
    department: classification.department,
    module:     classification.module,
    repoFullName: `${owner}/${repoName}`,
  };

  const insight = await runInsightPipeline(agentInput);

  // Persist full insight
  adminDb.collection('commitInsights').doc(sha).set({
    ...insight,
    generatedAt: FieldValue.serverTimestamp(),
  }).catch(() => {});

  // Write summary back to commits/{sha} so the list page real-time listener picks it up
  adminDb.collection('commits').doc(sha).set({
    aiRiskLevel:    insight.riskLevel,
    aiSummaryLine1: insight.summaryLine1,
    aiSummaryLine2: insight.summaryLine2,
    aiGeneratedAt:  FieldValue.serverTimestamp(),
  }, { merge: true }).catch(() => {});

  console.log(`[webhook/autoAnalyze] Done for ${sha}: riskLevel=${insight.riskLevel}`);
}

// GitHub sends a ping on webhook setup
export async function GET() {
  return NextResponse.json({ ok: true, message: 'TRACER GitHub Webhook endpoint ready' });
}
