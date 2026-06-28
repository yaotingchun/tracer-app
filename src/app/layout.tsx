import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TRACER — AI Engineering Intelligence',
  description:
    'TRACER analyzes Git repository changes in real time to understand how code updates impact the entire software system. Maps dependencies, predicts downstream effects, and improves cross-team visibility.',
  keywords: [
    'engineering intelligence',
    'git analysis',
    'dependency mapping',
    'code impact',
    'devops',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
