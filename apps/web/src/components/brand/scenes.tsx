/**
 * Larger decorative compositions: the sign-on artwork, the portal welcome art and the landing page's product shot.
 * HTML + SVG so text stays crisp; everything is aria-hidden and free of words the app uses for real controls.
 */
import type { CSSProperties, ReactNode } from 'react';
import { BadgeCheck, Fingerprint, FileSignature, ScanFace, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

function Glass({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn('rounded-2xl border border-white/15 bg-white/[0.08] p-4 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-md', className)}
      style={style}
    >
      {children}
    </div>
  );
}

function Row({ icon, label, done = true }: { icon: ReactNode; label: string; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-[13px]">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/90">{icon}</span>
      <span className="flex-1 text-white/85">{label}</span>
      {done
        ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/90 text-[#053b2a]"><svg viewBox="0 0 12 12" className="h-3 w-3"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
        : <span className="h-5 w-5 rotate-45 rounded-full border-2 border-white/25 border-t-white/90 border-r-white/90" />}
    </div>
  );
}

/**
 * Sign-on artwork: a verification checklist, a workflow path and a decision card floating over a grid.
 * Sits on a brand (or institution) coloured panel.
 */
export function SignOnArtwork({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative h-[380px] w-full max-w-[440px] select-none', className)}>
      {/* connector path */}
      <svg viewBox="0 0 440 380" className="absolute inset-0 h-full w-full" fill="none">
        <path d="M96 150 C 96 215, 170 205, 210 236 S 300 300, 330 300" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="5 6" />
        <circle cx="96" cy="150" r="4" fill="white" fillOpacity="0.7" />
        <circle cx="210" cy="236" r="4" fill="white" fillOpacity="0.7" />
        <circle cx="330" cy="300" r="5" fill="#5EEAD4" />
      </svg>

      <Glass className="absolute left-0 top-0 w-[248px]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Identity check</span>
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-200">3 of 4</span>
        </div>
        <div className="space-y-2.5">
          <Row icon={<Fingerprint className="h-4 w-4" />} label="Document authenticity" />
          <Row icon={<ScanFace className="h-4 w-4" />} label="Liveness and face match" />
          <Row icon={<ShieldCheck className="h-4 w-4" />} label="Sanctions and PEP lists" />
          <Row icon={<FileSignature className="h-4 w-4" />} label="Agreement signature" done={false} />
        </div>
      </Glass>

      <Glass className="absolute right-0 top-[140px] w-[210px] p-3.5">
        <div className="flex items-center gap-2 text-[12px] text-white/70"><Workflow className="h-3.5 w-3.5" /> Routing</div>
        <div className="mt-2 space-y-1.5">
          {[['Risk score', 'Low', 'bg-emerald-300'], ['Four-eyes', 'Not needed', 'bg-sky-300'], ['SLA', '2 h left', 'bg-amber-300']].map(([k, v, dot]) => (
            <div key={k} className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-2 text-white/75"><span className={cn('h-1.5 w-1.5 rounded-full', dot)} />{k}</span>
              <span className="font-medium text-white/95">{v}</span>
            </div>
          ))}
        </div>
      </Glass>

      <Glass className="absolute bottom-0 left-[70px] w-[250px] p-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-teal-500 text-[#053b2a]"><BadgeCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold">Account opening</p>
            <p className="text-[12px] text-white/65">Decided in 4 min · fully audited</p>
          </div>
        </div>
      </Glass>
    </div>
  );
}

/** Portal welcome art: a document with a progress ring and a check. Uses the institution colour (`color`). */
export function PortalWelcomeArt({ color, className }: { color: string; className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={cn('h-auto w-full', className)} fill="none" aria-hidden="true">
      <circle cx="150" cy="70" r="62" fill="white" fillOpacity="0.1" />
      <circle cx="150" cy="70" r="40" fill="white" fillOpacity="0.08" />
      <rect x="62" y="26" width="84" height="106" rx="10" fill="white" fillOpacity="0.95" />
      <rect x="74" y="42" width="44" height="6" rx="3" fill={color} fillOpacity="0.85" />
      <rect x="74" y="56" width="58" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.12" />
      <rect x="74" y="67" width="50" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.12" />
      <rect x="74" y="78" width="56" height="5" rx="2.5" fill="#0f172a" fillOpacity="0.12" />
      <rect x="74" y="96" width="30" height="14" rx="7" fill={color} fillOpacity="0.15" />
      <circle cx="160" cy="100" r="24" fill="white" />
      <circle cx="160" cy="100" r="17" stroke={color} strokeOpacity="0.2" strokeWidth="5" />
      <path d="M160 83a17 17 0 1 1-16.2 22" stroke={color} strokeWidth="5" strokeLinecap="round" />
      <path d="M153 100.5l5 5 9-10" stroke={color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M40 40l2.4 5.6L48 48l-5.6 2.4L40 56l-2.4-5.6L32 48l5.6-2.4z" fill="white" fillOpacity="0.8" />
      <path d="M196 24l1.6 3.4L201 29l-3.4 1.6L196 34l-1.6-3.4L191 29l3.4-1.6z" fill="white" fillOpacity="0.7" />
    </svg>
  );
}

/**
 * Landing page product shot: a back-office window with the case queue and a workflow, in HTML.
 */
export function ProductShot({ className }: { className?: string }) {
  const rows = [
    ['C-2026-8F2K', 'Retail account · Ada Lovelace', 'Approved', 'bg-emerald-500/10 text-emerald-700 ring-emerald-600/20', 'bg-emerald-500'],
    ['C-2026-3QX7', 'Business onboarding · Widgets Ltd', 'In review', 'bg-amber-500/10 text-amber-700 ring-amber-600/20', 'bg-amber-500'],
    ['C-2026-K1ZP', 'Loan pre-approval · Grace Hopper', 'Waiting for client', 'bg-sky-500/10 text-sky-700 ring-sky-600/20', 'bg-sky-500'],
    ['C-2026-77HD', 'Suspicious activity · J. Smith', 'Escalated', 'bg-rose-500/10 text-rose-700 ring-rose-600/20', 'bg-rose-500'],
  ];
  return (
    <div aria-hidden="true" className={cn('relative select-none', className)}>
      <div className="overflow-hidden rounded-2xl border border-slate-900/10 bg-white shadow-[0_40px_80px_-30px_rgba(30,23,74,0.45)] ring-1 ring-black/5">
        <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-4 h-5 w-56 rounded-md bg-white ring-1 ring-slate-200" />
        </div>
        <div className="flex">
          <div className="hidden w-40 shrink-0 space-y-1 border-r border-slate-100 bg-slate-50/70 p-3 sm:block">
            <div className="mb-3 flex items-center gap-2"><span className="h-6 w-6 rounded-md bg-gradient-to-br from-sky-400 to-blue-600" /><span className="h-2.5 w-16 rounded bg-slate-300" /></div>
            {[70, 54, 62, 48, 58, 40].map((w, i) => (
              <div key={i} className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', i === 2 && 'bg-white shadow-sm ring-1 ring-slate-200')}>
                <span className={cn('h-3 w-3 rounded', i === 2 ? 'bg-brand-500' : 'bg-slate-300')} />
                <span className="h-2 rounded bg-slate-300" style={{ width: w }} />
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[15px] font-semibold text-slate-900">Cases</p>
                <p className="text-[11px] text-slate-500">Onboarding, lending and investigations</p>
              </div>
              <span className="rounded-lg bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">New case</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[['Open', '128', 'text-slate-900'], ['Avg. decision', '6 min', 'text-slate-900'], ['Auto-approved', '71%', 'text-emerald-600']].map(([k, v, c]) => (
                <div key={k} className="rounded-xl border border-slate-200 p-2.5">
                  <p className="text-[10px] text-slate-500">{k}</p>
                  <p className={cn('text-base font-semibold tabular-nums', c)}>{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              {rows.map(([ref, title, status, tone, dot], i) => (
                <div key={ref} className={cn('flex items-center gap-3 px-3 py-2.5 text-[11.5px]', i > 0 && 'border-t border-slate-100')}>
                  <span className="w-[74px] font-mono text-[10.5px] text-slate-500">{ref}</span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{title}</span>
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-medium ring-1 ring-inset', tone)}><span className={cn('h-1.5 w-1.5 rounded-full', dot)} />{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floating workflow card */}
      <div className="absolute -bottom-10 -left-8 hidden w-[290px] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_30px_60px_-25px_rgba(30,23,74,0.45)] md:block">
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500"><Workflow className="h-3.5 w-3.5 text-brand-600" /> Retail account opening · v4</div>
        <svg viewBox="0 0 260 70" className="mt-3 w-full" fill="none">
          <path d="M62 35h12M136 35h12M210 35h12" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
          {[['4', 'Apply', '#6d58f0'], ['76', 'KYC', '#0ea5e9'], ['150', 'Sign', '#10b981']].map(([x, t, c]) => (
            <g key={t}>
              <rect x={Number(x)} y="18" width="58" height="34" rx="9" fill="white" stroke="#e2e8f0" />
              <circle cx={Number(x) + 13} cy="35" r="4.5" fill={c} />
              <text x={Number(x) + 22} y="38.5" fontSize="10" fontWeight="500" fontFamily="Geist Variable, sans-serif" fill="#334155">{t}</text>
            </g>
          ))}
          <circle cx="236" cy="35" r="9" fill="#10b981" />
          <path d="M232 35.5l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* floating decision toast */}
      <div className="absolute -right-6 -top-6 hidden items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_30px_60px_-25px_rgba(30,23,74,0.45)] md:flex">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Sparkles className="h-4 w-4" /></span>
        <div>
          <p className="text-[12px] font-semibold text-slate-900">Pre-approved automatically</p>
          <p className="text-[11px] text-slate-500">Loan · 8,000 · affordable</p>
        </div>
      </div>
    </div>
  );
}
