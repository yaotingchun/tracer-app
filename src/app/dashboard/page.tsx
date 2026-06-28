'use client';

import { useEffect, useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import styles from './dashboard.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Commit {
  id: string;
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authorLogin: string | null;
  date: string;
  url: string;
  branch?: string;
  repoId: string;
  department?: string[];
  module?: string[];
  aiRiskLevel?: 'LOW' | 'MEDIUM' | 'CRITICAL';
  aiSummaryLine1?: string;
  aiSummaryLine2?: string;
  // Let's type files if present (used to calculate volatility churn)
  relevant_files_count?: number;
}

// ── KPI SVG Icons ─────────────────────────────────────────────────────────────

const ActivityIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

const ShieldCheckIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="m9 11 2 2 4-4"/>
  </svg>
);

const CompassIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
  </svg>
);

const WaveIcon = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 10h20M2 14h20"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string) {
  const now  = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (isNaN(then))    return 'some time ago';
  if (diff < 60)      return 'Just now';
  if (diff < 3600)    return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)   return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function getDotColor(level?: string): string {
  if (level === 'CRITICAL') return 'orange';
  if (level === 'MEDIUM')   return 'purple';
  if (level === 'LOW')      return 'green';
  return 'blue';
}

// ── Skeletons ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.greeting}>
          <div className={`${styles.skeleton} ${styles.skeletonGreetingLabel}`} />
          <div className={`${styles.skeleton} ${styles.skeletonGreetingTitle}`} />
        </div>
      </div>
      <div className={styles['kpi-grid']}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={styles['kpi-card']}>
            <div className={styles['kpi-header']}>
              <div className={`${styles.skeleton} ${styles.skeletonIcon}`} />
            </div>
            <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
            <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'commits'),
      orderBy('date', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Commit, 'id'>),
      }));
      setCommits(docs);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, []);

  // ── Derived engineering intelligence metrics ────────────────────────────────

  const metrics = useMemo(() => {
    if (commits.length === 0) {
      return {
        readinessIndex: 100,
        blastRadius: '1.0',
        coverage: 0,
        avgChurn: '0.0',
        criticalRisks: 0,
        analyzedCount: 0,
      };
    }

    const analyzedCommits = commits.filter(c => c.aiRiskLevel);
    const criticalRisks   = commits.filter(c => c.aiRiskLevel === 'CRITICAL').length;
    const mediumRisks     = commits.filter(c => c.aiRiskLevel === 'MEDIUM').length;

    // 1. Release Readiness Index: penalize critical & medium risk alerts
    const readinessIndex = Math.max(0, 100 - (criticalRisks * 12 + mediumRisks * 4));

    // 2. System Blast Radius: average departments/modules affected per analyzed commit
    let totalLayers = 0;
    analyzedCommits.forEach(c => {
      const depts = c.department?.filter(d => d !== 'unclassified').length ?? 0;
      const mods  = c.module?.filter(m => m !== 'unclassified').length ?? 0;
      totalLayers += Math.max(1, depts + mods);
    });
    const avgLayersAffected = analyzedCommits.length > 0 
      ? (totalLayers / analyzedCommits.length).toFixed(1)
      : '1.0';

    // 3. AI analysis coverage percentage
    const coverage = Math.round((analyzedCommits.length / commits.length) * 100);

    // 4. Volatility / Churn index (average relevant files touched per commit)
    let totalFilesTouched = 0;
    commits.forEach(c => {
      totalFilesTouched += c.relevant_files_count ?? 3; // fallback default
    });
    const avgChurn = (totalFilesTouched / commits.length).toFixed(1);

    return {
      readinessIndex,
      blastRadius: avgLayersAffected,
      coverage,
      avgChurn,
      criticalRisks,
      analyzedCount: analyzedCommits.length,
    };
  }, [commits]);

  const recentCommits = commits.slice(0, 4);

  const activeRisks = useMemo(() => {
    return commits
      .filter(c => c.aiRiskLevel === 'CRITICAL' || c.aiRiskLevel === 'MEDIUM')
      .slice(0, 3)
      .map(c => ({
        id: c.id,
        sha: c.sha,
        repoId: c.repoId,
        level: (c.aiRiskLevel === 'CRITICAL' ? 'high' : 'med') as 'high' | 'med',
        text: c.aiSummaryLine1 || c.message.split('\n')[0],
        subText: c.aiSummaryLine2 || `Change by ${c.author}`,
      }));
  }, [commits]);

  if (loading) {
    return (
      <MainLayout>
        <DashboardSkeleton />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className={styles.page}>
        
        {/* Header Block */}
        <div className={styles.topbar}>
          <div className={styles.greeting}>
            <span className={styles['greeting-label']}>Engineering Intelligence Dashboard</span>
            <h1 className={styles['greeting-title']}>Systems Readiness Overview</h1>
          </div>
          {metrics.criticalRisks > 0 ? (
            <div className={styles.alertPill}>
              <span className={styles.alertDot} />
              {metrics.criticalRisks} Critical Risks Unresolved
            </div>
          ) : (
            <div className={styles['status-pill']}>
              <span className={styles['status-dot']} aria-hidden="true" />
              All components stable
            </div>
          )}
        </div>

        {/* ── HIGH-END METRIC CARDS GRID ──────────────────────────────────────── */}
        <div className={styles['kpi-grid']}>
          
          {/* Card 1: Release Readiness Index */}
          <div className={`${styles['kpi-card']} ${styles.cardReadiness}`}>
            <div className={styles['kpi-header']}>
              <span className={styles['kpi-label']}>Staging Readiness</span>
              <div className={styles.iconBox} style={{ background: 'rgba(34,197,94,0.08)' }}><ShieldCheckIcon color="#22c55e" /></div>
            </div>
            <div className={styles.metricValRow}>
              <span className={styles['kpi-value']}>{metrics.readinessIndex}%</span>
            </div>
            <div className={styles.kpiSubNote}>
              <span>Based on unresolved pipeline warnings</span>
            </div>
          </div>

          {/* Card 2: System Blast Radius */}
          <div className={`${styles['kpi-card']} ${styles.cardBlast}`}>
            <div className={styles['kpi-header']}>
              <span className={styles['kpi-label']}>Avg Change Blast Radius</span>
              <div className={styles.iconBox} style={{ background: 'rgba(249,115,22,0.08)' }}><CompassIcon color="#f97316" /></div>
            </div>
            <div className={styles.metricValRow}>
              <span className={styles['kpi-value']}>{metrics.blastRadius}</span>
              <span className={styles.metricUnit}>layers</span>
            </div>
            <div className={styles.kpiSubNote}>
              <span>Average downstream component cascade size per push</span>
            </div>
          </div>

          {/* Card 3: AI Pipeline Coverage */}
          <div className={`${styles['kpi-card']} ${styles.cardCoverage}`}>
            <div className={styles['kpi-header']}>
              <span className={styles['kpi-label']}>AI Agent Coverage</span>
              <div className={styles.iconBox} style={{ background: 'rgba(124,58,237,0.08)' }}><ActivityIcon color="#7c3aed" /></div>
            </div>
            <div className={styles.metricValRow}>
              <span className={styles['kpi-value']}>{metrics.coverage}%</span>
              <span className={styles.kpiBadgeMini}>
                {metrics.analyzedCount}/{commits.length}
              </span>
            </div>
            <div className={styles.kpiSubNote}>
              <span>Git commits scanned by risk agents in real-time</span>
            </div>
          </div>

          {/* Card 4: Change Volatility */}
          <div className={`${styles['kpi-card']} ${styles.cardVolatility}`}>
            <div className={styles['kpi-header']}>
              <span className={styles['kpi-label']}>Volatility (Churn)</span>
              <div className={styles.iconBox} style={{ background: 'rgba(59,130,246,0.08)' }}><WaveIcon color="#3b82f6" /></div>
            </div>
            <div className={styles.metricValRow}>
              <span className={styles['kpi-value']}>{metrics.avgChurn}</span>
              <span className={styles.metricUnit}>files/commit</span>
            </div>
            <div className={styles.kpiSubNote}>
              <span>Average files touched per engineering checkin</span>
            </div>
          </div>

        </div>

        {/* ── HIGH-END CONTENT GRID ──────────────────────────────────────────── */}
        <div className={styles['content-grid']}>
          
          {/* Activity Feed */}
          <div className={styles.card} id="dashboard-activity">
            <div className={styles['card-header']}>
              <div>
                <span className={styles['card-title']}>Engineering Commits Feed</span>
                <p className={styles.cardSubtitle}>Real-time push verification across projects</p>
              </div>
              <Link href="/commits" className={styles['card-action']}>View commits log →</Link>
            </div>
            <div className={styles['card-body']}>
              {recentCommits.length === 0 ? (
                <div className={styles.emptyFeed}>
                  No recent commit activity found. Connect a repo to start tracking.
                </div>
              ) : (
                <div className={styles['activity-list']}>
                  {recentCommits.map(item => (
                    <div key={item.id} className={styles['activity-item-rich']}>
                      <span
                        className={`${styles.riskIndicatorDot} ${styles[`dot${item.aiRiskLevel || 'NONE'}`]}`}
                        aria-hidden="true"
                      />
                      <div className={styles.activityMain}>
                        <Link href={`/commits/${item.sha}?repoId=${item.repoId}`} className={styles.commitTitleLink}>
                          {item.message.split('\n')[0]}
                        </Link>
                        <div className={styles.activityMetaRow}>
                          <span className={styles.metaUser}>{item.authorLogin || item.author}</span>
                          <span className={styles.metaDot}>·</span>
                          <span className={styles.metaDate}>{timeAgo(item.date)}</span>
                          {item.branch && (
                            <>
                              <span className={styles.metaDot}>·</span>
                              <code className={styles.metaBranch}>{item.branch}</code>
                            </>
                          )}
                        </div>
                      </div>
                      <div className={styles.activityRight}>
                        {item.aiRiskLevel ? (
                          <span className={`${styles.miniRiskBadge} ${styles[`miniBadge${item.aiRiskLevel}`]}`}>
                            {item.aiRiskLevel}
                          </span>
                        ) : (
                          <span className={styles.unanalyzedBadge}>UNSCANNED</span>
                        )}
                        <span className={styles.shortShaCode}>{item.shortSha || item.sha.slice(0, 7)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Risk Panel */}
          <div className={styles.card} id="dashboard-risks">
            <div className={styles['card-header']}>
              <div>
                <span className={styles['card-title']}>Agent Alerts</span>
                <p className={styles.cardSubtitle}>Potential failures detected by AI checks</p>
              </div>
              <Link href="/commits?filterDept=all" className={styles['card-action']}>Filter alerts →</Link>
            </div>
            <div className={styles['card-body']}>
              {activeRisks.length === 0 ? (
                <div className={styles.emptyFeed}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#22c55e', marginBottom: 8 }}>
                    <circle cx="12" cy="12" r="10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  <span>No active warnings detected. Staging ready for release.</span>
                </div>
              ) : (
                <div className={styles['risk-list-premium']}>
                  {activeRisks.map(risk => (
                    <Link href={`/commits/${risk.sha}?repoId=${risk.repoId}`} key={risk.id} className={styles.riskCardLink}>
                      <div className={`${styles.riskCard} ${styles[`riskCard${risk.level}`]}`}>
                        <div className={styles.riskCardTop}>
                          <span className={`${styles.riskLevelTag} ${styles[`riskLevelTag${risk.level}`]}`}>
                            {risk.level === 'high' ? 'CRITICAL' : 'WARNING'}
                          </span>
                          <span className={styles.riskSha}>{risk.sha.slice(0, 7)}</span>
                        </div>
                        <p className={styles.riskTitle}>{risk.text}</p>
                        <p className={styles.riskDesc}>{risk.subText}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </MainLayout>
  );
}
