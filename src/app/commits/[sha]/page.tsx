'use client';

import { use, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MainLayout from '@/components/layout/MainLayout';
import InsightPanel from '@/components/InsightPanel';
import styles from '../commits.module.css';

interface ChangedFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  content_before: string;
  content_after: string;
  patch?: string;
}

interface CommitFilesResult {
  sha: string;
  owner: string;
  repo: string;
  parentSha: string | null;
  message: string;
  author: string;
  date: string;
  total_files_changed: number;
  relevant_files_count: number;
  changed_files: ChangedFile[];
  fetchedAt: string;
}

const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 200ms ease' }}
  >
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const FileAddedIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
);
const FileModifiedIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="15" x2="15" y2="15"/>
  </svg>
);
const FileRemovedIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="9" y1="14" x2="15" y2="14"/>
  </svg>
);

function statusColor(s: ChangedFile['status']): string {
  if (s === 'added')   return '#22c55e';
  if (s === 'removed') return '#ef4444';
  return '#f59e0b';
}

function statusLabel(s: ChangedFile['status']): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function FileViewer({
  file,
  defaultTab,
}: {
  file: ChangedFile;
  defaultTab: 'diff' | 'after' | 'before';
}) {
  const [tab, setTab] = useState<'diff' | 'before' | 'after'>(defaultTab);

  const FileIcon =
    file.status === 'added'   ? FileAddedIcon   :
    file.status === 'removed' ? FileRemovedIcon :
    FileModifiedIcon;

  const renderContent = () => {
    if (tab === 'diff') {
      if (!file.patch) {
        return (
          <div className={styles.fileViewerEmpty}>
            No diff patch available for this file.
          </div>
        );
      }
      const lines = file.patch.split('\n');
      return (
        <table className={styles.codeTable}>
          <tbody>
            {lines.map((line, i) => {
              let rowClass = styles.codeLine;
              let linePrefix = ' ';
              let content = line;

              if (line.startsWith('+') && !line.startsWith('+++')) {
                rowClass = `${styles.codeLine} ${styles.codeLineAdded}`;
                linePrefix = '+';
                content = line.slice(1);
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                rowClass = `${styles.codeLine} ${styles.codeLineRemoved}`;
                linePrefix = '-';
                content = line.slice(1);
              } else if (line.startsWith('@@')) {
                rowClass = `${styles.codeLine} ${styles.codeLineHeader}`;
                linePrefix = '@@';
              } else if (line.startsWith(' ')) {
                content = line.slice(1);
              }

              return (
                <tr key={i} className={rowClass}>
                  <td className={styles.lineNum}>{linePrefix}</td>
                  <td className={styles.lineContent}><span>{content}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    const content = tab === 'before' ? file.content_before : file.content_after;
    const lines = content.split('\n');
    const isEmpty = content.trim() === '';

    if (isEmpty) {
      return (
        <div className={styles.fileViewerEmpty}>
          {tab === 'before' ? 'No previous version (file was added)' : 'File was removed'}
        </div>
      );
    }

    return (
      <table className={styles.codeTable}>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={styles.codeLine}>
              <td className={styles.lineNum}>{i + 1}</td>
              <td className={styles.lineContent}><span>{line}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className={styles.fileViewer}>
      <div className={styles.fileViewerHeader}>
        <span className={styles.fileViewerName}>
          <FileIcon />
          <code>{file.filename}</code>
        </span>
        <span className={styles.fileStatusBadge} style={{ color: statusColor(file.status), borderColor: statusColor(file.status) + '44', backgroundColor: statusColor(file.status) + '11' }}>
          {statusLabel(file.status)}
        </span>
        <div className={styles.fileTabs}>
          {file.patch && (
            <button
              className={`${styles.fileTab} ${tab === 'diff' ? styles.fileTabActive : ''}`}
              onClick={() => setTab('diff')}
            >
              Diff
            </button>
          )}
          {file.status !== 'added' && (
            <button
              className={`${styles.fileTab} ${tab === 'before' ? styles.fileTabActive : ''}`}
              onClick={() => setTab('before')}
            >
              Before
            </button>
          )}
          {file.status !== 'removed' && (
            <button
              className={`${styles.fileTab} ${tab === 'after' ? styles.fileTabActive : ''}`}
              onClick={() => setTab('after')}
            >
              After
            </button>
          )}
        </div>
      </div>
      <div className={styles.fileViewerBody}>
        {renderContent()}
      </div>
    </div>
  );
}

export default function CommitDetailPage({
  params,
}: {
  params: Promise<{ sha: string }>;
}) {
  const { sha } = use(params);
  const searchParams = useSearchParams();
  const repoIdParam = searchParams.get('repoId');

  const [repoId, setRepoId] = useState<string | null>(repoIdParam);
  const [result, setResult]   = useState<CommitFilesResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [commitFilesLoaded, setCommitFilesLoaded] = useState(false);

  // 1. Resolve repoId if missing from searchParams (by looking up commit in Firestore)
  useEffect(() => {
    if (!repoId) {
      const lookupCommit = async () => {
        try {
          const docRef = doc(db, 'commits', sha);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.repoId) {
              setRepoId(data.repoId);
            } else {
              setError('No repository ID associated with this commit in the database.');
              setLoading(false);
            }
          } else {
            setError('Commit not found in the local database.');
            setLoading(false);
          }
        } catch {
          setError('Failed to query local database for commit metadata.');
          setLoading(false);
        }
      };
      lookupCommit();
    }
  }, [repoId, sha]);

  // 2. Fetch commit details and files once repoId is resolved
  const fetchDetails = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github/commit-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoId, sha }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const data: CommitFilesResult = await res.json();
      setResult(data);
      setCommitFilesLoaded(true);
      if (data.changed_files.length > 0) {
        setExpanded({ [data.changed_files[0].filename]: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [repoId, sha]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetails();
  }, [fetchDetails]);

  const toggle = (filename: string) =>
    setExpanded(prev => ({ ...prev, [filename]: !prev[filename] }));

  return (
    <MainLayout>
      <div className={styles.page}>
        {/* Navigation */}
        <div className={styles.navBar}>
          <Link href="/commits" className={styles.backLink}>
            ← Back to Commits
          </Link>
        </div>

        {/* Header Block */}
        <div className={styles.detailHeaderBlock}>
          <div className={styles.detailHeaderMain}>
            <div className={styles.detailSha}>
              <code>{sha.slice(0, 7)}</code>
            </div>
            <h1 className={styles.detailTitle}>
              {result ? result.message.split('\n')[0] : 'Loading commit message...'}
            </h1>
            {result && result.message.includes('\n') && (
              <p className={styles.detailDesc}>
                {result.message.split('\n').slice(1).join('\n').trim()}
              </p>
            )}
            <div className={styles.detailMeta}>
              {result && (
                <>
                  <span className={styles.detailAuthor}>{result.author}</span>
                  <span className={styles.metaSep}>·</span>
                  <span className={styles.detailTime}>
                    {new Date(result.date).toLocaleString()}
                  </span>
                  <span className={styles.metaSep}>·</span>
                  <span className={styles.detailRepo}>
                    {result.owner}/{result.repo}
                  </span>
                </>
              )}
            </div>
          </div>
          {result && (
            <div className={styles.detailHeaderActions}>
              <a
                href={`https://github.com/${result.owner}/${result.repo}/commit/${sha}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.ghButton}
              >
                <ExternalIcon />
                View on GitHub
              </a>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className={styles.detailBody}>
          {loading && (
            <div className={styles.drawerLoading}>
              <div className={styles.drawerSpinner} />
              <span>Fetching file changes from GitHub…</span>
            </div>
          )}

          {error && (
            <div className={styles.drawerError}>
              <strong>Error:</strong> {error}
              <button className={styles.retryBtn} onClick={fetchDetails}>Retry</button>
            </div>
          )}

          {result && !loading && (
            <>
              {/* Stats Panel */}
              <div className={styles.drawerStats}>
                <span className={styles.statItem}>
                  <strong>{result.total_files_changed}</strong> files changed in commit
                </span>
                <span className={styles.statDivider}>·</span>
                <span className={styles.statItem}>
                  <strong>{result.relevant_files_count}</strong> source files analysed
                </span>
                {result.parentSha && (
                  <>
                    <span className={styles.statDivider}>·</span>
                    <span className={styles.statItem}>
                      parent SHA <code className={styles.parentSha}>{result.parentSha.slice(0, 7)}</code>
                    </span>
                  </>
                )}
              </div>

              {/* AI Insight Panel — auto-triggers 4-agent pipeline */}
              {repoId && (
                <InsightPanel sha={sha} repoId={repoId} commitFilesLoaded={commitFilesLoaded} />
              )}

              {/* Accordion File list */}
              {result.changed_files.length === 0 ? (
                <div className={styles.drawerNoFiles}>
                  <p>No relevant source files in this commit.</p>
                  <p className={styles.drawerNoFilesHint}>
                    This commit only touches configuration, documentation, or binary files.
                  </p>
                </div>
              ) : (
                <div className={styles.fileList}>
                  {result.changed_files.map((f) => (
                    <div key={f.filename} className={styles.fileEntry}>
                      <button
                        className={styles.fileEntryToggle}
                        onClick={() => toggle(f.filename)}
                      >
                        <ChevronIcon open={!!expanded[f.filename]} />
                        <span className={styles.fileEntryName}>
                          {f.filename}
                        </span>
                        <span
                          className={styles.fileEntryStatus}
                          style={{ color: statusColor(f.status) }}
                        >
                          {statusLabel(f.status)}
                        </span>
                        <span className={styles.fileEntryLines}>
                          {f.content_after.split('\n').length} lines
                        </span>
                      </button>
                      {expanded[f.filename] && (
                        <FileViewer
                          file={f}
                          defaultTab={f.patch ? 'diff' : f.status === 'removed' ? 'before' : 'after'}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
