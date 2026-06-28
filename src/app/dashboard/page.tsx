import type { Metadata } from 'next';
import MainLayout from '@/components/layout/MainLayout';
import styles from './dashboard.module.css';

export const metadata: Metadata = {
  title: 'Dashboard — TRACER',
  description: 'Real-time engineering intelligence dashboard — monitor Git changes, dependency impact, and team activity.',
};

/* ── Inline SVG KPI icons ── */
const GitIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/>
    <path d="M6 21V9a9 9 0 0 0 9 9"/>
  </svg>
);

const ShieldIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const LayersIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"/>
    <polyline points="2 17 12 22 22 17"/>
    <polyline points="2 12 12 17 22 12"/>
  </svg>
);

const UsersIcon = ({ color }: { color: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const KPI_CARDS = [
  {
    id: 'kpi-commits',
    label: 'Total Commits Today',
    value: '148',
    badge: '+12%',
    badgeType: 'up',
    icon: <GitIcon color="#3b82f6" />,
    iconBg: 'rgba(59,130,246,0.1)',
  },
  {
    id: 'kpi-risks',
    label: 'Active Risk Alerts',
    value: '7',
    badge: '-3',
    badgeType: 'down',
    icon: <ShieldIcon color="#ef4444" />,
    iconBg: 'rgba(239,68,68,0.1)',
  },
  {
    id: 'kpi-services',
    label: 'Services Impacted',
    value: '23',
    badge: '+5',
    badgeType: 'neutral',
    icon: <LayersIcon color="#f97316" />,
    iconBg: 'rgba(249,115,22,0.1)',
  },
  {
    id: 'kpi-teams',
    label: 'Active Teams',
    value: '11',
    badge: 'Stable',
    badgeType: 'neutral',
    icon: <UsersIcon color="#a78bfa" />,
    iconBg: 'rgba(167,139,250,0.1)',
  },
];

const ACTIVITY = [
  {
    id: 'a1',
    dot: 'blue',
    title: 'auth-service: Merged PR #482 — OAuth2 token refresh',
    meta: 'Platform Team · 3 min ago',
  },
  {
    id: 'a2',
    dot: 'orange',
    title: 'api-gateway: Detected breaking change in /v2/users endpoint',
    meta: 'Backend Core · 11 min ago',
  },
  {
    id: 'a3',
    dot: 'green',
    title: 'analytics-pipeline: Deployment to staging succeeded',
    meta: 'Data Infra · 28 min ago',
  },
  {
    id: 'a4',
    dot: 'purple',
    title: 'frontend-web: 14 components updated — dependency tree expanded',
    meta: 'Frontend · 1 hr ago',
  },
  {
    id: 'a5',
    dot: 'blue',
    title: 'notification-svc: New event schema published to registry',
    meta: 'Platform Team · 2 hr ago',
  },
];

const RISKS = [
  { id: 'r1', level: 'high', text: 'auth-service change impacts 9 downstream consumers' },
  { id: 'r2', level: 'high', text: '/v2/users schema break — 4 APIs unmitigated' },
  { id: 'r3', level: 'med',  text: 'payments-svc staging lag exceeds 3× baseline' },
  { id: 'r4', level: 'med',  text: 'DB migration pending in analytics — no rollback' },
  { id: 'r5', level: 'low',  text: 'frontend bundle size grew 8% in last 5 commits' },
];

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className={styles.page}>
        {/* Top bar */}
        <div className={styles.topbar}>
          <div className={styles.greeting}>
            <span className={styles['greeting-label']}>Good evening, Engineer</span>
            <h1 className={styles['greeting-title']}>Engineering Overview</h1>
          </div>
          <div className={styles['status-pill']}>
            <span className={styles['status-dot']} aria-hidden="true" />
            All systems operational
          </div>
        </div>

        {/* KPI Row */}
        <div className={styles['kpi-grid']}>
          {KPI_CARDS.map(card => (
            <div key={card.id} id={card.id} className={styles['kpi-card']}>
              <div className={styles['kpi-header']}>
                <div
                  className={styles['kpi-icon']}
                  style={{ background: card.iconBg }}
                  aria-hidden="true"
                >
                  {card.icon}
                </div>
                <span className={`${styles['kpi-badge']} ${styles[`kpi-badge--${card.badgeType}`]}`}>
                  {card.badge}
                </span>
              </div>
              <span className={styles['kpi-value']}>{card.value}</span>
              <span className={styles['kpi-label']}>{card.label}</span>
            </div>
          ))}
        </div>

        {/* Content grid */}
        <div className={styles['content-grid']}>
          {/* Activity Feed */}
          <div className={styles.card} id="dashboard-activity">
            <div className={styles['card-header']}>
              <span className={styles['card-title']}>Recent Activity</span>
              <a href="/commits" className={styles['card-action']}>View all commits →</a>
            </div>
            <div className={styles['card-body']}>
              <div className={styles['activity-list']}>
                {ACTIVITY.map(item => (
                  <div key={item.id} className={styles['activity-item']}>
                    <span
                      className={`${styles['activity-dot']} ${styles[`activity-dot--${item.dot}`]}`}
                      aria-hidden="true"
                    />
                    <div className={styles['activity-body']}>
                      <p className={styles['activity-title']}>{item.title}</p>
                      <p className={styles['activity-meta']}>{item.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Risk Panel */}
          <div className={styles.card} id="dashboard-risks">
            <div className={styles['card-header']}>
              <span className={styles['card-title']}>Risk Signals</span>
              <a href="/reporting" className={styles['card-action']}>Full report →</a>
            </div>
            <div className={styles['card-body']}>
              <div className={styles['risk-list']}>
                {RISKS.map(risk => (
                  <div key={risk.id} className={styles['risk-item']}>
                    <span className={`${styles['risk-level']} ${styles[`risk-level--${risk.level}`]}`}>
                      {risk.level.toUpperCase()}
                    </span>
                    <p className={styles['risk-text']}>{risk.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
