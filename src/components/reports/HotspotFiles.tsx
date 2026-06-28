'use client';

import { hotspotModules, hotspotFiles, hotspotInsight } from '@/lib/reportsData';
import AIInsightBanner from './AIInsightBanner';
import styles from './reports.module.css';

const RISK_CONFIG = {
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'HIGH'   },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'MEDIUM' },
  LOW:    { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'LOW'    },
};

function RiskBadge({ level }: { level: 'HIGH' | 'MEDIUM' | 'LOW' }) {
  const cfg = RISK_CONFIG[level];
  return (
    <span className={styles.riskBadge} style={{ color: cfg.color, background: cfg.bg, borderColor: `${cfg.color}30` }}>
      {cfg.label}
    </span>
  );
}

function ImpactBar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const color = pct > 70 ? '#ef4444' : pct > 40 ? '#f59e0b' : '#3b82f6';
  return (
    <div className={styles.impactBarWrap} title={`${value} cross-team impacts`}>
      <div className={styles.impactBar}>
        <div
          className={styles.impactBarFill}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className={styles.impactBarValue} style={{ color }}>{value}</span>
    </div>
  );
}

export default function HotspotFiles() {
  const maxImpact = Math.max(...hotspotModules.map(m => m.crossTeamImpact));

  return (
    <div className={styles.reportCard} id="report-hotspot-files">
      <div className={styles.reportCardHeader}>
        <div>
          <h2 className={styles.reportCardTitle}>Engineering Hotspots</h2>
          <p className={styles.reportCardSubtitle}>
            Modules and files creating the highest cross-team impact this sprint.
          </p>
        </div>
      </div>

      {/* Module table */}
      <div className={styles.tableWrap}>
        <table className={styles.dataTable} aria-label="Hotspot modules">
          <thead>
            <tr>
              <th>Module</th>
              <th>Commits</th>
              <th>Cross-Team Impact</th>
              <th>Risk</th>
            </tr>
          </thead>
          <tbody>
            {hotspotModules.map((mod, i) => (
              <tr key={mod.name} style={{ animationDelay: `${i * 60}ms` }} className={styles.tableRow}>
                <td>
                  <div className={styles.moduleName}>
                    <span className={styles.moduleRank}>#{i + 1}</span>
                    {mod.name}
                  </div>
                </td>
                <td>
                  <span className={styles.commitCount}>{mod.commits}</span>
                </td>
                <td>
                  <ImpactBar value={mod.crossTeamImpact} max={maxImpact} />
                </td>
                <td>
                  <RiskBadge level={mod.risk} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Most impacted files */}
      <div className={styles.sectionDivider}>
        <span className={styles.sectionDividerLabel}>Most Impacted Files</span>
      </div>

      <div className={styles.fileList}>
        {hotspotFiles.map((file, i) => {
          const riskColor = file.avgRiskScore > 80 ? '#ef4444' : file.avgRiskScore > 60 ? '#f59e0b' : '#22c55e';
          return (
            <div
              key={file.path}
              className={styles.fileCard}
              style={{ animationDelay: `${i * 70}ms` }}
              title={`${file.path} — ${file.impactCount} impacts`}
            >
              <div className={styles.fileCardLeft}>
                <span className={styles.fileIcon}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </span>
                <div>
                  <code className={styles.filePath}>{file.path}</code>
                  <div className={styles.fileTeams}>
                    {file.affectedTeams.map(t => (
                      <span key={t} className={styles.fileTeamBadge}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className={styles.fileCardRight}>
                <div className={styles.fileImpact}>
                  <span className={styles.fileImpactNum}>{file.impactCount}</span>
                  <span className={styles.fileImpactLabel}>impacts</span>
                </div>
                <div className={styles.fileRiskScore} style={{ color: riskColor, borderColor: `${riskColor}30`, background: `${riskColor}10` }}>
                  Risk {file.avgRiskScore}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <AIInsightBanner text={hotspotInsight} />
    </div>
  );
}
