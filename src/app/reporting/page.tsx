import type { Metadata } from 'next';
import MainLayout from '@/components/layout/MainLayout';

export const metadata: Metadata = {
  title: 'Reporting — TRACER',
  description: 'Impact reports, risk summaries, and cross-team activity.',
};

export default function ReportingPage() {
  return (
    <MainLayout>
      <div style={{
        padding: '2rem',
        maxWidth: '1440px',
        margin: '0 auto',
        animation: 'fadeIn 0.4s ease both',
      }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
          Reporting
        </h1>
        <p style={{ marginTop: '0.5rem', color: '#475569', fontSize: '0.875rem' }}>
          Impact analysis reports, risk summaries, and team activity insights.
        </p>
      </div>
    </MainLayout>
  );
}
