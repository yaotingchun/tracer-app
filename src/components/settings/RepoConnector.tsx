'use client';

import { useState } from 'react';
import styles from './RepoConnector.module.css';

interface VerifiedRepo {
  name: string;
  fullName: string;
  owner: string;
  ownerAvatar: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  stars: number;
  forks: number;
  language: string | null;
  htmlUrl: string;
}

interface Props {
  onConnected: () => void;
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const GithubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

export default function RepoConnector({ onConnected }: Props) {
  const [url,       setUrl]       = useState('');
  const [token,     setToken]     = useState('');
  const [showToken, setShowToken] = useState(false);
  const [step,      setStep]      = useState<'form' | 'verified' | 'saving'>('form');
  const [verified,  setVerified]  = useState<VerifiedRepo | null>(null);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const handleVerify = async () => {
    if (!url.trim() || !token.trim()) {
      setError('Both GitHub URL and Personal Access Token are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/github/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Verification failed'); return; }
      setVerified(data.repo);
      setStep('verified');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!verified) return;
    setStep('saving');
    setLoading(true);
    setError('');
    try {
      // 1. Save repo to Firestore
      const saveRes = await fetch('/api/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...verified, url: url.trim(), token: token.trim() }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok && saveRes.status !== 409) {
        setError(saveData.error ?? 'Failed to save'); setStep('verified'); return;
      }
      const repoId = saveData.repoId;

      // 2. Immediately fetch commits/PRs/branches
      await fetch('/api/github/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId,
          owner: verified.owner,
          repo: verified.name,
          token: token.trim(),
        }),
      });

      // Reset form
      setUrl(''); setToken(''); setVerified(null); setStep('form');
      onConnected();
    } catch {
      setError('Failed to connect repository.'); setStep('verified');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.connector}>
      <div className={styles.connectorHeader}>
        <div className={styles.connectorIcon}><GithubIcon /></div>
        <div>
          <h3 className={styles.connectorTitle}>Connect GitHub Repository</h3>
          <p className={styles.connectorSubtitle}>Paste your repository URL and a Personal Access Token with repo scope.</p>
        </div>
      </div>

      {step === 'form' || step === 'verified' ? (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="repo-url">Repository URL</label>
            <input
              id="repo-url"
              className={styles.input}
              type="url"
              placeholder="https://github.com/owner/repository"
              value={url}
              onChange={e => { setUrl(e.target.value); setStep('form'); setVerified(null); }}
              disabled={loading}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="repo-token">Personal Access Token</label>
            <div className={styles.inputWrapper}>
              <input
                id="repo-token"
                className={styles.input}
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onChange={e => { setToken(e.target.value); setStep('form'); setVerified(null); }}
                disabled={loading}
              />
              <button type="button" className={styles.toggleBtn} onClick={() => setShowToken(p => !p)}>
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className={styles.hint}>
              Requires <code>repo</code> scope. <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer">Create token →</a>
            </p>
          </div>

          {error && <div className={styles.errorAlert}>{error}</div>}

          {step === 'verified' && verified ? (
            <div className={styles.verifiedCard}>
              <div className={styles.verifiedHeader}>
                <CheckIcon />
                <span>Repository verified</span>
              </div>
              <div className={styles.repoMeta}>
                <img src={verified.ownerAvatar} alt={verified.owner} className={styles.repoAvatar} />
                <div>
                  <p className={styles.repoName}>{verified.fullName}</p>
                  {verified.description && <p className={styles.repoDesc}>{verified.description}</p>}
                  <div className={styles.repoTags}>
                    {verified.language && <span className={styles.tag}>{verified.language}</span>}
                    <span className={styles.tag}>{verified.private ? '🔒 Private' : '🌐 Public'}</span>
                    <span className={styles.tag}>⭐ {verified.stars}</span>
                    <span className={styles.tag}>🍴 {verified.forks}</span>
                  </div>
                </div>
              </div>
              <div className={styles.actions}>
                <button className={styles.btnSecondary} onClick={() => { setStep('form'); setVerified(null); }}>
                  Change
                </button>
                <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
                  {loading ? 'Connecting…' : 'Connect & Sync Repository'}
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.btnPrimary}
              onClick={handleVerify}
              disabled={loading || !url || !token}
            >
              {loading ? 'Verifying…' : 'Verify Access'}
            </button>
          )}
        </div>
      ) : (
        <div className={styles.savingState}>
          <div className={styles.spinner} />
          <p>Connecting repository and syncing commits…</p>
        </div>
      )}
    </div>
  );
}
