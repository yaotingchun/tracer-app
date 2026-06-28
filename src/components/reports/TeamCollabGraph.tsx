'use client';

import { collabGraph } from '@/lib/reportsData';
import styles from './reports.module.css';

const TEAM_COLORS: Record<string, string> = {
  Backend:  '#3b82f6',
  Frontend: '#8b5cf6',
  Data:     '#22c55e',
  Security: '#f59e0b',
};

export default function TeamCollabGraph() {
  return (
    <div className={styles.collabGraphCard} id="team-collab-graph">
      <div className={styles.collabGraphTitle}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
          <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
        </svg>
        Team Collaboration Network
      </div>
      <p className={styles.collabGraphSub}>Outbound engineering interactions by team this sprint</p>
      <div className={styles.collabGraphBody}>
        {collabGraph.map(node => (
          <div key={node.team} className={styles.collabNode}>
            <div className={styles.collabNodeHeader}>
              <span
                className={styles.collabNodeDot}
                style={{ background: TEAM_COLORS[node.team] ?? '#60a5fa' }}
              />
              <span className={styles.collabNodeTeam}>{node.team}</span>
            </div>
            <div className={styles.collabConnections}>
              {node.connections.map(conn => (
                <div key={conn.target} className={styles.collabConnection}>
                  <span className={styles.collabConnTree}>├──</span>
                  <span
                    className={styles.collabConnTarget}
                    style={{ color: TEAM_COLORS[conn.target] ?? '#60a5fa' }}
                  >
                    {conn.target}
                  </span>
                  <span className={styles.collabConnWeight}>({conn.weight})</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
