// src/lib/github.ts
// GitHub REST API helpers

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  owner: { login: string; avatar_url: string };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
    committer: { name: string; email: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
  html_url: string;
}

export interface GitHubCommitFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  patch?: string;          // diff fragment — not valid standalone code
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
}

export interface GitHubCommitDetail {
  sha: string;
  parents: { sha: string }[];
  files: GitHubCommitFile[];
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
}

export interface ChangedFile {
  filename: string;
  status: GitHubCommitFile['status'];
  content_before: string;  // full source before this commit (empty string if file was added)
  content_after: string;   // full source after this commit (empty string if file was deleted)
  patch?: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  user: { login: string; avatar_url: string };
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubBranch {
  name: string;
  commit: { sha: string; url: string };
  protected: boolean;
}

export interface GitHubContributor {
  login: string;
  avatar_url: string;
  contributions: number;
  html_url: string;
}

/** Parse a GitHub URL into { owner, repo } */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
    const match = cleaned.match(/github\.com[/:]([\w-]+)\/([\w.-]+)/i);
    if (!match) return null;
    return { owner: match[1], repo: match[2] };
  } catch {
    return null;
  }
}

const GH_API = 'https://api.github.com';

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Verify repository access and return repo metadata */
export async function verifyRepo(
  url: string,
  token: string
): Promise<{ ok: boolean; repo?: GitHubRepo; error?: string }> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) return { ok: false, error: 'Invalid GitHub URL' };

  const res = await fetch(`${GH_API}/repos/${parsed.owner}/${parsed.repo}`, {
    headers: ghHeaders(token),
    next: { revalidate: 0 },
  });

  if (res.status === 401) return { ok: false, error: 'Invalid Personal Access Token' };
  if (res.status === 404) return { ok: false, error: 'Repository not found or no access' };
  if (!res.ok) return { ok: false, error: `GitHub error: ${res.status}` };

  const repo: GitHubRepo = await res.json();
  return { ok: true, repo };
}

/** Fetch commits (latest 100) */
export async function fetchCommits(
  owner: string,
  repo: string,
  token: string,
  perPage = 100
): Promise<GitHubCommit[]> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/commits?per_page=${perPage}`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  return res.json();
}

/** Fetch pull requests */
export async function fetchPullRequests(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubPR[]> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/pulls?state=all&per_page=100`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  return res.json();
}

/** Fetch branches */
export async function fetchBranches(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubBranch[]> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/branches?per_page=100`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  return res.json();
}

/** Fetch contributors */
export async function fetchContributors(
  owner: string,
  repo: string,
  token: string
): Promise<GitHubContributor[]> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/contributors?per_page=100`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  return res.json();
}

/**
 * Fetch a single commit's detail: parents list + files changed (with patch fragments).
 * GET /repos/{owner}/{repo}/commits/{sha}
 */
export async function fetchCommitDetail(
  owner: string,
  repo: string,
  sha: string,
  token: string
): Promise<GitHubCommitDetail | null> {
  const res = await fetch(
    `${GH_API}/repos/${owner}/${repo}/commits/${sha}`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * Fetch the full raw content of a file at a given commit ref.
 * Returns the decoded UTF-8 string, or null on error (e.g. binary file, not found).
 * GitHub's contents API returns base64-encoded content in chunks joined by newlines.
 * NOTE: only works server-side — uses Buffer which is a Node.js API.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token: string
): Promise<string | null> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `${GH_API}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
  const res = await fetch(url, {
    headers: ghHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  // GitHub paginates large files; for small files content is inlined as base64
  if (typeof data.content !== 'string') return null;
  // Strip embedded newlines before decoding
  const b64 = data.content.replace(/\n/g, '');
  try {
    return Buffer.from(b64, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

// ── File-relevance filter ─────────────────────────────────────────────────────
//
// Rules (order matters — first match wins):
//  1. EXCLUDE: config/doc/lock/binary files that are never source code
//  2. INCLUDE: anything under well-known backend or frontend source trees
//  3. INCLUDE: any file with a recognised source-code extension
//  4. EXCLUDE: everything else (default-deny)

const EXCLUDE_PATTERNS: RegExp[] = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.lock$/,
  /\.log$/,
  /\.env(\..+)?$/,
  /\.gitignore$/,
  /\.prettierrc/,
  /\.eslintrc/,
  /\.editorconfig/,
  /README(\.md)?$/i,
  /CHANGELOG(\.md)?$/i,
  /LICENSE/i,
  /\.github\//,
  /^docs?\//,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /node_modules\//,
  /^coverage\//,
  /\.min\.(js|css)$/,
  /\.(png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|eot|mp4|mp3|pdf|zip|tar|gz)$/i,
];

const INCLUDE_PATTERNS: RegExp[] = [
  // Backend roots (common repo layouts)
  /^backend\//,
  /^api\//,
  /^server\//,
  /^services?\//,
  /^routes\//,
  /^app\//,
  /^apps\//,
  // Frontend roots
  /^frontend\//,
  /^src\//,
  /^lib\//,
  /^packages?\//,
  /^components?\//,
  // Any file with a recognised source-code extension, regardless of folder
  /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|cs|cpp|c|h|hpp|rs|php|swift|kt|scala|ex|exs|clj|hs|ml|fs|lua|r|sh|bash)$/,
];

/**
 * Returns true if this filename is worth fetching full source content for.
 * Excludes binaries/lockfiles/docs; includes known source paths/extensions.
 */
export function isRelevantFile(filename: string): boolean {
  for (const pat of EXCLUDE_PATTERNS) {
    if (pat.test(filename)) return false;
  }
  for (const pat of INCLUDE_PATTERNS) {
    if (pat.test(filename)) return true;
  }
  return false;
}

