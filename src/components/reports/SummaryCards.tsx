'use client';

import { useEffect, useState } from 'react';
import { summaryStats } from '@/lib/reportsData';
import styles from './reports.module.css';

interface StatCard {
  id: string;
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  subLabel?: string;
}

function AnimatedNumber({ target }: { target: number }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target]);
  return <>{current.toLocaleString()}</>;
}

const CommitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <line x1="1.05" y1="12" x2="7" y2="12"/>
    <line x1="17" y1="12" x2="22.95" y2="12"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const NetworkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
    <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
  </svg>
);

const TeamIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const ZapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

export default function SummaryCards() {
  const cards: StatCard[] = [
    {
      id: 'total-commits',
      label: 'Total Commits Analyzed',
      value: summaryStats.totalCommits,
      icon: <CommitIcon />,
      accent: '#3b82f6',
      subLabel: 'This sprint',
    },
    {
      id: 'high-risk',
      label: 'High Risk Changes',
      value: summaryStats.highRiskChanges,
      icon: <ShieldIcon />,
      accent: '#ef4444',
      subLabel: 'Require review',
    },
    {
      id: 'cross-team',
      label: 'Cross-Team Impacts',
      value: summaryStats.crossTeamImpacts,
      icon: <NetworkIcon />,
      accent: '#8b5cf6',
      subLabel: 'Propagated changes',
    },
    {
      id: 'most-affected',
      label: 'Most Affected Team',
      value: summaryStats.mostAffectedTeam,
      icon: <TeamIcon />,
      accent: '#f59e0b',
      subLabel: '18 inbound impacts',
    },
    {
      id: 'most-impactful',
      label: 'Most Impactful Module',
      value: summaryStats.mostImpactfulModule,
      icon: <ZapIcon />,
      accent: '#22c55e',
      subLabel: '28 cross-team effects',
    },
  ];

  return (
    <div className={styles.summaryGrid} role="region" aria-label="Report summary statistics">
      {cards.map((card, i) => (
        <div
          key={card.id}
          id={card.id}
          className={styles.summaryCard}
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className={styles.summaryCardIcon} style={{ color: card.accent, background: `${card.accent}18` }}>
            {card.icon}
          </div>
          <div className={styles.summaryCardBody}>
            <div className={styles.summaryCardValue} style={{ color: card.accent }}>
              {typeof card.value === 'number'
                ? <AnimatedNumber target={card.value} />
                : card.value
              }
            </div>
            <div className={styles.summaryCardLabel}>{card.label}</div>
            {card.subLabel && <div className={styles.summaryCardSub}>{card.subLabel}</div>}
          </div>
          <div className={styles.summaryCardGlow} style={{ background: `${card.accent}12` }} />
        </div>
      ))}
    </div>
  );
}
