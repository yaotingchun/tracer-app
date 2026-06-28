'use client';

import styles from './reports.module.css';

interface AIInsightBannerProps {
  text: string;
  icon?: string;
}

export default function AIInsightBanner({ text, icon = '✦' }: AIInsightBannerProps) {
  return (
    <div className={styles.aiBanner} role="note" aria-label="AI Insight">
      <span className={styles.aiBannerIcon}>{icon}</span>
      <div className={styles.aiBannerContent}>
        <span className={styles.aiBannerLabel}>AI Insight</span>
        <p className={styles.aiBannerText}>{text}</p>
      </div>
    </div>
  );
}
