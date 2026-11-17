import { cn } from '@/lib/utils';

/** "Demo Bank" → "DB", "acme-credit" → "AC", "ada@customers.example" → "AD". */
export function initials(value: string | null | undefined) {
  const text = (value ?? '').split('@')[0].replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (!text) return '?';
  const words = text.split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : text.slice(0, 2)).toUpperCase();
}

const hash = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** Gradient pairs chosen to read well with white initials, in light and dark themes. */
const GRADIENTS = [
  ['#7B68F6', '#4B34C6'],
  ['#38BDF8', '#2563EB'],
  ['#34D399', '#0F9F6E'],
  ['#F59E0B', '#EA580C'],
  ['#F472B6', '#DB2777'],
  ['#A78BFA', '#7C3AED'],
  ['#2DD4BF', '#0E7490'],
  ['#FB7185', '#E11D48'],
];

const gradientFor = (seed: string) => {
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
};

const SIZES = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

/** An institution's tile: its brand colour when it has one, otherwise a colour derived from its name. */
export function Monogram({ name, color, size = 'md', className }: { name: string | null | undefined; color?: string | null; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-[28%] font-semibold tracking-tight text-white shadow-xs ring-1 ring-inset ring-white/15', SIZES[size], className)}
      style={{ background: color ? `linear-gradient(135deg, color-mix(in srgb, ${color} 78%, white), ${color})` : gradientFor(name ?? '') }}
    >
      {initials(name)}
    </span>
  );
}

/** A person: initials on a gradient that stays the same for the same e-mail. */
export function Avatar({ name, email, size = 'sm', className }: { name?: string | null; email?: string | null; size?: keyof typeof SIZES; className?: string }) {
  const seed = email ?? name ?? '';
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-background', SIZES[size], className)}
      style={{ background: gradientFor(seed) }}
    >
      {initials(name || email)}
    </span>
  );
}
