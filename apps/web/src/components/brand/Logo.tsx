import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * The Lintelia mark: an "F" drawn as a workflow — a stem with two branches ending in nodes, the upper one completed
 * (cyan). Works from 16 px (favicon: public/favicon.svg) to hero sizes.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 32 32" className={cn('h-8 w-8', className)} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-bg`} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7B68F6" />
          <stop offset="0.55" stopColor="#5B43E3" />
          <stop offset="1" stopColor="#3E2CA0" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="16" y1="0" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${id}-bg)`} />
      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${id}-shine)`} />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="#fff" strokeOpacity="0.14" />
      <path d="M11.2 24V13.4c0-1.3 1-2.3 2.3-2.3h6.3" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.2 17.2h5.1" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="22.3" cy="11.1" r="2.7" fill="#5EEAD4" stroke="#fff" strokeWidth="1.4" />
      <circle cx="19" cy="17.2" r="2.1" fill="#fff" />
    </svg>
  );
}

/** Mark + wordmark. `tone="light"` for dark backgrounds. */
export function Logo({ className, tone = 'default', size = 'md' }: { className?: string; tone?: 'default' | 'light'; size?: 'sm' | 'md' | 'lg' }) {
  const mark = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const text = size === 'sm' ? 'text-[15px]' : size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={mark} />
      <span className={cn('font-semibold tracking-[-0.02em]', text, tone === 'light' ? 'text-white' : 'text-foreground')} aria-hidden="true">
        lintelia
      </span>
      <span className="sr-only">Lintelia</span>
    </span>
  );
}
