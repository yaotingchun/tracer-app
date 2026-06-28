'use client';

import { useState } from 'react';
import { riskCommits, riskInsight, type RiskLevel } from '@/lib/reportsData';
import AIInsightBanner from './AIInsightBanner';
import styles from './reports.module.css';

const RISK_CONFIG: Record<RiskLevel, { color: string; bg: string }> = {
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  LOW:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 250ms ease' }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

export default function HighRiskChanges() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className={styles.reportCard} id="report-high-risk-changes">
      <div className={styles.reportCardHeader}>
        <div>
          <h2 className={styles.reportCardTitle}>High Risk Engineering Changes</h2>
          <p className={styles.reportCardSubtitle}>
            Commits with multi-team blast radius. Click any row for AI impact analysis.
          </p>
        </div>
        <div className={styles.riskSummaryBadge}>
          <span className={styles.riskSummaryDot} />
          {riskCommits.filter(c => c.risk === 'HIGH').length} critical changes
        </div>
      </div>

      <div className={styles.riskTable}>
        {riskCommits.map((commit, i) => {
          const cfg = RISK_CONFIG[commit.risk];
          const isExpanded = expandedId === commit.id;
          return (
            <div
              key={commit.id}
              className={`${styles.riskRow} ${isExpanded ? styles.riskRowExpanded : ''}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Main row */}
              <button
                className={styles.riskRowMain}
                id={`risk-commit-${commit.id}`}
                onClick={() => toggle(commit.id)}
                aria-expanded={isExpanded}
                aria-controls={`risk-detail-${commit.id}`}
              >
                <div className={styles.riskRowLeft}>
                  <code className={styles.commitSha} style={{ color: cfg.color }}>
                    {commit.sha}
                  </code>
                  <div className={styles.commitInfo}>
                    <span className={styles.commitMessage}>{commit.message}</span>
                    <div className={styles.commitMeta}>
                      <span className={styles.commitAuthor}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        {commit.author}
                      </span>
                      <span className={styles.commitTimestamp}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {formatTimestamp(commit.timestamp)}
                      </span>
                      <span className={styles.commitTeam}>{commit.team}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.riskRowRight}>
                  <span className={styles.riskBadge} style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}30` }}>
                    {commit.risk}
                  </span>
                  <div className={styles.affectedTeamPills}>
                    {commit.affectedTeams.slice(0, 3).map(t => (
                      <span key={t} className={styles.affectedPill}>{t}</span>
                    ))}
                    {commit.affectedTeams.length > 3 && (
                      <span className={styles.affectedPillMore}>+{commit.affectedTeams.length - 3}</span>
                    )}
                  </div>
                  <ChevronIcon open={isExpanded} />
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className={styles.riskDetail} id={`risk-detail-${commit.id}`}>
                  <div className={styles.riskDetailGrid}>
                    <div className={styles.riskDetailSection}>
                      <span className={styles.riskDetailSectionLabel}>Affected Modules</span>
                      <div className={styles.riskModuleList}>
                        {commit.affectedModules.map(m => (
                          <span key={m} className={styles.riskModulePill}>{m}</span>
                        ))}
                      </div>
                    </div>
                    <div className={styles.riskDetailSection}>
                      <span className={styles.riskDetailSectionLabel}>All Affected Teams</span>
                      <div className={styles.riskModuleList}>
                        {commit.affectedTeams.map(t => (
                          <span key={t} className={styles.fileTeamBadge}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className={styles.riskAIExplain}>
                    <span className={styles.riskAILabel}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      AI Impact Explanation
                    </span>
                    <p className={styles.riskAIText}>{commit.aiExplanation}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AIInsightBanner text={riskInsight} />
    </div>
  );
}
