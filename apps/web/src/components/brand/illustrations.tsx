/**
 * Spot illustrations (empty states, panels). One visual language: white cards with the theme border, muted "text"
 * lines, one brand accent per scene, a soft halo behind. Colours come from the theme (Tailwind fill-/stroke-
 * classes), so they follow light and dark mode. All decorative: aria-hidden.
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

function Frame({ children, className, viewBox = '0 0 200 140' }: { children: ReactNode; className?: string; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className={cn('h-auto w-full', className)} fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

/** The soft halo and sparkles every scene sits on. */
function Backdrop() {
  return (
    <>
      <ellipse cx="100" cy="74" rx="78" ry="56" className="fill-primary/[0.06]" />
      <ellipse cx="100" cy="74" rx="54" ry="40" className="fill-primary/[0.06]" />
      <Sparkle x={34} y={30} />
      <Sparkle x={168} y={46} size={4} />
      <circle cx="160" cy="112" r="2" className="fill-primary/30" />
      <circle cx="44" cy="104" r="1.6" className="fill-foreground/15" />
    </>
  );
}

function Sparkle({ x, y, size = 5 }: { x: number; y: number; size?: number }) {
  const s = size;
  return <path d={`M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`} className="fill-primary/40" />;
}

function Card({ x, y, w, h, r = 8, className }: { x: number; y: number; w: number; h: number; r?: number; className?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={r} className={cn('fill-card stroke-border', className)} strokeWidth="1.2" />;
}

function Line({ x, y, w, strong }: { x: number; y: number; w: number; strong?: boolean }) {
  return <rect x={x} y={y} width={w} height="4" rx="2" className={strong ? 'fill-foreground/20' : 'fill-foreground/[0.09]'} />;
}

function Check({ cx, cy, r = 9, tone = 'success' }: { cx: number; cy: number; r?: number; tone?: 'success' | 'brand' }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} className={tone === 'success' ? 'fill-success' : 'fill-primary'} />
      <path d={`M${cx - r * 0.42} ${cy + 0.2}l${r * 0.3} ${r * 0.3} ${r * 0.55}-${r * 0.6}`} stroke="white" strokeWidth={r * 0.2} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Inbox cleared: a tray with finished cards and a check. */
export function TasksArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <Card x={62} y={30} w={76} h={28} className="fill-card/70" />
      <Line x={72} y={40} w={40} />
      <Card x={54} y={44} w={92} h={30} />
      <Line x={66} y={54} w={46} strong />
      <Line x={66} y={62} w={30} />
      <path d="M40 84h32l6 12h44l6-12h32v24a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8z" className="fill-card stroke-border" strokeWidth="1.2" />
      <path d="M40 84l14-22h92l14 22" className="stroke-border" strokeWidth="1.2" />
      <Check cx={146} cy={44} r={11} />
    </Frame>
  );
}

/** A case folder with a magnifier. */
export function CasesArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <Card x={70} y={26} w={64} h={50} r={6} />
      <Line x={80} y={38} w={34} strong />
      <Line x={80} y={47} w={44} />
      <Line x={80} y={56} w={26} />
      <path d="M48 48a6 6 0 0 1 6-6h22l8 8h60a6 6 0 0 1 6 6v50a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6z" className="fill-primary/[0.12] stroke-primary/40" strokeWidth="1.2" />
      <path d="M44 62a6 6 0 0 1 6-6h100a6 6 0 0 1 6 6l-4 44a6 6 0 0 1-6 6H54a6 6 0 0 1-6-6z" className="fill-card stroke-border" strokeWidth="1.2" />
      <Line x={62} y={74} w={40} strong />
      <Line x={62} y={83} w={58} />
      <circle cx="138" cy="92" r="14" className="fill-card stroke-primary" strokeWidth="3" />
      <circle cx="138" cy="92" r="7" className="fill-primary/15" />
      <path d="M148 102l12 12" className="stroke-primary" strokeWidth="4" strokeLinecap="round" />
    </Frame>
  );
}

/** Two client cards. */
export function ClientsArt({ className }: { className?: string }) {
  const person = (x: number, y: number, accent: boolean) => (
    <g>
      <Card x={x} y={y} w={64} h={74} r={10} />
      <circle cx={x + 32} cy={y + 26} r="13" className={accent ? 'fill-primary/20' : 'fill-foreground/[0.08]'} />
      <circle cx={x + 32} cy={y + 23} r="5.5" className={accent ? 'fill-primary' : 'fill-foreground/25'} />
      <path d={`M${x + 22} ${y + 36}a10 9 0 0 1 20 0`} className={accent ? 'fill-primary' : 'fill-foreground/25'} />
      <Line x={x + 14} y={y + 50} w={36} strong />
      <Line x={x + 20} y={y + 59} w={24} />
    </g>
  );
  return (
    <Frame className={className}>
      <Backdrop />
      {person(46, 40, false)}
      {person(88, 30, true)}
      <Check cx={148} cy={36} r={9} />
    </Frame>
  );
}

/** Stacked documents with a seal. */
export function DocumentsArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <Card x={78} y={22} w={60} h={78} r={6} className="fill-card/70" />
      <Card x={66} y={30} w={60} h={80} r={6} />
      <Line x={76} y={44} w={32} strong />
      <Line x={76} y={54} w={40} />
      <Line x={76} y={62} w={36} />
      <Line x={76} y={70} w={40} />
      <Line x={76} y={78} w={22} />
      <circle cx="120" cy="98" r="14" className="fill-primary" />
      <circle cx="120" cy="98" r="10" className="stroke-white/60" strokeWidth="1.2" strokeDasharray="2 2" />
      <path d="M115 98.5l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
  );
}

/** Three connected steps: a workflow. */
export function WorkflowArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <path d="M62 56h20c10 0 14 4 14 14v0c0 10 4 14 14 14h18" className="stroke-primary/60" strokeWidth="2" strokeDasharray="4 4" />
      <Card x={30} y={42} w={40} h={28} />
      <Line x={38} y={54} w={24} strong />
      <Card x={80} y={56} w={40} h={28} className="stroke-primary/60 fill-primary/[0.08]" />
      <Line x={88} y={68} w={24} />
      <Card x={128} y={70} w={42} h={28} />
      <Line x={136} y={82} w={24} strong />
      <Check cx={168} cy={70} r={8} />
    </Frame>
  );
}

/** A shield with a check (privacy, security, consent). */
export function ShieldArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <path d="M100 24l40 14v28c0 26-18 42-40 50-22-8-40-24-40-50V38z" className="fill-card stroke-border" strokeWidth="1.4" />
      <path d="M100 34l30 10.5v21.5c0 19.5-13.5 31.5-30 37.5-16.5-6-30-18-30-37.5V44.5z" className="fill-primary/[0.1]" />
      <Check cx={100} cy={68} r={16} tone="brand" />
    </Frame>
  );
}

/** Nothing matched the search. */
export function SearchArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <Card x={48} y={34} w={104} h={72} r={10} />
      <Line x={62} y={50} w={60} strong />
      <Line x={62} y={62} w={76} />
      <Line x={62} y={74} w={50} />
      <Line x={62} y={86} w={64} />
      <circle cx="132" cy="88" r="16" className="fill-card/90 stroke-primary" strokeWidth="3" />
      <path d="M144 100l12 12" className="stroke-primary" strokeWidth="4" strokeLinecap="round" />
    </Frame>
  );
}

/** Two systems joined by a cable: integrations, webhooks, API clients. */
export function ConnectArt({ className }: { className?: string }) {
  return (
    <Frame className={className}>
      <Backdrop />
      <Card x={28} y={46} w={52} h={48} r={10} />
      <rect x={40} y={58} width={28} height={6} rx={3} className="fill-foreground/20" />
      <rect x={40} y={70} width={20} height={4} rx={2} className="fill-foreground/[0.09]" />
      <circle cx={62} cy={82} r={3} className="fill-success" />
      <Card x={120} y={46} w={52} h={48} r={10} className="fill-primary/[0.08] stroke-primary/50" />
      <path d="M138 62h16M138 70h10" className="stroke-primary" strokeWidth="3" strokeLinecap="round" />
      <circle cx={158} cy={82} r={3} className="fill-primary" />
      <path d="M80 70c14 0 12-22 24-22s6 22 16 22" className="stroke-primary/60" strokeWidth="2" strokeDasharray="3 4" fill="none" />
      <rect x={94} y={60} width={12} height={20} rx={3} className="fill-card stroke-primary" strokeWidth="1.6" />
      <path d="M97 60v-5M103 60v-5" className="stroke-primary" strokeWidth="1.6" strokeLinecap="round" />
    </Frame>
  );
}

export const ART = {
  connect: ConnectArt,
  tasks: TasksArt,
  cases: CasesArt,
  clients: ClientsArt,
  documents: DocumentsArt,
  workflows: WorkflowArt,
  shield: ShieldArt,
  search: SearchArt,
};
export type ArtName = keyof typeof ART;
