'use client';

import { dependencyModules, dependencyChain, dependencyStats, dependencyInsight } from '@/lib/reportsData';
import AIInsightBanner from './AIInsightBanner';
import styles from './reports.module.css';

function RippleBar({ value }: { value: number }) {
  const color = value > 80 ? '#ef4444' : value > 60 ? '#f59e0b' : '#3b82f6';
  return (
    <div className={styles.impactBarWrap} title={`Ripple score: ${value}`}>
      <div className={styles.impactBar}>
        <div className={styles.impactBarFill} style={{ width: `${value}%`, background: color }} />
      </div>
      <span className={styles.impactBarValue} style={{ color }}>{value}</span>
    </div>
  );
}

export default function DependencyReport() {
  return (
    <div className={styles.reportCard} id="report-dependency-impact">
      <div className={styles.reportCardHeader}>
        <div>
          <h2 className={styles.reportCardTitle}>Dependency Impact Analysis</h2>
          <p className={styles.reportCardSubtitle}>
            How module changes propagate through the system and affect downstream dependencies.
          </p>
        </div>
      </div>

      <div className={styles.dependencyLayout}>
        {/* Left: table */}
        <div className={styles.dependencyTableCol}>
          <div className={styles.tableWrap}>
            <table className={styles.dataTable} aria-label="Module dependencies">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Dependencies</th>
                  <th>Total Impact</th>
                  <th>Ripple Score</th>
                </tr>
              </thead>
              <tbody>
                {dependencyModules.map((mod, i) => (
                  <tr key={mod.name} className={styles.tableRow} style={{ animationDelay: `${i * 60}ms` }}>
                    <td>
                      <span className={styles.moduleName}>{mod.name}</span>
                    </td>
                    <td>
                      <span className={styles.depCount}>{mod.dependencies}</span>
                    </td>
                    <td>
                      <span className={styles.impactNum}>{mod.totalImpact}</span>
                    </td>
                    <td>
                      <RippleBar value={mod.rippleScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stats */}
          <div className={styles.matrixStats} style={{ marginTop: '1.25rem' }}>
            <div className={styles.matrixStat}>
              <span className={styles.matrixStatValue} style={{ color: '#ef4444' }}>{dependencyStats.mostDependent}</span>
              <span className={styles.matrixStatLabel}>Most Dependent</span>
            </div>
            <div className={styles.matrixStatDivider} />
            <div className={styles.matrixStat}>
              <span className={styles.matrixStatValue} style={{ color: '#f59e0b' }}>{dependencyStats.highestRipple}</span>
              <span className={styles.matrixStatLabel}>Highest Ripple</span>
            </div>
            <div className={styles.matrixStatDivider} />
            <div className={styles.matrixStat}>
              <span className={styles.matrixStatValue} style={{ color: '#3b82f6' }}>{dependencyStats.avgDepth}</span>
              <span className={styles.matrixStatLabel}>Avg Dep Depth</span>
            </div>
          </div>
        </div>

        {/* Right: cascade visualization */}
        <div className={styles.dependencyCascadeCol}>
          <div className={styles.cascadeCard}>
            <div className={styles.cascadeTitle}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Change Propagation Chain
            </div>
            <div className={styles.cascadeChain}>
              {dependencyChain.map((node, i) => (
                <div key={node.module} className={styles.cascadeNode} style={{ animationDelay: `${i * 100}ms` }}>
                  <div
                    className={styles.cascadeNodeBox}
                    style={{ marginLeft: `${node.depth * 24}px` }}
                  >
                    <span
                      className={styles.cascadeNodeDot}
                      style={{ background: node.depth === 0 ? '#ef4444' : node.depth === 1 ? '#f59e0b' : node.depth === 2 ? '#3b82f6' : '#8b5cf6' }}
                    />
                    <span className={styles.cascadeNodeName}>{node.module}</span>
                    <span className={styles.cascadeDepthLabel}>depth {node.depth}</span>
                  </div>
                  {i < dependencyChain.length - 1 && (
                    <div className={styles.cascadeArrow} style={{ marginLeft: `${node.depth * 24 + 10}px` }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/>
                        <polyline points="19 12 12 19 5 12"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.cascadeFootnote}>
              A change to <strong>Database</strong> propagates through <strong>{dependencyChain.length - 1}</strong> downstream layers.
            </div>
          </div>
        </div>
      </div>

      <AIInsightBanner text={dependencyInsight} />
    </div>
  );
}
