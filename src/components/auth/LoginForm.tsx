'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input  from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import styles from './LoginForm.module.css';

/* ── Eye icons (inline SVG, no dependency) ── */
const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45
      18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11
      8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

/* ── Test credentials ── */
const VALID_EMAIL    = 'test@tracer.dev';
const VALID_PASSWORD = 'tracer123';

export default function LoginForm() {
  const router = useRouter();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    /* Simulate async auth check */
    await new Promise(r => setTimeout(r, 900));

    if (email === VALID_EMAIL && password === VALID_PASSWORD) {
      router.push('/dashboard');
    } else {
      setError('Invalid email or password. Please try again.');
      setLoading(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="Sign-in form">
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Welcome back</h2>
          <p className={styles.subtitle}>
            Sign in to your TRACER workspace to continue.
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className={styles.alert} role="alert">
            <AlertIcon />
            {error}
          </div>
        )}

        {/* Form */}
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            id="login-email"
            type="email"
            label="Email address"
            placeholder="you@company.com"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          <Input
            id="login-password"
            type={showPwd ? 'text' : 'password'}
            label="Password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            iconRight={showPwd ? <EyeOffIcon /> : <EyeIcon />}
            onIconRightClick={() => setShowPwd(p => !p)}
          />

          <div className={styles.forgot}>
            <a href="#" className={styles['forgot-link']}>
              Forgot password?
            </a>
          </div>

          <div className={styles['form-actions']}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              id="login-submit"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </div>
        </form>

        {/* Hint */}
        <div className={styles.divider}>or</div>
        <p className={styles['sso-note']}>
          Contact your administrator for SSO access
        </p>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        TRACER Intelligence Platform © {new Date().getFullYear()}
      </footer>
    </section>
  );
}
