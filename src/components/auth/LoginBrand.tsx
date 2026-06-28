import Image from 'next/image';
import styles from './LoginBrand.module.css';

export default function LoginBrand() {
  return (
    <aside className={styles.panel} aria-label="TRACER branding panel">
      {/* Main content */}
      <div className={styles.content}>
        <div className={styles['brand-group']}>
          {/* Logo */}
          <div className={styles['logo-wrap']}>
            <Image
              src="/tracer_logo.png"
              alt="TRACER Logo"
              width={480}
              height={192}
              style={{ width: 'auto' }}
              className={styles['logo-img']}
              priority
            />
          </div>

          {/* Hero copy */}
          <div className={styles.hero}>
            <h1 className={styles.headline}>
              Repository <span className={styles['headline-accent']}>Tracer</span>
            </h1>
            <p className={styles.subheadline}>
              Real-time impact analysis for software engineering teams.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <span className={styles['footer-line']} />
        <span className={styles['footer-text']}>
          TRACER Intelligence Platform © {new Date().getFullYear()}
        </span>
      </footer>
    </aside>
  );
}
