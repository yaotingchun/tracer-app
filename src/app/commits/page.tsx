'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MainLayout from '@/components/layout/MainLayout';
import styles from './commits.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Commit {
  id: string;
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorEmail: string;
  authorAvatar: string | null;
  authorLogin: string | null;
  date: string;
  url: string;
  branch?: string;
  repoId: string;
  source?: string;
  // Classification fields (populated after a commit detail page is visited)
  department?: string[];
  module?: string[];
  module_classification_method?: string[];
}

interface Repo {
  id: string;
  fullName: string;
  status: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const GitBranchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/>
  </svg>
);

const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const now  = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)      return `${diff}s ago`;
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Department pill colours (consistent, not random)
const DEPT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  frontend:     { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  text: '#3b82f6' },
  backend:      { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   text: '#22c55e' },
  data:         { bg: 'rgba(168,85,247,0.08)',  border: 'rgba(168,85,247,0.25)',  text: '#a855f7' },
  unclassified: { bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)', text: '#6b7280' },
};

function deptStyle(dept: string) {
  return DEPT_COLORS[dept] ?? DEPT_COLORS.unclassified;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CommitSkeleton() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeleton} ${styles.skeletonAvatar}`} />
      <div className={styles.skeletonLines}>
        <div className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonLong}`} />
        <div className={`${styles.skeleton} ${styles.skeletonLine} ${styles.skeletonShort}`} />
      </div>
    </div>
  );
}


// ── Main page ─────────────────────────────────────────────────────────────────


export default function CommitsPage() {
  const router = useRouter();
  const [commits,       setCommits]       = useState<Commit[]>([]);
  const [repos,         setRepos]         = useState<Repo[]>([]);
  const [filterRepo,    setFilterRepo]    = useState<string>('all');
  const [filterAuthor,  setFilterAuthor]  = useState('');
  const [filterDept,    setFilterDept]    = useState('all');
  const [filterModule,  setFilterModule]  = useState('all');
  const [loading,       setLoading]       = useState(true);
  const [liveCount,     setLiveCount]     = useState(0);
  const prevCountRef = useRef(0);

  // Load repos list for filter
  useEffect(() => {
    fetch('/api/repositories')
      .then(r => r.json())
      .then(d => setRepos(d.repositories ?? []))
      .catch(() => {});
  }, []);

  // Reset other filters when changing repo
  useEffect(() => {
    setFilterModule('all');
    setFilterDept('all');
  }, [filterRepo]);

  // Real-time Firestore listener
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    let q = query(
      collection(db, 'commits'),
      orderBy('date', 'desc'),
      limit(200)
    );

    if (filterRepo !== 'all') {
      q = query(
        collection(db, 'commits'),
        where('repoId', '==', filterRepo),
        orderBy('date', 'desc'),
        limit(200)
      );
    }

    const unsub = onSnapshot(q, (snap) => {
      const docs: Commit[] = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Commit, 'id'>),
      }));
      if (prevCountRef.current > 0 && docs.length > prevCountRef.current) {
        setLiveCount(docs.length - prevCountRef.current);
        setTimeout(() => setLiveCount(0), 4000);
      }
      prevCountRef.current = docs.length;
      setCommits(docs);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [filterRepo]);

  // Derive unique dept/module options from loaded commits
  const { uniqueDepts, uniqueModules } = useMemo(() => {
    const depts   = new Set<string>();
    const modules = new Set<string>();
    for (const c of commits) {
      (c.department ?? []).forEach(d => depts.add(d));
      (c.module     ?? []).forEach(m => modules.add(m));
    }
    // Sort: unclassified always last
    const sortWithUnclassifiedLast = (arr: string[]) =>
      arr.sort((a, b) =>
        a === 'unclassified' ? 1 : b === 'unclassified' ? -1 : a.localeCompare(b)
      );
    return {
      uniqueDepts:   sortWithUnclassifiedLast(Array.from(depts)),
      uniqueModules: sortWithUnclassifiedLast(Array.from(modules)),
    };
  }, [commits]);

  // Determine the active modules for the selected repository (custom modules or dynamically computed modules)
  const activeModules = useMemo(() => {
    if (filterRepo === 'all') {
      return uniqueModules;
    }
    const repoDetails = repos.find(r => r.id === filterRepo) as any;
    if (repoDetails && repoDetails.customModules && repoDetails.customModules.length > 0) {
      const sorted = [...repoDetails.customModules];
      if (!sorted.includes('unclassified')) {
        sorted.push('unclassified');
      }
      return sorted.sort((a, b) =>
        a === 'unclassified' ? 1 : b === 'unclassified' ? -1 : a.localeCompare(b)
      );
    }
    return uniqueModules;
  }, [filterRepo, repos, uniqueModules]);

  // Multi-stage filter pipeline
  const displayed = useMemo(() => {
    let list = commits;

    // 1. Author text filter
    if (filterAuthor.trim()) {
      const q = filterAuthor.toLowerCase();
      list = list.filter(c =>
        c.author.toLowerCase().includes(q) ||
        (c.authorLogin ?? '').toLowerCase().includes(q)
      );
    }

    // 2. Department toggle (AND with module toggle)
    if (filterDept !== 'all') {
      list = list.filter(c => {
        const depts = c.department ?? [];
        // commits with no classification: show under 'unclassified'
        if (depts.length === 0) return filterDept === 'unclassified';
        return depts.includes(filterDept);
      });
    }

    // 3. Module toggle
    if (filterModule !== 'all') {
      list = list.filter(c => {
        const mods = c.module ?? [];
        if (mods.length === 0) return filterModule === 'unclassified';
        return mods.includes(filterModule);
      });
    }

    return list;
  }, [commits, filterAuthor, filterDept, filterModule]);

  const noRepos = !loading && repos.length === 0;
  const hasClassifiedAny = commits.some(c => c.department && c.department.length > 0);
  const hasActiveFilter = filterDept !== 'all' || filterModule !== 'all' || filterAuthor.trim() !== '';

  const handleCommitClick = (commit: Commit) => {
    router.push(`/commits/${commit.sha}?repoId=${commit.repoId}`);
  };

  return (
    <MainLayout>
      <div className={styles.page}>

        {/* ── Page header ─────────────────────────────────────────── */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Commits</h1>
            <p className={styles.subtitle}>Real-time feed across all connected repositories.</p>
          </div>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            <span className={styles.liveText}>Live</span>
            {liveCount > 0 && (
              <span className={styles.newBadge}>+{liveCount} new</span>
            )}
          </div>
        </div>

        {/* ── Unified filter toolbar ───────────────────────────────── */}
        {!noRepos && (
          <div className={styles.toolbar}>
            {/* Row 1: repo select + author search + count */}
            <div className={styles.toolbarTop}>
              <select
                id="filter-repo"
                className={styles.select}
                value={filterRepo}
                onChange={e => setFilterRepo(e.target.value)}
              >
                <option value="all">All repositories</option>
                {repos.map(r => (
                  <option key={r.id} value={r.id}>{r.fullName}</option>
                ))}
              </select>
              <input
                id="filter-author"
                className={styles.filterInput}
                type="text"
                placeholder="Search author…"
                value={filterAuthor}
                onChange={e => setFilterAuthor(e.target.value)}
              />
              <span className={styles.countBadge}>
                {displayed.length}
              </span>
            </div>

            {/* Row 2: classification pills — only once we have classified data */}
            {hasClassifiedAny && (
              <div className={styles.toolbarPills}>
                {/* Department group */}
                <div className={styles.pillGroup}>
                  <span className={styles.pillSectionLabel}>Dept</span>
                  {['all', ...uniqueDepts].map(opt => {
                    const isActive = filterDept === opt;
                    const col = DEPT_COLORS[opt];
                    return (
                      <button
                        key={opt}
                        onClick={() => setFilterDept(opt)}
                        className={`${styles.pill} ${isActive ? styles.pillActive : ''}`}
                        style={isActive && col ? {
                          background: col.bg,
                          borderColor: col.border,
                          color: col.text,
                        } : undefined}
                      >
                        {opt === 'all' ? 'All' : capitalize(opt)}
                      </button>
                    );
                  })}
                </div>

                {/* Divider */}
                <span className={styles.pillDivider} />

                {/* Module group */}
                <div className={styles.pillGroup}>
                  <span className={styles.pillSectionLabel}>Module</span>
                  {['all', ...activeModules].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setFilterModule(opt)}
                      className={`${styles.pill} ${filterModule === opt ? styles.pillActive : ''}`}
                    >
                      {opt === 'all' ? 'All' : capitalize(opt)}
                    </button>
                  ))}
                </div>

                {/* Clear active filters */}
                {hasActiveFilter && (
                  <button
                    className={styles.clearBtn}
                    onClick={() => { setFilterDept('all'); setFilterModule('all'); setFilterAuthor(''); }}
                    title="Clear all filters"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Commit list ──────────────────────────────────────────── */}
        {loading ? (
          <div className={styles.commitList}>
            {Array.from({ length: 8 }).map((_, i) => <CommitSkeleton key={i} />)}
          </div>
        ) : noRepos ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.01" y1="12" x2="22.96" y2="12"/>
              </svg>
            </div>
            <p className={styles.emptyTitle}>No repositories connected</p>
            <p className={styles.emptySubtitle}>
              Connect a GitHub repository in Settings to start tracking commits.
            </p>
            <Link href="/settings" className={styles.emptyAction}>Go to Settings →</Link>
          </div>
        ) : displayed.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No commits match these filters</p>
            <p className={styles.emptySubtitle}>Try adjusting the filters above.</p>
            <button
              className={styles.emptyAction}
              onClick={() => { setFilterDept('all'); setFilterModule('all'); setFilterAuthor(''); }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className={styles.commitList}>
            {displayed.map((commit) => (
              <div
                key={commit.id}
                className={styles.commitCard}
                onClick={() => handleCommitClick(commit)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCommitClick(commit); }}
              >
                {/* Author avatar */}
                <div className={styles.avatarCol}>
                  {commit.authorAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={commit.authorAvatar} alt={commit.author} className={styles.avatar} />
                  ) : (
                    <div className={styles.avatarInitials}>{getInitials(commit.author)}</div>
                  )}
                </div>

                {/* Main content */}
                <div className={styles.commitContent}>
                  <p className={styles.commitMessage}>
                    {commit.message.split('\n')[0]}
                  </p>
                  <div className={styles.commitMeta}>
                    <span className={styles.metaAuthor}>{commit.authorLogin ?? commit.author}</span>
                    <span className={styles.metaSep}>·</span>
                    <span className={styles.metaTime}>{timeAgo(commit.date)}</span>
                    {commit.branch && (
                      <>
                        <span className={styles.metaSep}>·</span>
                        <span className={styles.branchTag}>
                          <GitBranchIcon />
                          {commit.branch}
                        </span>
                      </>
                    )}
                    {commit.source === 'webhook' && (
                      <span className={styles.webhookTag}>webhook</span>
                    )}
                    {/* Inline classification chips — right in the meta row */}
                    {commit.department?.filter(d => d !== 'unclassified').map(d => {
                      const col = deptStyle(d);
                      return (
                        <span key={d} className={styles.inlineChip}
                          style={{ background: col.bg, borderColor: col.border, color: col.text }}>
                          {capitalize(d)}
                        </span>
                      );
                    })}
                    {commit.module?.filter(m => m !== 'unclassified').map(m => (
                      <span key={m} className={`${styles.inlineChip} ${styles.moduleChip}`}>
                        {capitalize(m)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* SHA */}
                <div className={styles.shaCol}>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.shaLink}
                    title={commit.sha}
                    onClick={e => e.stopPropagation()}
                  >
                    <code>{commit.shortSha ?? commit.sha.slice(0, 7)}</code>
                    <ExternalIcon />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </MainLayout>
  );
}

