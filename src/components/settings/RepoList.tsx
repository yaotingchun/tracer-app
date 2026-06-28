'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './RepoList.module.css';

interface Repo {
  id: string;
  fullName: string;
  description: string | null;
  private: boolean;
  language: string | null;
  stars: number;
  forks: number;
  status: string;
  commitCount: number;
  branches: string[];
  contributors: { login: string; avatar: string }[];
  lastSyncedAt: { _seconds: number } | null;
  owner: string;
  ownerAvatar: string;
  htmlUrl: string;
}

interface Props {
  refreshTrigger: number;
}

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);

const SyncIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
  </svg>
);

const ExternalIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

function formatDate(ts: { _seconds: number } | null) {
  if (!ts) return 'Never';
  return new Date(ts._seconds * 1000).toLocaleString();
}

export default function RepoList({ refreshTrigger }: Props) {
  const [repos,   setRepos]   = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/repositories');
      const data = await res.json();
      setRepos(data.repositories ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadRepos(); }, [loadRepos, refreshTrigger]);

  const handleSync = async (repo: Repo) => {
    setSyncing(repo.id);
    try {
      const credRes = await fetch('/api/repositories');
      const credData = await credRes.json();
      const full = credData.repositories?.find((r: Repo) => r.id === repo.id);
      if (!full) return;

      await fetch('/api/github/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: repo.id,
          owner: repo.owner,
          repo: repo.fullName.split('/')[1],
          token: full.token,
        }),
      });
      await loadRepos();
    } catch { /* ignore */ } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this repository? Stored commits will remain.')) return;
    setDeleting(id);
    try {
      await fetch(`/api/repositories/${id}`, { method: 'DELETE' });
      await loadRepos();
    } catch { /* ignore */ } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.spinner} />
        <p>Loading repositories…</p>
      </div>
    );
  }

  if (!repos.length) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/>
          </svg>
        </div>
        <p className={styles.emptyTitle}>No repositories connected</p>
        <p className={styles.emptySubtitle}>Connect your first GitHub repository above to start tracking commits.</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {repos.map(repo => (
        <div key={repo.id} className={styles.repoCard}>
          <div className={styles.repoTop}>
            <div className={styles.repoInfo}>
              <img src={repo.ownerAvatar} alt={repo.owner} className={styles.avatar} />
              <div>
                <div className={styles.repoName}>
                  <a href={repo.htmlUrl} target="_blank" rel="noopener noreferrer" className={styles.repoLink}>
                    {repo.fullName} <ExternalIcon />
                  </a>
                  <span className={`${styles.statusBadge} ${styles[`status--${repo.status}`]}`}>
                    {repo.status}
                  </span>
                </div>
                {repo.description && <p className={styles.repoDesc}>{repo.description}</p>}
              </div>
            </div>
            <div className={styles.repoActions}>
              <button
                className={styles.actionBtn}
                onClick={() => handleSync(repo)}
                disabled={syncing === repo.id}
                title="Re-sync commits"
              >
                <span className={syncing === repo.id ? styles.spinning : ''}><SyncIcon /></span>
                {syncing === repo.id ? 'Syncing…' : 'Sync'}
              </button>
              <button
                className={`${styles.actionBtn} ${styles['actionBtn--danger']}`}
                onClick={() => handleDelete(repo.id)}
                disabled={deleting === repo.id}
                title="Remove repository"
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          <div className={styles.repoStats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{repo.commitCount}</span>
              <span className={styles.statLabel}>Commits</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{repo.branches?.length ?? 0}</span>
              <span className={styles.statLabel}>Branches</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{repo.contributors?.length ?? 0}</span>
              <span className={styles.statLabel}>Contributors</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{repo.stars ?? 0}</span>
              <span className={styles.statLabel}>Stars</span>
            </div>
          </div>

          <div className={styles.repoMeta}>
            {repo.language && <span className={styles.tag}>{repo.language}</span>}
            <span className={styles.tag}>{repo.private ? '🔒 Private' : '🌐 Public'}</span>
            <span className={styles.syncTime}>Last synced: {formatDate(repo.lastSyncedAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
