import { useEffect, useState, type ReactNode } from 'react';
import { fetchPublicTenant, type PublicTenant } from '@/lib/auth/session';
import { useDomain } from '@/lib/providers/TenantProvider';
import { Fingerprint, KeyRound, ScrollText } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/Logo';
import { Monogram } from '@/components/brand/Monogram';
import { SignOnArtwork } from '@/components/brand/scenes';
import { brandProps } from '@/lib/brand';

export interface ShellTenant {
  name: string;
  pallette?: { primary?: string; secondary?: string; accent?: string } | null;
}

/** The institution of this host (name, colours) for public pages; null on the platform host or while loading. */
export function usePublicTenant() {
  const domain = useDomain();
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  useEffect(() => {
    if (domain) void fetchPublicTenant(domain).then(setTenant);
  }, [domain]);
  return { domain, tenant };
}

/** Darker and lighter variants of a brand colour for gradients (CSS color-mix, no JS colour maths). */
const shade = (color: string, black: number) => `color-mix(in srgb, ${color} ${100 - black}%, #050816)`;
const tint = (color: string, white: number) => `color-mix(in srgb, ${color} ${100 - white}%, white)`;

/**
 * Two-column page for signing in, activating an account, joining an application or resetting a password: the form on
 * the left, the brand panel on the right (hidden on small screens). On an institution's host everything takes the
 * institution's colour; the institution's name is shown once, by the page (`title`), never by the shell.
 */
export function AuthShell({ tenant, institution, title, description, children }: {
  /** The institution (tenant host), or null on the platform host. */
  tenant?: ShellTenant | null;
  /** True on an institution's host, even before its details arrive (or when it is unknown). */
  institution?: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  const color = tenant?.pallette?.primary || '#5b43e3';
  const onTenant = institution ?? !!tenant;
  const panel = onTenant
    ? `radial-gradient(120% 90% at 100% 0%, ${tint(color, 35)} 0%, transparent 55%), linear-gradient(155deg, ${color} 0%, ${shade(color, 55)} 100%)`
    : 'radial-gradient(110% 80% at 100% 0%, #7b68f6 0%, transparent 55%), radial-gradient(80% 60% at 0% 100%, #0e7490 0%, transparent 60%), linear-gradient(160deg, #4b34c6 0%, #1e174a 70%)';

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]" {...(onTenant ? brandProps(tenant?.pallette?.primary) : {})}>
      <section className="flex min-h-screen flex-col px-6 py-7 sm:px-10 lg:px-14">
        <header className="flex items-center justify-between">
          {onTenant
            ? <Monogram name={tenant?.name ?? '?'} color={tenant?.pallette?.primary} size="md" />
            : <Logo />}
          <span className="text-[12.5px] text-muted-foreground">{onTenant ? 'Client & team access' : 'Operator console'}</span>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[384px] animate-fade-up">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.025em]" style={onTenant && tenant?.pallette?.primary ? { color: shade(color, 15) } : undefined}>{title}</h1>
            {description && <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{description}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <LogoMark className="h-4 w-4 opacity-80" />
            {onTenant ? 'Secured by lintelia' : '© lintelia'}
          </span>
          <span>Two-factor sign-in · every action audited</span>
        </footer>
      </section>

      <aside className="relative m-3 hidden overflow-hidden rounded-[28px] text-white lg:flex lg:flex-col" style={{ background: panel }}>
        <div
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(90%_70%_at_50%_40%,black,transparent)]"
          style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
        <div className="relative flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div className="max-w-md">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              {onTenant ? 'Your secure space' : 'Onboarding, KYC and credit workflows'}
            </p>
            <p className="mt-5 text-[30px] font-semibold leading-[1.15] tracking-[-0.025em] xl:text-[34px]">
              {onTenant ? 'Apply, share documents and follow every step — in one place.' : 'Every client decision, orchestrated and on record.'}
            </p>
            <p className="mt-3 text-[15px] leading-relaxed text-white/70">
              {onTenant
                ? 'Verify your identity, sign agreements and answer requests without e-mail ping-pong.'
                : 'Design flows, connect your vendors and let your teams decide with the full picture.'}
            </p>
          </div>
          <div className="flex justify-center py-8"><SignOnArtwork /></div>
          <ul className="grid grid-cols-3 gap-4 text-[12.5px] text-white/75">
            {[
              [KeyRound, 'Two-factor sign-in'],
              [ScrollText, 'Tamper-evident audit trail'],
              [Fingerprint, 'Identity checks built in'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof KeyRound;
              return (
                <li key={label as string} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10"><I className="h-3.5 w-3.5" /></span>
                  {label as string}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
