'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MainLayout from '@/components/layout/MainLayout';
import styles from './commits.module.css';

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
}

interface Repo {
  id: string;
  fullName: string;
  status: string;
}

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

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60)       return `${diff}s ago`;
  if (diff < 3600)     return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)    return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000)  return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

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

export default function CommitsPage() {
  const [commits,       setCommits]       = useState<Commit[]>([]);
  const [repos,         setRepos]         = useState<Repo[]>([]);
  const [filterRepo,    setFilterRepo]    = useState<string>('all');
  const [filterAuthor,  setFilterAuthor]  = useState('');
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

  // Client-side author filter
  const displayed = filterAuthor.trim()
    ? commits.filter(c =>
        c.author.toLowerCase().includes(filterAuthor.toLowerCase()) ||
        (c.authorLogin ?? '').toLowerCase().includes(filterAuthor.toLowerCase())
      )
    : commits;

  const noRepos = !loading && repos.length === 0;

  return (
    <MainLayout>
      <div className={styles.page}>
        {/* Page header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Commits</h1>
            <p className={styles.subtitle}>Real-time Git commit analysis across all repositories.</p>
          </div>
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            <span className={styles.liveText}>Live</span>
            {liveCount > 0 && (
              <span className={styles.newBadge}>+{liveCount} new</span>
            )}
          </div>
        </div>

        {/* Filters */}
        {!noRepos && (
          <div className={styles.filters}>
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
              placeholder="Filter by author…"
              value={filterAuthor}
              onChange={e => setFilterAuthor(e.target.value)}
            />
            <span className={styles.countBadge}>
              {displayed.length} commit{displayed.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Content */}
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
            <Link href="/settings" className={styles.emptyAction}>
              Go to Settings →
            </Link>
          </div>
        ) : displayed.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No commits found</p>
            <p className={styles.emptySubtitle}>
              {filterAuthor ? 'No commits match this author filter.' : 'Sync your repository to fetch commits.'}
            </p>
          </div>
        ) : (
          <div className={styles.commitList}>
            {displayed.map((commit) => (
              <div key={commit.id} className={styles.commitCard}>
                {/* Author avatar */}
                <div className={styles.avatarCol}>
                  {commit.authorAvatar ? (
                    <img
                      src={commit.authorAvatar}
                      alt={commit.author}
                      className={styles.avatar}
                    />
                  ) : (
                    <div className={styles.avatarInitials}>
                      {getInitials(commit.author)}
                    </div>
                  )}
                </div>

                {/* Main content */}
                <div className={styles.commitContent}>
                  <p className={styles.commitMessage}>
                    {commit.message.split('\n')[0]}
                  </p>
                  {commit.message.includes('\n') && (
                    <p className={styles.commitBody}>
                      {commit.message.split('\n').slice(1).join(' ').trim().slice(0, 120)}…
                    </p>
                  )}
                  <div className={styles.commitMeta}>
                    <span className={styles.metaAuthor}>
                      {commit.authorLogin ?? commit.author}
                    </span>
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
                  </div>
                </div>

                {/* SHA + link */}
                <div className={styles.shaCol}>
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.shaLink}
                    title={commit.sha}
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
