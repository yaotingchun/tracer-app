// src/lib/depGraph.ts
//
// Dependency graph builder — pure GitHub REST API, no git clone, no disk I/O.
//
// Steps:
//   1a. Fetch the full file tree (recursive git tree) → filter to JS/TS files
//   1b. Fetch file contents via /contents/{path} → decode base64
//   1c. Extract import/require/import() statements via @babel/parser AST walk
//   1d. Resolve each import path against the fetched file tree
//   1e. Build adjacency maps: dependencies + dependents

import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { fetchFileContent } from './github';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DepGraphStats {
  totalFiles: number;
  totalEdges: number;
  externalImports: number;
  unresolvedImports: number;
  mostDependedOn: { file: string; count: number } | null;
  mostDependencies: { file: string; count: number } | null;
}

export interface DepGraphResult {
  /** file → list of files it imports from (internal only) */
  dependencies: Record<string, string[]>;
  /** file → list of files that import it */
  dependents: Record<string, string[]>;
  stats: DepGraphStats;
  /** raw list of JS/TS files in the repo */
  fileTree: string[];
}

// ── Extensions we care about ──────────────────────────────────────────────────

const JS_TS_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
const RESOLVE_ORDER = [
  '', // exact match
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '/index.js', '/index.ts', '/index.jsx', '/index.tsx',
];

const GH_API = 'https://api.github.com';

function ghHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

// ── Step 1a: Fetch full file tree ─────────────────────────────────────────────

export async function fetchFileTree(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<string[]> {
  const url = `${GH_API}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const res = await fetch(url, { headers: ghHeaders(token), next: { revalidate: 0 } });

  if (!res.ok) {
    console.error(`[depGraph 1a] git/trees request failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  // data.tree is an array of { path, type, sha, url, ... }
  const all: string[] = (data.tree ?? [])
    .filter((node: { type: string; path: string }) => node.type === 'blob')
    .map((node: { path: string }) => node.path);

  const filtered = all.filter(p => JS_TS_EXTS.some(ext => p.endsWith(ext)));

  if (data.truncated) {
    console.warn('[depGraph 1a] WARNING: tree was truncated by GitHub (repo > 100k objects). Results may be incomplete.');
  }

  console.log(`[depGraph 1a] Tree fetched: ${all.length} total blobs, ${filtered.length} JS/TS files`);
  return filtered;
}

// ── Step 1b: Fetch source files ───────────────────────────────────────────────
// Uses the existing fetchFileContent helper from github.ts (already base64-decodes)

export async function fetchSourceFiles(
  owner: string,
  repo: string,
  paths: string[],
  branch: string,
  token: string,
  onProgress?: (fetched: number, total: number) => void
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  if (paths.length > 500) {
    console.warn(
      `[depGraph 1b] Large repo: ${paths.length} files to fetch. ` +
      'This may approach GitHub API rate limits (5000 req/hr for authenticated calls). ' +
      'Consider adding session-level caching if this becomes a bottleneck.'
    );
  }

  // Batch in groups of 20 to avoid hammering the API
  const BATCH = 20;
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(p => fetchFileContent(owner, repo, p, branch, token).then(src => ({ p, src })))
    );
    for (const { p, src } of results) {
      if (src !== null) result.set(p, src);
    }
    onProgress?.(Math.min(i + BATCH, paths.length), paths.length);
  }

  console.log(`[depGraph 1b] Contents fetched: ${result.size}/${paths.length} files (${paths.length - result.size} failed/binary)`);
  return result;
}

// ── Step 1c: Extract imports via @babel/parser AST walk ───────────────────────

export function extractImports(filePath: string, source: string): string[] {
  const specifiers: string[] = [];

  // Pick parser plugins based on file extension
  const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
  const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');

  try {
    const ast = parse(source, {
      sourceType: 'module',
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      plugins: [
        ...(isTS ? (['typescript'] as const) : []),
        ...(isJSX ? (['jsx'] as const) : []),
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'dynamicImport',
        'importMeta',
        'optionalChaining',
        'nullishCoalescingOperator',
        'exportDefaultFrom',
        'exportNamespaceFrom',
      ],
    });

    traverse(ast, {
      // ES module: import foo from './foo'
      ImportDeclaration({ node }) {
        if (node.source?.value) specifiers.push(node.source.value);
      },
      // export ... from './foo'
      ExportNamedDeclaration({ node }) {
        if (node.source?.value) specifiers.push(node.source.value);
      },
      ExportAllDeclaration({ node }) {
        if (node.source?.value) specifiers.push(node.source.value);
      },
      // CallExpression: require('./foo') AND import('./foo')
      CallExpression({ node }) {
        // CommonJS require()
        if (
          node.callee.type === 'Identifier' &&
          (node.callee as { name: string }).name === 'require' &&
          node.arguments[0]?.type === 'StringLiteral'
        ) {
          specifiers.push((node.arguments[0] as { value: string }).value);
        }
        // Dynamic import()
        if (
          node.callee.type === 'Import' &&
          node.arguments[0]?.type === 'StringLiteral'
        ) {
          specifiers.push((node.arguments[0] as { value: string }).value);
        }
      },
    });
  } catch (err) {
    // Parser errors are expected for some files (JSX without extension, unusual syntax)
    // Log at debug level only — don't abort the whole graph
    console.warn(`[depGraph 1c] Parse error in ${filePath}: ${(err as Error).message?.split('\n')[0]}`);
  }

  return specifiers;
}

// ── Step 1d: Resolve import path against the file tree ────────────────────────

/**
 * Resolves a raw import specifier to a file path within the repo tree.
 * Returns null if it's an external/npm package or can't be resolved.
 */
export function resolveImport(
  specifier: string,
  importingFile: string,
  fileTreeSet: Set<string>
): string | null {
  // External: node_modules / npm bare imports (no ./ or ../)
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    // Could be a path alias like @/utils/foo — try it as-is without leading @/
    // First, check if it's a known internal alias pattern
    const aliasMatch = specifier.match(/^@\/(.+)$/);
    if (aliasMatch) {
      // @/ usually maps to src/ — try both
      const candidates = [`src/${aliasMatch[1]}`, aliasMatch[1]];
      for (const base of candidates) {
        for (const suffix of RESOLVE_ORDER) {
          if (fileTreeSet.has(base + suffix)) return base + suffix;
        }
      }
    }
    // True external dependency — exclude from internal graph
    return null;
  }

  // Resolve the base directory of the importing file
  const importingDir = importingFile.split('/').slice(0, -1).join('/');

  // Resolve relative path
  let resolved = importingDir ? `${importingDir}/${specifier}` : specifier;

  // Normalise /../ and /./ segments
  const parts = resolved.split('/');
  const normalised: string[] = [];
  for (const part of parts) {
    if (part === '..') {
      normalised.pop();
    } else if (part !== '.') {
      normalised.push(part);
    }
  }
  resolved = normalised.join('/');

  // Try resolution order
  for (const suffix of RESOLVE_ORDER) {
    const candidate = resolved + suffix;
    if (fileTreeSet.has(candidate)) return candidate;
  }

  return null; // unresolved
}

// ── Step 1e: Build the full dependency graph ──────────────────────────────────

export async function buildDependencyGraph(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<DepGraphResult> {
  // 1a — file tree
  const fileTree = await fetchFileTree(owner, repo, branch, token);
  if (fileTree.length === 0) {
    return {
      dependencies: {},
      dependents: {},
      stats: { totalFiles: 0, totalEdges: 0, externalImports: 0, unresolvedImports: 0, mostDependedOn: null, mostDependencies: null },
      fileTree: [],
    };
  }

  const fileTreeSet = new Set(fileTree);

  // 1b — fetch sources
  const sources = await fetchSourceFiles(owner, repo, fileTree, branch, token);

  // 1c + 1d — extract and resolve imports
  const dependencies: Record<string, string[]> = {};
  const dependents: Record<string, string[]> = {};
  let externalImports = 0;
  let unresolvedRelativeImports = 0;
  let totalImportsExtracted = 0;
  let totalEdgesResolved = 0;

  // Initialise all known files with empty arrays
  for (const f of fileTree) {
    dependencies[f] = [];
    dependents[f] = [];
  }

  for (const filePath of fileTree) {
    const source = sources.get(filePath);
    if (!source) continue;

    const rawImports = extractImports(filePath, source);
    totalImportsExtracted += rawImports.length;

    for (const specifier of rawImports) {
      const isRelative = specifier.startsWith('.') || specifier.startsWith('/');
      const resolved = resolveImport(specifier, filePath, fileTreeSet);

      if (resolved) {
        // Internal edge
        if (!dependencies[filePath].includes(resolved)) {
          dependencies[filePath].push(resolved);
        }
        if (!dependents[resolved]) dependents[resolved] = [];
        if (!dependents[resolved].includes(filePath)) {
          dependents[resolved].push(filePath);
          totalEdgesResolved++;
        }
      } else if (isRelative) {
        unresolvedRelativeImports++;
      } else {
        externalImports++;
      }
    }
  }

  console.log(`[depGraph 1c] Imports extracted: ${totalImportsExtracted} total`);
  console.log(`[depGraph 1d] Edges resolved: ${totalEdgesResolved} internal, ${externalImports} external (npm), ${unresolvedRelativeImports} unresolved relative`);

  // Compute stats
  let mostDependedOn: { file: string; count: number } | null = null;
  let mostDependencies: { file: string; count: number } | null = null;

  for (const [file, deps] of Object.entries(dependencies)) {
    if (!mostDependencies || deps.length > mostDependencies.count) {
      mostDependencies = { file, count: deps.length };
    }
  }
  for (const [file, deps] of Object.entries(dependents)) {
    if (!mostDependedOn || deps.length > mostDependedOn.count) {
      mostDependedOn = { file, count: deps.length };
    }
  }

  const stats: DepGraphStats = {
    totalFiles: fileTree.length,
    totalEdges: totalEdgesResolved,
    externalImports,
    unresolvedImports: unresolvedRelativeImports,
    mostDependedOn,
    mostDependencies,
  };

  return { dependencies, dependents, stats, fileTree };
}
