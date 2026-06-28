// src/lib/aiInsight.ts
//
// 4-agent agentic pipeline — Vertex AI / Gemini 2.5 Flash
// Agents run sequentially; each feeds context into the next.
//
// Step 3 — Change Understanding Agent
// Step 4 — Dependency Analysis Agent
// Step 5 — Impact Prediction Agent
// Step 6 — Recommendation Agent

import { GoogleGenAI } from '@google/genai';
import serviceAccount from '../../credentials/google.json';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ChangeUnderstanding {
  type: 'Feature' | 'Bugfix' | 'Refactor' | 'Config' | 'Docs' | 'Test' | 'Chore' | 'Security';
  component: string;
  businessMeaning: string;
  technicalSummary: string;
}

export interface DependencyAnalysis {
  frontend: string[];
  backend: string[];
  database: string[];
  dataPipeline: string[];
  sharedServices: string[];
  chain: string; // e.g. "Backend API → Frontend → Analytics Pipeline"
}

export interface ImpactPrediction {
  affectedTeams: string[];
  potentialFailures: string[];
  productionRisks: string[];
  requiredActions: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
  riskReasoning: string;
}

export interface Recommendations {
  requiredTests: string[];
  teamsToNotify: string[];
  rollbackSuggestions: string[];
  priorityActions: string[];
}

export interface InsightResult {
  sha: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'CRITICAL';
  summaryLine1: string;
  summaryLine2: string;
  changeUnderstanding: ChangeUnderstanding;
  dependencyAnalysis: DependencyAnalysis;
  impactPrediction: ImpactPrediction;
  recommendations: Recommendations;
  generatedAt: string;
}

export interface AgentInput {
  sha: string;
  message: string;
  author: string;
  changedFiles: Array<{
    filename: string;
    status: string;
    patch?: string;
  }>;
  department?: string[];
  module?: string[];
  repoFullName?: string;
}

// ── Vertex AI client (singleton) ───────────────────────────────────────────────

// Use the service account JSON directly (same pattern as firebaseAdmin.ts)
// so we don't rely on GOOGLE_APPLICATION_CREDENTIALS env var path resolution.
let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;

  const project  = process.env.GOOGLE_CLOUD_PROJECT  ?? (serviceAccount as { project_id: string }).project_id;
  const location = process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1';

  // Use the service account credentials directly via GOOGLE_APPLICATION_CREDENTIALS
  // (Vertex AI ADC picks it up automatically at runtime).
  // The GoogleGenAI SDK with vertexai:true uses ADC from the env var.
  _client = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  return _client;
}

const MODEL = () => process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

// ── Token-safe truncation ─────────────────────────────────────────────────────

const MAX_PATCH_CHARS  = 2000;  // per file
const MAX_TOTAL_CHARS  = 20000; // total prompt input

function truncatePatch(patch: string | undefined): string {
  if (!patch) return '';
  return patch.length > MAX_PATCH_CHARS
    ? patch.slice(0, MAX_PATCH_CHARS) + '\n... (truncated)'
    : patch;
}

function buildDiffSummary(files: AgentInput['changedFiles']): string {
  let out = '';
  for (const f of files.slice(0, 20)) {
    out += `\n--- ${f.filename} [${f.status}] ---\n${truncatePatch(f.patch)}\n`;
    if (out.length > MAX_TOTAL_CHARS) {
      out += '\n... (remaining files truncated for token budget)';
      break;
    }
  }
  return out;
}

// Helper to sleep for N milliseconds
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callModel(prompt: string): Promise<string> {
  const client = getClient();
  let attempt = 0;
  const maxAttempts = 6; // up to 5 retries
  let delay = 2000;      // start with 2s delay

  while (true) {
    try {
      attempt++;
      // If we are sequential calling, add a small 500ms sleep between non-first calls to proactively avoid rate limit burst
      if (attempt === 1 && delay !== 2000) {
        await sleep(500);
      }

      const response = await client.models.generateContent({
        model: MODEL(),
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2, // low temperature → deterministic, no hallucination
        },
      });
      return response.text ?? '{}';
    } catch (err) {
      const errStr = String(err);
      const isRateLimit =
        errStr.includes('429') ||
        errStr.includes('RESOURCE_EXHAUSTED') ||
        errStr.includes('quota') ||
        (err && typeof err === 'object' && ('status' in err && (err as any).status === 429));

      if (isRateLimit && attempt < maxAttempts) {
        // Add random jitter to prevent thundering herd
        const jitter = Math.random() * 1000;
        const currentDelay = delay + jitter;
        console.warn(`[aiInsight] Rate limited (429/RESOURCE_EXHAUSTED). Retrying in ${Math.round(currentDelay)}ms (Attempt ${attempt}/${maxAttempts - 1})…`);
        await sleep(currentDelay);
        delay *= 2; // exponential backoff
        continue;
      }
      // If not rate limit, or max attempts reached, throw the original error
      throw err;
    }
  }
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    // Strip markdown code fences if the model wraps JSON in them
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.warn('[aiInsight] JSON parse failed for response:', raw.slice(0, 200));
    return fallback;
  }
}

// ── Agent 1: Change Understanding ─────────────────────────────────────────────

async function agent1_changeUnderstanding(input: AgentInput): Promise<ChangeUnderstanding> {
  const fileList = input.changedFiles.map(f => `${f.status}: ${f.filename}`).join('\n');
  const diffs    = buildDiffSummary(input.changedFiles);

  const prompt = `You are a senior engineering lead doing a code review. Analyze this Git commit and classify the change.

Commit message: "${input.message}"
Author: ${input.author}
Repository: ${input.repoFullName ?? 'unknown'}
Pre-classification: department=${(input.department ?? []).join(', ')}, module=${(input.module ?? []).join(', ')}

Files changed (${input.changedFiles.length} total):
${fileList}

Diff samples:
${diffs}

Determine:
1. type: one of Feature | Bugfix | Refactor | Config | Docs | Test | Chore | Security
2. component: the primary system component or subsystem (e.g. "Auth Service", "Payment Flow", "User Dashboard")
3. businessMeaning: what this change means for the product/business in plain language (1-2 sentences, non-technical)
4. technicalSummary: concise 1-sentence technical description of what changed

Return ONLY valid JSON, no markdown:
{"type":"...","component":"...","businessMeaning":"...","technicalSummary":"..."}`;

  const raw = await callModel(prompt);
  return safeParse<ChangeUnderstanding>(raw, {
    type: 'Chore',
    component: input.module?.[0] ?? 'Unknown',
    businessMeaning: 'Change details unavailable.',
    technicalSummary: input.message.split('\n')[0].slice(0, 120),
  });
}

// ── Agent 2: Dependency Analysis ──────────────────────────────────────────────

async function agent2_dependencyAnalysis(
  input: AgentInput,
  a1: ChangeUnderstanding
): Promise<DependencyAnalysis> {
  const fileList = input.changedFiles.map(f => f.filename).join('\n');

  const prompt = `You are a system architecture analyst. Identify which system layers are affected by this commit.

Commit: "${input.message}"
Change type: ${a1.type}
Component: ${a1.component}
Technical summary: ${a1.technicalSummary}
Business meaning: ${a1.businessMeaning}

Files modified:
${fileList}

For each system layer, list the specific parts that are impacted (empty array if none affected):
- frontend: UI components, pages, client-side state, routing
- backend: API endpoints, services, business logic, middleware
- database: schema changes, queries, migrations, indexes
- dataPipeline: ETL jobs, analytics processing, data ingestion, event streams
- sharedServices: auth, notifications, config, logging, caching

Also provide a chain showing the cascade order (e.g. "Backend API → Frontend → Analytics Pipeline").
If only one layer is affected, just list that layer.

Return ONLY valid JSON, no markdown:
{"frontend":[],"backend":[],"database":[],"dataPipeline":[],"sharedServices":[],"chain":"..."}`;

  const raw = await callModel(prompt);
  return safeParse<DependencyAnalysis>(raw, {
    frontend: [],
    backend: [],
    database: [],
    dataPipeline: [],
    sharedServices: [],
    chain: a1.component,
  });
}

// ── Agent 3: Impact Prediction ────────────────────────────────────────────────

async function agent3_impactPrediction(
  input: AgentInput,
  a1: ChangeUnderstanding,
  a2: DependencyAnalysis
): Promise<ImpactPrediction> {
  const activeLayers = Object.entries(a2)
    .filter(([k, v]) => k !== 'chain' && Array.isArray(v) && (v as string[]).length > 0)
    .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
    .join('\n');

  const prompt = `You are a production risk analyst. Predict the blast radius and risk of this change.

Change: ${a1.type} on "${a1.component}"
Business impact: ${a1.businessMeaning}
Technical: ${a1.technicalSummary}

Dependency chain: ${a2.chain}
Active system layers affected:
${activeLayers || '(none identified)'}

Predict:
1. affectedTeams: engineering teams that need to be aware (e.g. "Frontend Team", "Backend Team", "Data Engineering", "DevOps", "QA")
2. potentialFailures: specific technical failure modes that could occur (be concrete, not generic)
3. productionRisks: risks to production stability/users if this is deployed incorrectly
4. requiredActions: immediate actions needed before/after deploying

Risk level rules:
- CRITICAL: impacts database schema OR data pipeline OR multiple teams OR breaks backward compatibility OR security-related
- MEDIUM: impacts 2+ system layers OR backend API contract changes OR non-trivial frontend state changes
- LOW: isolated to 1 layer, no breaking changes, no data impact, no security implications

5. riskLevel: LOW | MEDIUM | CRITICAL
6. riskReasoning: 1 sentence explaining the risk level decision

Return ONLY valid JSON, no markdown:
{"affectedTeams":[],"potentialFailures":[],"productionRisks":[],"requiredActions":[],"riskLevel":"LOW","riskReasoning":"..."}`;

  const raw = await callModel(prompt);
  return safeParse<ImpactPrediction>(raw, {
    affectedTeams: [],
    potentialFailures: [],
    productionRisks: [],
    requiredActions: [],
    riskLevel: 'LOW',
    riskReasoning: 'Unable to determine risk level automatically.',
  });
}

// ── Agent 4: Recommendations ──────────────────────────────────────────────────

async function agent4_recommendations(
  a1: ChangeUnderstanding,
  a2: DependencyAnalysis,
  a3: ImpactPrediction
): Promise<Recommendations> {
  const prompt = `You are a DevOps and release management expert. Provide actionable recommendations for this change.

Change: ${a1.type} — ${a1.technicalSummary}
Risk level: ${a3.riskLevel} — ${a3.riskReasoning}
Affected teams: ${a3.affectedTeams.join(', ') || 'none'}
Potential failures: ${a3.potentialFailures.join('; ') || 'none'}
Production risks: ${a3.productionRisks.join('; ') || 'none'}
Required actions: ${a3.requiredActions.join('; ') || 'none'}
Dependency chain: ${a2.chain}

Generate practical recommendations.

CRITICAL: Every array MUST contain only plain strings. Do NOT use nested objects.

1. requiredTests: array of plain strings — specific tests that MUST run (e.g. "Run unit tests for auth module")
2. teamsToNotify: array of plain strings — team name and reason combined into one string (e.g. "Frontend Team — UI depends on this API change")
3. rollbackSuggestions: array of plain strings — specific rollback steps (e.g. "Revert commit abc123 using git revert")
4. priorityActions: array of plain strings — top 3-5 actions ordered by urgency

Return ONLY valid JSON with flat string arrays, no markdown, no nested objects:
{"requiredTests":["string","string"],"teamsToNotify":["string","string"],"rollbackSuggestions":["string"],"priorityActions":["string","string"]}`;

  const raw = await callModel(prompt);
  return safeParse<Recommendations>(raw, {
    requiredTests: [],
    teamsToNotify: [],
    rollbackSuggestions: ['Revert the commit using git revert'],
    priorityActions: [],
  });
}

// ── Summary generation ────────────────────────────────────────────────────────

async function generateSummaryLines(
  a1: ChangeUnderstanding,
  a3: ImpactPrediction,
  message: string
): Promise<{ summaryLine1: string; summaryLine2: string }> {
  const prompt = `Generate a 2-line human-readable summary for a commit insight card (shown in a list view).

Commit message: "${message}"
Change type: ${a1.type}, Component: ${a1.component}
Business meaning: ${a1.businessMeaning}
Risk: ${a3.riskLevel} — ${a3.riskReasoning}
Affected teams: ${a3.affectedTeams.join(', ') || 'none'}

Requirements:
- summaryLine1: max 80 chars. What changed, in plain English. Start with an action verb. Focus on the business impact.
- summaryLine2: max 80 chars. The key risk or team impact. Start with "Affects" or "Risk:" or "Requires".

Return ONLY valid JSON, no markdown:
{"summaryLine1":"...","summaryLine2":"..."}`;

  const raw = await callModel(prompt);
  return safeParse(raw, {
    summaryLine1: a1.businessMeaning.slice(0, 80),
    summaryLine2: `Risk: ${a3.riskLevel} — ${a3.riskReasoning.slice(0, 60)}`,
  });
}

// ── Normalize helper: flatten any arrays that the AI returned as objects ────────────────

function toStringArray(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    if (typeof item === 'string') return item;
    if (item === null || item === undefined) return '';
    if (typeof item === 'object') {
      const o = item as Record<string, unknown>;
      if (typeof o.team === 'string' && typeof o.reason === 'string') return `${o.team} — ${o.reason}`;
      if (typeof o.team === 'string')   return o.team;
      if (typeof o.name === 'string')   return o.name;
      if (typeof o.action === 'string') return o.action;
      if (typeof o.test === 'string')   return o.test;
      if (typeof o.step === 'string')   return o.step;
      const vals = Object.values(o).filter(v => typeof v === 'string') as string[];
      return vals.join(' — ');
    }
    return String(item);
  }).filter(Boolean);
}

// ── Main pipeline ───────────────────────────────────────────────────────────────

export async function runInsightPipeline(input: AgentInput): Promise<InsightResult> {
  console.log(`[aiInsight] Starting pipeline for ${input.sha} (${input.changedFiles.length} files)`);

  const a1 = await agent1_changeUnderstanding(input);
  console.log(`[aiInsight] Agent 1 done: type=${a1.type}, component=${a1.component}`);

  const a2 = await agent2_dependencyAnalysis(input, a1);
  console.log(`[aiInsight] Agent 2 done: chain="${a2.chain}"`);

  const a3 = await agent3_impactPrediction(input, a1, a2);
  console.log(`[aiInsight] Agent 3 done: riskLevel=${a3.riskLevel}, teams=${a3.affectedTeams.join(',')}`);

  const a4 = await agent4_recommendations(a1, a2, a3);
  console.log(`[aiInsight] Agent 4 done: ${a4.requiredTests.length} tests, ${a4.teamsToNotify.length} teams to notify`);

  const summary = await generateSummaryLines(a1, a3, input.message);
  console.log(`[aiInsight] Summary done: "${summary.summaryLine1}"`);

  const result: InsightResult = {
    sha: input.sha,
    riskLevel: a3.riskLevel,
    summaryLine1: summary.summaryLine1,
    summaryLine2: summary.summaryLine2,
    changeUnderstanding: a1,
    dependencyAnalysis: {
      ...a2,
      frontend:       toStringArray(a2.frontend),
      backend:        toStringArray(a2.backend),
      database:       toStringArray(a2.database),
      dataPipeline:   toStringArray(a2.dataPipeline),
      sharedServices: toStringArray(a2.sharedServices),
    },
    impactPrediction: {
      ...a3,
      affectedTeams:    toStringArray(a3.affectedTeams),
      potentialFailures: toStringArray(a3.potentialFailures),
      productionRisks:  toStringArray(a3.productionRisks),
      requiredActions:  toStringArray(a3.requiredActions),
    },
    recommendations: {
      requiredTests:       toStringArray(a4.requiredTests),
      teamsToNotify:       toStringArray(a4.teamsToNotify),
      rollbackSuggestions: toStringArray(a4.rollbackSuggestions),
      priorityActions:     toStringArray(a4.priorityActions),
    },
    generatedAt: new Date().toISOString(),
  };

  return result;
}
