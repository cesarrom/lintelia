import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Marks of the connectors (integrations/*): a glyph drawn for each kind of service on its own gradient tile.
 * They are Fintivio's renderings of what the connector does, not the vendors' trademarks.
 */
const GLYPHS: Record<string, { from: string; to: string; glyph: ReactNode }> = {
  // Identity verification: a face inside a scanning frame.
  didit: {
    from: '#34d399', to: '#0d9488',
    glyph: (
      <>
        <path d="M7 10V8.5A1.5 1.5 0 0 1 8.5 7H10M22 7h1.5A1.5 1.5 0 0 1 25 8.5V10M25 22v1.5a1.5 1.5 0 0 1-1.5 1.5H22M10 25H8.5A1.5 1.5 0 0 1 7 23.5V22" />
        <circle cx="16" cy="14" r="3.2" />
        <path d="M10.8 22c.9-2.6 2.9-4 5.2-4s4.3 1.4 5.2 4" />
      </>
    ),
  },
  // E-signature: a document with a signature stroke.
  documenso: {
    from: '#a78bfa', to: '#6d28d9',
    glyph: (
      <>
        <path d="M10 6.5h8.5L23 11v13.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 24.5v-16.5A1.5 1.5 0 0 1 10.5 6.5" />
        <path d="M18.5 6.5V11H23" />
        <path d="M12 21c1.2-2.2 2.2-2.2 2.6-.6.3 1.3 1.1 1.4 1.9.1.7-1.1 1.5-1.2 2.1-.2.4.6 1 .8 1.8.6" />
      </>
    ),
  },
  // Screening: a radar sweep.
  screening: {
    from: '#fb923c', to: '#e11d48',
    glyph: (
      <>
        <circle cx="16" cy="16" r="9" />
        <circle cx="16" cy="16" r="5" />
        <path d="M16 16l6.4-6.4" />
        <circle cx="19.5" cy="12.8" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),
  },
  // Data source: a database cylinder.
  'postgres-datasource': {
    from: '#60a5fa', to: '#1d4ed8',
    glyph: (
      <>
        <ellipse cx="16" cy="9.5" rx="7.5" ry="3" />
        <path d="M8.5 9.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
        <path d="M8.5 16c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
      </>
    ),
  },
  // E-mail: an envelope.
  'smtp-mailer': {
    from: '#38bdf8', to: '#0e7490',
    glyph: (
      <>
        <rect x="6.5" y="9" width="19" height="14" rx="2" />
        <path d="M7.5 10.5l8.5 6.5 8.5-6.5" />
      </>
    ),
  },
};

const FALLBACK = {
  from: '#94a3b8', to: '#475569',
  glyph: (
    <>
      <path d="M12 6.5v5M20 6.5v5" />
      <path d="M9.5 11.5h13v3.5a6.5 6.5 0 0 1-13 0z" />
      <path d="M16 21.5v4" />
    </>
  ),
};

export function ConnectorLogo({ id, className }: { id: string; className?: string }) {
  const mark = GLYPHS[id] ?? FALLBACK;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-xs ring-1 ring-inset ring-white/20', className)}
      style={{ background: `linear-gradient(135deg, ${mark.from}, ${mark.to})` }}
    >
      <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {mark.glyph}
      </svg>
    </span>
  );
}
