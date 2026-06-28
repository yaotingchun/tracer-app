'use client';

import { useState, useEffect } from 'react';
import MainLayout  from '@/components/layout/MainLayout';
import RepoConnector from '@/components/settings/RepoConnector';
import RepoList    from '@/components/settings/RepoList';
import styles      from './settings.module.css';

export default function SettingsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <MainLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Settings</h1>
            <p className={styles.subtitle}>
              Manage your connected GitHub repositories and integrations.
            </p>
          </div>
          <div className={styles.webhookBadge}>
            <span className={styles.webhookDot} />
            <span className={styles.webhookText}>
              Webhook: <code>POST /api/github/webhook</code>
            </span>
          </div>
        </div>

        <div className={styles.layout}>
          {/* Left column — connector form */}
          <section className={styles.section} aria-labelledby="connect-heading">
            <h2 id="connect-heading" className={styles.sectionTitle}>Connect Repository</h2>
            <RepoConnector onConnected={() => setRefreshKey(k => k + 1)} />
          </section>

          {/* Right column — repo list */}
          <section className={styles.section} aria-labelledby="repos-heading">
            <h2 id="repos-heading" className={styles.sectionTitle}>Connected Repositories</h2>
            <RepoList refreshTrigger={refreshKey} />
          </section>
        </div>

        {/* Webhook info box */}
        <section className={styles.infoBox} aria-labelledby="webhook-heading">
          <h2 id="webhook-heading" className={styles.infoTitle}>GitHub Webhook Setup</h2>
          <p className={styles.infoText}>
            To receive real-time commit and PR events, add a webhook to your GitHub repository:
          </p>
          <ol className={styles.infoList}>
            <li>Go to your repository → <strong>Settings</strong> → <strong>Webhooks</strong> → <strong>Add webhook</strong></li>
            <li>Set <strong>Payload URL</strong> to your deployed domain: <code>{mounted ? window.location.origin : 'https://your-domain.com'}/api/github/webhook</code></li>
            <li>Set <strong>Content type</strong> to <code>application/json</code></li>
            <li>Select events: <code>push</code>, <code>pull_request</code>, <code>create</code>, <code>delete</code></li>
            <li>Click <strong>Add webhook</strong></li>
          </ol>
          <div className={styles.supportedEvents}>
            {['push', 'pull_request', 'create', 'delete'].map(e => (
              <span key={e} className={styles.eventChip}>{e}</span>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
