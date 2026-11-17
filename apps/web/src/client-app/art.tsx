import { cn } from '@/lib/utils';

/**
 * Hero illustrations of client apps: white shapes on the brand colour (they sit on the hero's brand background), so
 * they follow every institution's palette.
 */
export function HeroArt({ name, className }: { name: string; className?: string }) {
  if (name === 'none' || !name) return null;
  return (
    <svg viewBox="0 0 220 150" className={cn('h-auto w-full', className)} fill="none" aria-hidden="true">
      <circle cx="140" cy="72" r="64" fill="white" fillOpacity="0.09" />
      <circle cx="140" cy="72" r="42" fill="white" fillOpacity="0.07" />
      {name === 'wallet' ? <Wallet /> : name === 'shield' ? <Shield /> : <Documents />}
      <path d="M34 34l2.4 5.6L42 42l-5.6 2.4L34 50l-2.4-5.6L26 42l5.6-2.4z" fill="white" fillOpacity="0.75" />
      <path d="M202 22l1.6 3.4L207 27l-3.4 1.6L202 32l-1.6-3.4L197 27l3.4-1.6z" fill="white" fillOpacity="0.65" />
    </svg>
  );
}

/** Two payment cards and a coin. */
function Wallet() {
  return (
    <g>
      <g transform="rotate(-12 120 70)">
        <rect x="66" y="40" width="104" height="66" rx="10" fill="white" fillOpacity="0.35" />
      </g>
      <rect x="74" y="54" width="108" height="68" rx="11" fill="white" fillOpacity="0.96" />
      <rect x="86" y="68" width="18" height="13" rx="3" fill="currentColor" fillOpacity="0.35" />
      <rect x="86" y="94" width="52" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.16" />
      <rect x="86" y="104" width="30" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.1" />
      <circle cx="158" cy="104" r="7" fill="currentColor" fillOpacity="0.55" />
      <circle cx="167" cy="104" r="7" fill="currentColor" fillOpacity="0.3" />
      <circle cx="62" cy="114" r="15" fill="white" />
      <circle cx="62" cy="114" r="10.5" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2.5" />
      <path d="M62 108.5v11M58.5 111.2c0-1.6 1.6-2.7 3.5-2.7s3.5 1 3.5 2.6-1.6 2.1-3.5 2.4-3.5.9-3.5 2.4 1.6 2.6 3.5 2.6 3.5-1.1 3.5-2.7" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Documents() {
  return (
    <g>
      <rect x="70" y="26" width="84" height="106" rx="10" fill="white" fillOpacity="0.95" />
      <rect x="82" y="42" width="44" height="6" rx="3" fill="currentColor" fillOpacity="0.7" />
      <rect x="82" y="56" width="58" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.12" />
      <rect x="82" y="67" width="50" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.12" />
      <rect x="82" y="78" width="56" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.12" />
      <circle cx="164" cy="100" r="24" fill="white" />
      <circle cx="164" cy="100" r="17" stroke="currentColor" strokeOpacity="0.2" strokeWidth="5" />
      <path d="M164 83a17 17 0 1 1-16.2 22" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M157 100.5l5 5 9-10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Shield() {
  return (
    <g>
      <path d="M140 24l40 14v30c0 26-17 44-40 54-23-10-40-28-40-54V38z" fill="white" fillOpacity="0.95" />
      <path d="M140 38l28 10v21c0 18-12 31-28 38-16-7-28-20-28-38V48z" fill="currentColor" fillOpacity="0.18" />
      <path d="M128 72l8 8 16-17" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="56" y="86" width="46" height="34" rx="7" fill="white" fillOpacity="0.9" />
      <path d="M68 86v-7a11 11 0 0 1 22 0v7" stroke="white" strokeOpacity="0.9" strokeWidth="4" />
      <circle cx="79" cy="102" r="4" fill="currentColor" fillOpacity="0.6" />
    </g>
  );
}
