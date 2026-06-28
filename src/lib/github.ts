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
