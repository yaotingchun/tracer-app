import type { Metadata } from 'next';
import LoginBrand from '@/components/auth/LoginBrand';
import LoginForm  from '@/components/auth/LoginForm';
import styles from './login.module.css';

export const metadata: Metadata = {
  title: 'Sign In — TRACER',
  description: 'Sign in to your TRACER engineering intelligence workspace.',
};

export default function LoginPage() {
  return (
    <div className={styles.page}>
      <LoginBrand />
      <LoginForm  />
    </div>
  );
}
