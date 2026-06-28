'use client';

import { useState } from 'react';
import {
  TEAMS, MODULES,
  teamMatrix, teamMatrixStats, teamMatrixInsight,
  moduleMatrix, moduleMatrixInsight,
  type Team, type Module,
} from '@/lib/reportsData';
import AIInsightBanner from './AIInsightBanner';
import styles from './reports.module.css';

type MatrixView = 'team' | 'module';

function heatStyle(value: number | null, max: number): { background: string; color: string; border?: string } {
  if (value === null) return { background: 'transparent', color: 'transparent' };
  if (value === 0) return { background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' };
  
  const intensity = value / max;
  if (intensity > 0.7) {
    return {
      background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(225, 29, 72, 0.10) 100%)',
      color: '#e11d48',
      border: '1px solid rgba(239, 68, 68, 0.25)',
    };
  }
  if (intensity > 0.4) {
    return {
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.14) 0%, rgba(217, 119, 6, 0.08) 100%)',
      color: '#d97706',
      border: '1px solid rgba(245, 158, 11, 0.25)',
    };
  }
  return {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.06) 100%)',
    color: '#2563eb',
    border: '1px solid rgba(59, 130, 246, 0.2)',
  };
}

export default function TeamImpactMatrix() {
  const [view, setView] = useState<MatrixView>('team');
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null);

  const rows    = view === 'team' ? TEAMS     : MODULES;
  const cols    = view === 'team' ? TEAMS     : MODULES;
  const matrix  = view === 'team' ? teamMatrix : moduleMatrix;
  const insight = view === 'team' ? teamMatrixInsight : moduleMatrixInsight;

  // Find max value for heat scaling
  let maxVal = 1;
  rows.forEach(r => {
    cols.forEach(c => {
      const v = (matrix as Record<string, Record<string, number | null>>)[r][c];
      if (v !== null && v > maxVal) maxVal = v;
    });
  });

  return (
    <div className={styles.reportCard} id="report-team-impact-matrix">
      <div className={styles.reportCardHeader}>
        <div>
          <h2 className={styles.reportCardTitle}>Cross-Team Impact Matrix</h2>
          <p className={styles.reportCardSubtitle}>
            Directional change impact between {view === 'team' ? 'engineering teams' : 'product modules'} — rows are source, columns are target.
          </p>
        </div>
        <div className={styles.matrixToggle} role="group" aria-label="Matrix view toggle">
          <button
            id="matrix-toggle-team"
            className={`${styles.matrixToggleBtn} ${view === 'team' ? styles.matrixToggleBtnActive : ''}`}
            onClick={() => setView('team')}
          >
            Team
          </button>
          <button
            id="matrix-toggle-module"
            className={`${styles.matrixToggleBtn} ${view === 'module' ? styles.matrixToggleBtnActive : ''}`}
            onClick={() => setView('module')}
          >
            Module
          </button>
        </div>
      </div>

      <div className={styles.matrixWrapper}>
        <div className={styles.matrixScroll}>
          <table className={styles.matrixTable} aria-label={`${view} impact matrix`}>
            <thead>
              <tr>
                <th className={styles.matrixCorner}>
                  <span className={styles.matrixAxisLabel}>Source ↓ / Target →</span>
                </th>
                {cols.map(col => {
                  const isHovered = hoveredCell?.col === col;
                  return (
                    <th
                      key={col}
                      className={`${styles.matrixColHead} ${isHovered ? styles.matrixColHeadActive : ''}`}
                    >
                      {col}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const isRowHovered = hoveredCell?.row === row;
                return (
                  <tr key={row}>
                    <td className={`${styles.matrixRowHead} ${isRowHovered ? styles.matrixRowHeadActive : ''}`}>
                      {row}
                    </td>
                    {cols.map(col => {
                      const val = (matrix as Record<string, Record<string, number | null>>)[row][col];
                      const isDiag = row === col;
                      const styleInfo = isDiag ? { background: 'var(--color-surface-1)', color: 'var(--color-text-muted)' } : heatStyle(val, maxVal);
                      const isCurrentHovered = hoveredCell?.row === row && hoveredCell?.col === col;

                      return (
                        <td
                          key={col}
                          className={`${styles.matrixCell} ${isDiag ? styles.matrixCellDiag : ''} ${isCurrentHovered ? styles.matrixCellHovered : ''}`}
                          style={{
                            background: styleInfo.background,
                            color: styleInfo.color,
                            border: styleInfo.border || undefined,
                          }}
                          onMouseEnter={() => !isDiag && setHoveredCell({ row, col })}
                          onMouseLeave={() => setHoveredCell(null)}
                          title={isDiag ? '—' : val === null ? '—' : `${row} → ${col}: ${val} impacts`}
                        >
                          {isDiag ? (
                            <span className={styles.matrixDiagDash}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" style={{ opacity: 0.18 }}>
                                <line x1="4" y1="20" x2="20" y2="4"/>
                              </svg>
                            </span>
                          ) : (
                            val === 0 ? <span style={{ opacity: 0.4 }}>0</span> : val
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.matrixLegend}>
        <span className={styles.matrixLegendItem}>
          <span className={styles.matrixLegendDot} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }} /> Low (1-4)
        </span>
        <span className={styles.matrixLegendItem}>
          <span className={styles.matrixLegendDot} style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }} /> Medium (5-11)
        </span>
        <span className={styles.matrixLegendItem}>
          <span className={styles.matrixLegendDot} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #e11d48 100%)' }} /> High (12+)
        </span>
      </div>

      {/* Stats row */}
      {view === 'team' && (
        <div className={styles.matrixStatsGrid}>
          <div className={styles.matrixStatCard}>
            <div className={styles.matrixStatCardLabel}>Total Interactions</div>
            <div className={styles.matrixStatCardValue}>{teamMatrixStats.totalInteractions}</div>
            <div className={styles.matrixStatCardSub}>Across all teams this sprint</div>
          </div>
          <div className={styles.matrixStatCard}>
            <div className={styles.matrixStatCardLabel}>Highest Outbound Impact</div>
            <div className={styles.matrixStatCardValue} style={{ color: '#ef4444' }}>{teamMatrixStats.highestImpactTeam}</div>
            <div className={styles.matrixStatCardSub}>33 outbound change incidents</div>
          </div>
          <div className={styles.matrixStatCard}>
            <div className={styles.matrixStatCardLabel}>Most Affected (Inbound)</div>
            <div className={styles.matrixStatCardValue} style={{ color: '#f59e0b' }}>{teamMatrixStats.mostAffectedTeam}</div>
            <div className={styles.matrixStatCardSub}>18 inbound change disruptions</div>
          </div>
        </div>
      )}
      <AIInsightBanner text={insight} />
    </div>
  );
}
