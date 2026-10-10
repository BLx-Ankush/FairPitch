import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FairPitch — Judging you can audit',
  description:
    'Auditable and explainable hackathon judging system with cryptographic SHA-256 hash chains, leniency telemetry, and AI loss autopsies.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900">
      <body className="min-h-full bg-slate-50 text-slate-900 flex flex-col font-sans">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

