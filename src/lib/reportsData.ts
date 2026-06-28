/* ============================================================
   TRACER — Reports Mock Data
   All data is hardcoded/simulated for the MVP/hackathon version.
   ============================================================ */

// ── Summary Cards ────────────────────────────────────────────

export const summaryStats = {
  totalCommits: 127,
  highRiskChanges: 9,
  crossTeamImpacts: 63,
  mostAffectedTeam: 'Frontend',
  mostImpactfulModule: 'Payment Service',
};

// ── Teams & Modules ──────────────────────────────────────────

export const TEAMS = ['Frontend', 'Backend', 'Data', 'Security'] as const;
export type Team = typeof TEAMS[number];

export const MODULES = ['Payment', 'Auth', 'Reporting', 'Analytics'] as const;
export type Module = typeof MODULES[number];

// ── Team Impact Matrix ───────────────────────────────────────

/** teamMatrix[source][target] = impact count. "-" when source === target */
export const teamMatrix: Record<Team, Record<Team, number | null>> = {
  Frontend: { Frontend: null, Backend:  5, Data:  1, Security:  0 },
  Backend:  { Frontend: 18,  Backend: null, Data: 12, Security:  3 },
  Data:     { Frontend:  2,  Backend:  4, Data: null, Security:  0 },
  Security: { Frontend:  1,  Backend:  6, Data:  0, Security: null },
};

export const teamMatrixInsight =
  '78% of Frontend disruptions originated from Backend API changes. Backend is the highest-impact team with 33 total outbound interactions this sprint.';

/** moduleMatrix[source][target] = impact count */
export const moduleMatrix: Record<Module, Record<Module, number | null>> = {
  Payment:   { Payment: null, Auth:  8, Reporting: 11, Analytics:  6 },
  Auth:      { Payment:  7,  Auth: null, Reporting:  3, Analytics:  2 },
  Reporting: { Payment:  2,  Auth:  1, Reporting: null, Analytics:  9 },
  Analytics: { Payment:  3,  Auth:  0, Reporting:  5, Analytics: null },
};

export const moduleMatrixInsight =
  'Payment Service is driving the most cross-module disruption. 11 Reporting pipeline incidents traced back to Payment API changes.';

export const teamMatrixStats = {
  totalInteractions: 52,
  highestImpactTeam: 'Backend',
  mostAffectedTeam: 'Frontend',
};

// ── Engineering Hotspots ─────────────────────────────────────

export interface HotspotModule {
  name: string;
  commits: number;
  crossTeamImpact: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
}

export const hotspotModules: HotspotModule[] = [
  { name: 'Payment Service', commits: 34, crossTeamImpact: 28, risk: 'HIGH' },
  { name: 'Auth Service',    commits: 26, crossTeamImpact: 21, risk: 'HIGH' },
  { name: 'Frontend API',    commits: 22, crossTeamImpact: 18, risk: 'HIGH' },
  { name: 'Analytics',       commits: 19, crossTeamImpact: 15, risk: 'MEDIUM' },
  { name: 'Database',        commits: 14, crossTeamImpact: 25, risk: 'HIGH' },
];

export interface HotspotFile {
  path: string;
  impactCount: number;
  affectedTeams: Team[];
  avgRiskScore: number; // 0–100
}

export const hotspotFiles: HotspotFile[] = [
  {
    path: 'services/payment/discount.ts',
    impactCount: 14,
    affectedTeams: ['Frontend', 'Backend', 'Data'],
    avgRiskScore: 87,
  },
  {
    path: 'database/schema.sql',
    impactCount: 11,
    affectedTeams: ['Backend', 'Data', 'Security'],
    avgRiskScore: 92,
  },
  {
    path: 'frontend/api/payment.ts',
    impactCount: 9,
    affectedTeams: ['Frontend', 'Backend'],
    avgRiskScore: 74,
  },
  {
    path: 'analytics/events.ts',
    impactCount: 7,
    affectedTeams: ['Data', 'Backend'],
    avgRiskScore: 61,
  },
  {
    path: 'auth/middleware/session.ts',
    impactCount: 6,
    affectedTeams: ['Security', 'Frontend', 'Backend'],
    avgRiskScore: 79,
  },
];

export const hotspotInsight =
  'Payment Service is the primary engineering hotspot. discount.ts has been modified 14 times this sprint and is a shared dependency across 3 teams.';

// ── Dependency Impact ────────────────────────────────────────

export interface DependencyModule {
  name: string;
  dependencies: number;
  totalImpact: number;
  rippleScore: number; // 0–100
}

export const dependencyModules: DependencyModule[] = [
  { name: 'Database',       dependencies: 8, totalImpact: 25, rippleScore: 96 },
  { name: 'Payment',        dependencies: 5, totalImpact: 12, rippleScore: 78 },
  { name: 'Auth',           dependencies: 4, totalImpact:  9, rippleScore: 65 },
  { name: 'Analytics',      dependencies: 3, totalImpact:  7, rippleScore: 48 },
  { name: 'Frontend API',   dependencies: 6, totalImpact: 18, rippleScore: 84 },
];

export const dependencyChain = [
  { module: 'Database',     depth: 0 },
  { module: 'Payment',      depth: 1 },
  { module: 'Auth',         depth: 1 },
  { module: 'Frontend API', depth: 2 },
  { module: 'Analytics',    depth: 3 },
];

export const dependencyStats = {
  mostDependent: 'Database',
  highestRipple: 'Database',
  avgDepth: 1.8,
};

export const dependencyInsight =
  'Database schema is the root dependency for 4 downstream modules. A single schema migration can propagate to 25+ code locations across Frontend, Payment, and Analytics pipelines.';

// ── High Risk Changes ────────────────────────────────────────

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface RiskCommit {
  id: string;
  sha: string;
  message: string;
  author: string;
  timestamp: string;
  team: string;
  risk: RiskLevel;
  affectedTeams: Team[];
  affectedModules: string[];
  aiExplanation: string;
}

export const riskCommits: RiskCommit[] = [
  {
    id: 'rc1',
    sha: 'a3f9d21',
    message: 'auth schema update: rename user_id → customer_id',
    author: 'Jordan Lee',
    timestamp: '2026-06-27T14:32:00Z',
    team: 'Security',
    risk: 'HIGH',
    affectedTeams: ['Frontend', 'Backend', 'Data', 'Security'],
    affectedModules: ['Auth Service', 'Payment Service', 'Analytics Pipeline'],
    aiExplanation:
      'customer_id is a shared primary key referenced by Payment Service and Analytics Pipeline. Renaming this field without a coordinated migration creates silent data mismatches across all consumers.',
  },
  {
    id: 'rc2',
    sha: 'b7e2c88',
    message: 'payment API v2: restructure pricing endpoints',
    author: 'Alex Morgan',
    timestamp: '2026-06-26T09:15:00Z',
    team: 'Backend',
    risk: 'HIGH',
    affectedTeams: ['Frontend', 'Backend'],
    affectedModules: ['Payment Service', 'Frontend API'],
    aiExplanation:
      'The /v2/pricing endpoint contract change breaks 3 Frontend components that consume the legacy response shape. No backwards-compatible shim was provided.',
  },
  {
    id: 'rc3',
    sha: 'c1d4f55',
    message: 'database/schema.sql: drop legacy orders_v1 table',
    author: 'Sam Chen',
    timestamp: '2026-06-25T16:44:00Z',
    team: 'Data',
    risk: 'HIGH',
    affectedTeams: ['Backend', 'Data', 'Security'],
    affectedModules: ['Database', 'Payment Service', 'Analytics Pipeline'],
    aiExplanation:
      'orders_v1 is still referenced by the Analytics ETL pipeline and the Payment audit log. Dropping the table without migrating these references will cause runtime failures at next sync.',
  },
  {
    id: 'rc4',
    sha: 'd9b3a17',
    message: 'analytics/events.ts: add session_context field to event schema',
    author: 'Riley Park',
    timestamp: '2026-06-24T11:20:00Z',
    team: 'Data',
    risk: 'MEDIUM',
    affectedTeams: ['Backend', 'Data'],
    affectedModules: ['Analytics Pipeline', 'Frontend API'],
    aiExplanation:
      'Adding session_context increases event payload size by ~40%. This may impact the real-time streaming pipeline throughput under peak load conditions.',
  },
  {
    id: 'rc5',
    sha: 'e2f8b93',
    message: 'frontend/api/payment.ts: migrate to new checkout flow',
    author: 'Taylor Kim',
    timestamp: '2026-06-23T08:05:00Z',
    team: 'Frontend',
    risk: 'HIGH',
    affectedTeams: ['Frontend', 'Backend'],
    affectedModules: ['Frontend API', 'Payment Service'],
    aiExplanation:
      'The new checkout flow removes backward compatibility with cart state stored in localStorage. Existing user sessions will lose cart data on page reload until the migration is complete.',
  },
  {
    id: 'rc6',
    sha: 'f4c7e02',
    message: 'auth/middleware/session.ts: enforce strict CSRF token rotation',
    author: 'Casey Wright',
    timestamp: '2026-06-22T13:55:00Z',
    team: 'Security',
    risk: 'MEDIUM',
    affectedTeams: ['Frontend', 'Security'],
    affectedModules: ['Auth Service', 'Frontend API'],
    aiExplanation:
      'CSRF token rotation interval changed from 60 min to 15 min. Frontend components with long-lived forms (checkout, profile edit) will now surface stale token errors for users mid-session.',
  },
];

export const riskInsight =
  'Security team changes have the widest blast radius — averaging 3.5 affected teams per commit. Schema-level changes are the primary risk vector this sprint.';

// ── AI Executive Summary ─────────────────────────────────────

export const aiSummaryWeek = 'Jun 21 – Jun 27, 2026';

export const aiObservations = [
  'Backend Team introduced 14 API contract modifications affecting 3 consumer teams.',
  'Payment Service generated the highest cross-team impact with 28 downstream interactions.',
  'Frontend Team was disrupted by 9 backend-originated changes, the highest inbound impact.',
  'Database schema updates propagated impact across 4 distinct teams.',
  'Analytics Pipeline experienced 3 integration risks from upstream event schema changes.',
  'Security team commits carried the highest average blast radius at 3.5 teams per change.',
];

export const aiRecommendations = [
  'Implement API versioning for Payment Service to isolate consumers from breaking changes.',
  'Introduce a schema migration review gate requiring sign-off from all dependent team leads.',
  'Establish a cross-team impact notification protocol for HIGH-risk commits.',
  'Create a shared contract registry for the customer_id field used across Auth, Payment, and Analytics.',
];

export const aiFutureRisks = [
  'Analytics Pipeline refactor planned for next sprint may impact Backend event consumers.',
  'Auth service OAuth2 migration introduces a potential session incompatibility with Frontend.',
  'Payment Service v3 API design will require coordinated Frontend and Data team migration.',
];

// ── Team Collaboration Graph ─────────────────────────────────

export interface CollabNode {
  team: Team;
  connections: { target: Team; weight: number }[];
}

export const collabGraph: CollabNode[] = [
  {
    team: 'Backend',
    connections: [
      { target: 'Frontend', weight: 18 },
      { target: 'Data',     weight: 12 },
      { target: 'Security', weight:  3 },
    ],
  },
  {
    team: 'Frontend',
    connections: [
      { target: 'Backend',  weight:  5 },
      { target: 'Data',     weight:  1 },
    ],
  },
  {
    team: 'Data',
    connections: [
      { target: 'Frontend', weight:  2 },
      { target: 'Backend',  weight:  4 },
    ],
  },
  {
    team: 'Security',
    connections: [
      { target: 'Frontend', weight:  1 },
      { target: 'Backend',  weight:  6 },
    ],
  },
];
