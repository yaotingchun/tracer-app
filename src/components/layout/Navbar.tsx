'use client';

import Image  from 'next/image';
import Link   from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

/* ── Nav Icon SVGs (inline, no deps) ── */
const DashboardIcon = () => (
  <svg className={styles['nav-icon']} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const CommitsIcon = () => (
  <svg className={styles['nav-icon']} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <line x1="1.05" y1="12" x2="7" y2="12"/>
    <line x1="17.01" y1="12" x2="22.96" y2="12"/>
  </svg>
);

const ReportingIcon = () => (
  <svg className={styles['nav-icon']} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>
);

const SettingsIcon = () => (
  <svg className={styles['nav-icon']} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
);

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { href: '/commits',   label: 'Commits',   Icon: CommitsIcon   },
  { href: '/reporting', label: 'Reporting', Icon: ReportingIcon  },
  { href: '/settings',  label: 'Settings',  Icon: SettingsIcon  },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className={styles.navbar} aria-label="Main navigation">
      <div className={styles.inner}>
        {/* Brand */}
        <Link href="/dashboard" className={styles.brand} aria-label="Go to dashboard">
          <Image
            src="/tracer_logo.png"
            alt="TRACER"
            width={100}
            height={36}
            style={{ width: 'auto' }}
            className={styles['brand-logo']}
            priority
          />
          <span className={styles['brand-wordmark']}>
            <span>TRACER</span>
          </span>
        </Link>

        {/* Primary links */}
        <div className={styles.nav} role="list">
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                role="listitem"
                className={[
                  styles['nav-link'],
                  isActive ? styles['nav-link--active'] : '',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right slot */}
        <div className={styles.right}>
          <button
            className={styles['notification-btn']}
            aria-label="Notifications"
            id="navbar-notifications"
          >
            <BellIcon />
            <span className={styles['notification-dot']} aria-hidden="true" />
          </button>

          <div
            className={styles.avatar}
            role="button"
            tabIndex={0}
            aria-label="User profile"
            id="navbar-avatar"
          >
            T
          </div>
        </div>
      </div>
    </nav>
  );
}
