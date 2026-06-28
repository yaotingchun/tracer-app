'use client';

import React from 'react';
import './globals.css';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  React.useEffect(() => {
    console.error('Root Global Error:', error);
  }, [error]);

  return (
    <html lang="en" style={{ backgroundColor: '#070b14', color: '#ffffff' }}>
      <head>
        <title>Application Error — TRACER</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        fontFamily: 'Inter, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#070b14',
        color: '#ffffff',
        margin: 0,
        padding: '2rem',
        textAlign: 'center',
      }}>
        {/* Decorative ambient background glows */}
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '540px',
          padding: '2.5rem',
          borderRadius: '1.5rem',
          backgroundColor: '#112040',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 48px rgba(59, 130, 246, 0.2)',
          animation: 'fadeIn 0.5s ease-out',
        }}>
          {/* Logo / Icon */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '2px solid #ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>

          <h1 style={{
            fontSize: '2rem',
            fontWeight: 800,
            marginBottom: '1rem',
            letterSpacing: '-0.025em',
            background: 'linear-gradient(to right, #ffffff, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            System Interrupted
          </h1>

          <p style={{
            fontSize: '1rem',
            color: '#94a3b8',
            marginBottom: '1.5rem',
            lineHeight: '1.6',
          }}>
            A critical error occurred while rendering the application. This has been logged for analysis.
          </p>

          {error.digest && (
            <div style={{
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              color: '#60a5fa',
              backgroundColor: '#0a1628',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              marginBottom: '2rem',
              border: '1px solid rgba(96, 165, 250, 0.1)',
              wordBreak: 'break-all',
            }}>
              ID: {error.digest}
            </div>
          )}

          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
          }}>
            <button
              onClick={() => unstable_retry()}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#ffffff',
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              Recover App
            </button>
            
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#94a3b8',
                background: 'transparent',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
