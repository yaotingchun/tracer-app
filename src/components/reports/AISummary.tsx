'use client';

import {
  aiSummaryWeek,
  aiObservations,
  aiRecommendations,
  aiFutureRisks,
} from '@/lib/reportsData';
import TeamCollabGraph from './TeamCollabGraph';
import styles from './reports.module.css';

const ObservationIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RecommendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const FutureIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

export default function AISummary() {
  return (
    <div className={styles.reportCard} id="report-ai-summary">
      {/* Header */}
      <div className={styles.aiSummaryHeader}>
        <div className={styles.aiSummaryBadge}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          AI-Generated
        </div>
        <div>
          <h2 className={styles.reportCardTitle}>AI Executive Engineering Summary</h2>
          <p className={styles.reportCardSubtitle}>
            Organizational engineering intelligence for the week of <strong>{aiSummaryWeek}</strong>
          </p>
        </div>
      </div>

      <div className={styles.aiSummaryGrid}>
        {/* Observations */}
        <div className={styles.aiSummarySection} id="ai-observations">
          <div className={styles.aiSummarySectionHead} style={{ color: '#60a5fa' }}>
            <ObservationIcon />
            Key Observations
          </div>
          <ul className={styles.aiSummaryList}>
            {aiObservations.map((obs, i) => (
              <li key={i} className={styles.aiSummaryItem} style={{ animationDelay: `${i * 80}ms` }}>
                <span className={styles.aiSummaryBullet} style={{ background: '#3b82f620', color: '#60a5fa' }}>•</span>
                {obs}
              </li>
            ))}
          </ul>
        </div>

        {/* Recommendations */}
        <div className={styles.aiSummarySection} id="ai-recommendations">
          <div className={styles.aiSummarySectionHead} style={{ color: '#22c55e' }}>
            <RecommendIcon />
            Recommendations
          </div>
          <ul className={styles.aiSummaryList}>
            {aiRecommendations.map((rec, i) => (
              <li key={i} className={styles.aiSummaryItem} style={{ animationDelay: `${i * 80}ms` }}>
                <span className={styles.aiSummaryBullet} style={{ background: '#22c55e20', color: '#22c55e' }}>✓</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>

        {/* Future Risks */}
        <div className={styles.aiSummarySection} id="ai-future-risks">
          <div className={styles.aiSummarySectionHead} style={{ color: '#f59e0b' }}>
            <FutureIcon />
            Potential Future Risks
          </div>
          <ul className={styles.aiSummaryList}>
            {aiFutureRisks.map((risk, i) => (
              <li key={i} className={styles.aiSummaryItem} style={{ animationDelay: `${i * 80}ms` }}>
                <span className={styles.aiSummaryBullet} style={{ background: '#f59e0b20', color: '#f59e0b' }}>⚠</span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Team Collab Graph */}
      <TeamCollabGraph />
    </div>
  );
}
