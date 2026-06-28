'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import SummaryCards from '@/components/reports/SummaryCards';
import FilterBar, { type FilterState } from '@/components/reports/FilterBar';
import TeamImpactMatrix from '@/components/reports/TeamImpactMatrix';
import HotspotFiles from '@/components/reports/HotspotFiles';
import DependencyReport from '@/components/reports/DependencyReport';
import HighRiskChanges from '@/components/reports/HighRiskChanges';
import AISummary from '@/components/reports/AISummary';
import styles from '@/components/reports/reports.module.css';

// ── Tab Configuration ──────────────────────────────────────────

type TabId = 'matrix' | 'hotspots' | 'dependencies' | 'risk' | 'ai';

interface Tab {
  id: TabId;
  label: string;
  count?: number;
  icon: React.ReactNode;
}

const MatrixIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const FireIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
  </svg>
);

const NetworkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
    <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

const TABS: Tab[] = [
  { id: 'matrix',       label: 'Impact Matrix',   count: 52, icon: <MatrixIcon />  },
  { id: 'hotspots',     label: 'Hotspots',         count: 5,  icon: <FireIcon />    },
  { id: 'dependencies', label: 'Dependencies',     count: 5,  icon: <NetworkIcon /> },
  { id: 'risk',         label: 'High Risk',        count: 6,  icon: <ShieldIcon />  },
  { id: 'ai',           label: 'AI Summary',                  icon: <StarIcon />    },
];

// ── Skeleton ──────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
        ))}
      </div>
      <div className={`${styles.skeleton} ${styles.skeletonReport}`} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function ReportingPage() {
  const [activeTab, setActiveTab] = useState<TabId>('matrix');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'Last 7 Days',
    repo: 'All Repositories',
    team: 'All Teams',
    riskLevel: 'All Risks',
  });

  // Simulate brief loading state
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <MainLayout>
      <div
        style={{
          padding: '2rem 2rem 3rem',
          maxWidth: '1440px',
          margin: '0 auto',
        }}
      >
        {/* ── Page Header ─────────────────────────────────── */}
        <header className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <h1 className={styles.pageTitle}>
              Engineering <span className={styles.pageTitleAccent}>Reports</span>
            </h1>
            <p className={styles.pageSubtitle}>
              Cross-team impact analysis, risk monitoring, dependency awareness, and AI-generated organizational insights.
            </p>
          </div>
          <div className={styles.pageHeaderBadge}>
            <span className={styles.pageHeaderDot} />
            Live · Last 7 Days
          </div>
        </header>

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            {/* ── Summary Cards ───────────────────────────── */}
            <SummaryCards />

            {/* ── Filter Bar ──────────────────────────────── */}
            <FilterBar filters={filters} onChange={setFilters} />

            {/* ── Report Tabs ─────────────────────────────── */}
            <nav className={styles.reportTabs} aria-label="Report sections" role="tablist">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  className={`${styles.reportTab} ${activeTab === tab.id ? styles.reportTabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`${styles.reportTabNum} ${activeTab === tab.id ? styles.reportTabNumActive : ''}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* ── Report Panels ───────────────────────────── */}
            <div role="tabpanel" id={`tabpanel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
              {activeTab === 'matrix'       && <TeamImpactMatrix />}
              {activeTab === 'hotspots'     && <HotspotFiles />}
              {activeTab === 'dependencies' && <DependencyReport />}
              {activeTab === 'risk'         && <HighRiskChanges />}
              {activeTab === 'ai'           && <AISummary />}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
