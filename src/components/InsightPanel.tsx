'use client';

import { useState, useEffect } from 'react';
import styles from './InsightPanel.module.css';
import type { InsightResult } from '@/lib/aiInsight';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  sha: string;
  repoId: string;
  /** Pass true once commit-files data has loaded — triggers auto-analysis */
  commitFilesLoaded: boolean;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', flexShrink: 0 }}
  >
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── Risk badge ────────────────────────────────────────────────────────────────

const RISK_CONFIG = {
  LOW:      { label: 'LOW RISK',   cls: styles.riskLow,      icon: '✓' },
  MEDIUM:   { label: 'MED RISK',   cls: styles.riskMedium,   icon: '⚠' },
  CRITICAL: { label: 'CRITICAL',   cls: styles.riskCritical, icon: '🔴' },
};

function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'CRITICAL' }) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG.LOW;
  return (
    <span className={`${styles.riskBadge} ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Dependency chain visualisation ────────────────────────────────────────────

function DependencyChain({ chain }: { chain: string }) {
  if (!chain) return null;
  const parts = chain.split(/\s*→\s*|\s*->\s*/);
  if (parts.length <= 1) return <span className={styles.chainText}>{chain}</span>;
  return (
    <div className={styles.chainViz}>
      {parts.map((part, i) => (
        <span key={i} className={styles.chainNode}>
          <span className={styles.chainNodeLabel}>{part.trim()}</span>
          {i < parts.length - 1 && (
            <span className={styles.chainArrow}>
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="0" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="1.5"/>
                <polyline points="12,2 18,5 12,8" fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Section accordion ─────────────────────────────────────────────────────────

function AgentSection({
  id, icon, title, badge, defaultOpen, children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div className={styles.section} id={id}>
      <button className={styles.sectionHeader} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionTitle}>{title}</span>
        {badge && <span className={styles.sectionBadge}>{badge}</span>}
        <ChevronDown open={open} />
      </button>
      {open && <div className={styles.sectionBody}>{children}</div>}
    </div>
  );
}

// ── Bullet list ───────────────────────────────────────────────────────────────

/** Normalize any value the AI might return to a displayable string */
function normalizeItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item === null || item === undefined) return '';
  if (typeof item === 'object') {
    const o = item as Record<string, unknown>;
    // Common AI patterns
    if (typeof o.team === 'string' && typeof o.reason === 'string') return `${o.team} — ${o.reason}`;
    if (typeof o.team === 'string')  return o.team;
    if (typeof o.name === 'string')  return o.name;
    if (typeof o.action === 'string') return o.action;
    if (typeof o.test === 'string')  return o.test;
    if (typeof o.step === 'string')  return o.step;
    // Fallback: join all string values
    const vals = Object.values(o).filter(v => typeof v === 'string') as string[];
    return vals.join(' — ');
  }
  return String(item);
}

function BulletList({ items, emptyText }: { items: unknown[]; emptyText: string }) {
  if (!items || items.length === 0) {
    return <p className={styles.emptyText}>{emptyText}</p>;
  }
  return (
    <ul className={styles.bulletList}>
      {items.map((raw, i) => {
        const text = normalizeItem(raw);
        if (!text) return null;
        return (
          <li key={i} className={styles.bulletItem}>
            <span className={styles.bullet}>›</span>
            <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Layer chips ───────────────────────────────────────────────────────────────

function LayerChips({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className={styles.layerRow}>
      <span className={styles.layerLabel} style={{ color }}>{label}</span>
      <div className={styles.layerChips}>
        {items.map((item, i) => (
          <span key={i} className={styles.layerChip} style={{ borderColor: color + '40', background: color + '0d', color }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Team badges ───────────────────────────────────────────────────────────────

function TeamBadge({ team }: { team: string }) {
  return <span className={styles.teamBadge}>{team}</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function InsightPanel({ sha, repoId, commitFilesLoaded }: Props) {
  const [insight, setInsight]     = useState<InsightResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const [triggered, setTriggered] = useState(false);

  const STEPS = [
    'Change Understanding Agent…',
    'Dependency Analysis Agent…',
    'Impact Prediction Agent…',
    'Recommendation Agent…',
    'Generating summary…',
  ];

  // Try to load cached insight first
  useEffect(() => {
    let cancelled = false;
    async function tryCache() {
      const res = await fetch(`/api/github/analyze?sha=${sha}`);
      if (!cancelled && res.ok) {
        const data = await res.json();
        setInsight(data as InsightResult);
      }
    }
    tryCache();
    return () => { cancelled = true; };
  }, [sha]);

  // Auto-trigger analysis once commit files are loaded (and no cached insight yet)
  useEffect(() => {
    if (!commitFilesLoaded || insight || triggered || loading) return;
    setTriggered(true);
    triggerAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitFilesLoaded, insight]);

  const triggerAnalysis = async () => {
    setLoading(true);
    setError(null);
    setStep(0);

    // Animate through steps while waiting
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setStep(i + 1), i * 3500)
    );

    try {
      const res = await fetch('/api/github/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha, repoId }),
      });
      timers.forEach(clearTimeout);

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setInsight(data as InsightResult);
    } catch (e) {
      timers.forEach(clearTimeout);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.panel} id="ai-insight-panel">
        <div className={styles.panelHeader}>
          <span className={styles.panelIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
              <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
            </svg>
          </span>
          <span className={styles.panelTitle}>AI Insight</span>
          <span className={styles.generatingBadge}>Generating…</span>
        </div>
        <div className={styles.loadingBody}>
          <div className={styles.loadingSpinner}/>
          <div className={styles.loadingSteps}>
            {STEPS.map((label, i) => {
              const done   = step > i + 1;
              const active = step === i + 1;
              return (
                <div key={i} className={`${styles.loadingStep} ${done ? styles.stepDone : ''} ${active ? styles.stepActive : ''}`}>
                  <span className={styles.stepDot}/>
                  <span>{done ? '✓ ' : ''}{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.panel} id="ai-insight-panel">
        <div className={styles.panelHeader}>
          <span className={styles.panelIcon}>🤖</span>
          <span className={styles.panelTitle}>AI Insight</span>
        </div>
        <div className={styles.errorBox}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0}}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
          <button className={styles.retryBtn} onClick={triggerAnalysis}>Retry</button>
        </div>
      </div>
    );
  }

  // ── Not yet triggered ───────────────────────────────────────────────────────
  if (!insight) {
    return (
      <div className={styles.panel} id="ai-insight-panel">
        <div className={styles.panelHeader}>
          <span className={styles.panelIcon}>🤖</span>
          <span className={styles.panelTitle}>AI Insight</span>
          <button className={styles.generateBtn} onClick={triggerAnalysis}>
            Generate Insight
          </button>
        </div>
      </div>
    );
  }

  // ── Full insight ─────────────────────────────────────────────────────────────
  const { changeUnderstanding: a1, dependencyAnalysis: a2, impactPrediction: a3, recommendations: a4 } = insight;

  return (
    <div className={styles.panel} id="ai-insight-panel">
      {/* Panel header */}
      <div className={styles.panelHeader}>
        <span className={styles.panelIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
            <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
          </svg>
        </span>
        <span className={styles.panelTitle}>AI Insight</span>
        <RiskBadge level={insight.riskLevel} />
        <span className={styles.generatedAt}>Generated {new Date(insight.generatedAt).toLocaleTimeString()}</span>
        <button className={styles.regenBtn} onClick={() => { setInsight(null); setTriggered(false); triggerAnalysis(); }} title="Regenerate">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* Summary strip */}
      <div className={`${styles.summaryStrip} ${styles[`summary${insight.riskLevel}`]}`}>
        <p className={styles.summaryLine1}>{insight.summaryLine1}</p>
        <p className={styles.summaryLine2}>{insight.summaryLine2}</p>
      </div>

      {/* Agent sections */}
      <div className={styles.sections}>

        {/* Agent 1 — Change Understanding */}
        <AgentSection
          id="section-change-understanding"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
          title="Change Understanding"
          badge={a1.type}
          defaultOpen={true}
        >
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Type</span>
              <span className={`${styles.typeBadge} ${styles[`type${a1.type}`]}`}>{a1.type}</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Component</span>
              <span className={styles.fieldValue}>{a1.component}</span>
            </div>
          </div>
          <div className={styles.field} style={{marginTop:'var(--space-3)'}}>
            <span className={styles.fieldLabel}>Business Meaning</span>
            <p className={styles.fieldPara}>{a1.businessMeaning}</p>
          </div>
          <div className={styles.field} style={{marginTop:'var(--space-2)'}}>
            <span className={styles.fieldLabel}>Technical Summary</span>
            <p className={styles.fieldMono}>{a1.technicalSummary}</p>
          </div>
        </AgentSection>

        {/* Agent 2 — Dependency Analysis */}
        <AgentSection
          id="section-dependency-analysis"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M6 9v6"/><path d="M9 6h6"/><path d="M15 18H9"/></svg>}
          title="Dependency Analysis"
          badge={a2.chain ? `${a2.chain.split(/→|->/).length} layers` : undefined}
          defaultOpen={true}
        >
          <DependencyChain chain={a2.chain} />
          <div className={styles.layersGrid}>
            <LayerChips label="Frontend"       items={a2.frontend}       color="#3b82f6" />
            <LayerChips label="Backend"        items={a2.backend}        color="#22c55e" />
            <LayerChips label="Database"       items={a2.database}       color="#f59e0b" />
            <LayerChips label="Data Pipeline"  items={a2.dataPipeline}   color="#8b5cf6" />
            <LayerChips label="Shared Svcs"    items={a2.sharedServices} color="#06b6d4" />
          </div>
          {[...a2.frontend, ...a2.backend, ...a2.database, ...a2.dataPipeline, ...a2.sharedServices].length === 0 && (
            <p className={styles.emptyText}>No cross-layer dependencies detected.</p>
          )}
        </AgentSection>

        {/* Agent 3 — Impact Prediction */}
        <AgentSection
          id="section-impact-prediction"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          title="Impact Prediction"
          badge={`${a3.affectedTeams.length} team${a3.affectedTeams.length !== 1 ? 's' : ''}`}
          defaultOpen={true}
        >
          {a3.affectedTeams.length > 0 && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Affected Teams</span>
              <div className={styles.teamRow}>
                {a3.affectedTeams.map(t => <TeamBadge key={t} team={t} />)}
              </div>
            </div>
          )}

          <div className={styles.impactGrid}>
            {a3.potentialFailures.length > 0 && (
              <div>
                <span className={styles.fieldLabel} style={{color:'#dc2626'}}>⚠ Potential Failures</span>
                <BulletList items={a3.potentialFailures} emptyText="None identified" />
              </div>
            )}
            {a3.productionRisks.length > 0 && (
              <div>
                <span className={styles.fieldLabel} style={{color:'#ea580c'}}>🔥 Production Risks</span>
                <BulletList items={a3.productionRisks} emptyText="None identified" />
              </div>
            )}
          </div>

          {a3.requiredActions.length > 0 && (
            <div style={{marginTop:'var(--space-3)'}}>
              <span className={styles.fieldLabel}>Required Actions</span>
              <BulletList items={a3.requiredActions} emptyText="No actions required" />
            </div>
          )}

          <div className={styles.riskReasoningBox}>
            <span className={styles.fieldLabel}>Risk Reasoning</span>
            <p className={styles.riskReasoningText}>{a3.riskReasoning}</p>
          </div>
        </AgentSection>

        {/* Agent 4 — Recommendations */}
        <AgentSection
          id="section-recommendations"
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
          title="Recommendations"
          defaultOpen={true}
        >
          {a4.priorityActions.length > 0 && (
            <div className={styles.priorityBox}>
              <span className={styles.fieldLabel}>⚡ Priority Actions</span>
              <ol className={styles.priorityList}>
                {a4.priorityActions.map((action, i) => (
                  <li key={i} className={styles.priorityItem}>
                    <span className={styles.priorityNum}>{i + 1}</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className={styles.recGrid}>
            <div>
              <span className={styles.fieldLabel}>🧪 Required Tests</span>
              <BulletList items={a4.requiredTests} emptyText="No specific tests required" />
            </div>
            <div>
              <span className={styles.fieldLabel}>📣 Notify Teams</span>
              <BulletList items={a4.teamsToNotify} emptyText="No notifications needed" />
            </div>
          </div>

          {a4.rollbackSuggestions.length > 0 && (
            <div style={{marginTop:'var(--space-3)'}}>
              <span className={styles.fieldLabel}>↩ Rollback Plan</span>
              <BulletList items={a4.rollbackSuggestions} emptyText="Standard git revert" />
            </div>
          )}
        </AgentSection>

      </div>
    </div>
  );
}
