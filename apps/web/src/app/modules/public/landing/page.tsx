import { Link } from 'react-router';
import {
  ArrowRight, BadgeCheck, Blocks, Building2, Cable, FileSignature, Fingerprint, Gavel, KeyRound, Layers3, LockKeyhole, MailCheck,
  Radar, ScanSearch, ScrollText, ShieldCheck, Sparkles, UsersRound, Webhook, Workflow,
} from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { ProductShot } from '@/components/brand/scenes';
import { WorkflowArt, ShieldArt, DocumentsArt } from '@/components/brand/illustrations';
import { cn } from '@/lib/utils';

const CONNECTORS = [
  { name: 'Didit', what: 'Identity verification', icon: Fingerprint },
  { name: 'Documenso', what: 'E-signature', icon: FileSignature },
  { name: 'AML screening', what: 'Sanctions & PEP', icon: Radar },
  { name: 'PostgreSQL', what: 'Core banking data', icon: Layers3 },
  { name: 'SMTP', what: 'Your own mail server', icon: MailCheck },
  { name: 'WorkOS', what: 'Single sign-on & SCIM', icon: KeyRound },
];

const FEATURES = [
  {
    icon: Workflow, title: 'Visual workflow builder',
    text: 'Compose onboarding, lending and investigation flows from tested components: calculations, reviews, client requests, sub-workflows.',
    art: WorkflowArt, span: 'md:col-span-2',
  },
  { icon: Gavel, title: 'Case management', text: 'Queues per role, claims, SLAs that escalate, four-eyes approvals above your thresholds.' },
  { icon: UsersRound, title: 'Client portal & embedded forms', text: 'Applicants apply from your website, confirm by e-mail and follow every step in a portal in your colours.' },
  { icon: Cable, title: 'Connectors, not custom code', text: 'Vendors plug in as separate services with their own secrets. Install, consent, configure — from the back office.' },
  { icon: Fingerprint, title: 'Identity and signatures in the flow', text: 'Clients verify and sign on the vendor’s own page without leaving the portal; results arrive by signed webhooks.' },
  {
    icon: ScrollText, title: 'Evidence on record',
    text: 'Every action lands in a hash-chained, append-only audit trail. Export a complete evidence pack per case in one click.',
    art: DocumentsArt, span: 'md:col-span-2',
  },
  { icon: Webhook, title: 'API and webhooks', text: 'Start cases from your systems with OAuth clients and idempotent requests; receive every change as a signed event.' },
];

const SECURITY = [
  { icon: LockKeyhole, title: 'Isolation by design', text: 'Row-level security separates every institution inside the database, not just in the application.' },
  { icon: KeyRound, title: 'Strong sign-in', text: 'Two-factor authentication for every member, single sign-on through your identity provider.' },
  { icon: ScanSearch, title: 'Safe uploads', text: 'Files are type-checked, scanned for malware and sanitised before anyone can open them.' },
  { icon: Webhook, title: 'Signed events', text: 'Webhooks follow the Standard Webhooks spec, with retries, a delivery log and secret rotation.' },
];

function Section({ id, eyebrow, title, text, children, className }: { id?: string; eyebrow: string; title: string; text?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-6 py-20 sm:py-24', className)}>
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h2 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[40px]">{title}</h2>
        {text && <p className="mt-4 text-[16px] leading-relaxed text-muted-foreground">{text}</p>}
      </div>
      <div className="mt-14">{children}</div>
    </section>
  );
}

/** Public home of the platform host. */
export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" aria-label="Fintivio home"><Logo /></Link>
          <nav className="hidden items-center gap-8 text-[14px] text-muted-foreground md:flex">
            <a href="#product" className="transition-colors hover:text-foreground">Product</a>
            <a href="#connectors" className="transition-colors hover:text-foreground">Connectors</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/sign-on" className="hidden h-9 items-center rounded-lg px-3.5 text-[14px] font-medium text-foreground/80 transition-colors hover:bg-accent sm:inline-flex">Sign in</Link>
            <Link to="/sign-on" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[14px] font-medium text-background shadow-xs transition hover:bg-foreground/90">
              Open the console<ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="bg-aurora pointer-events-none absolute inset-0" />
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_30%,black,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-6 pb-24 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-[12.5px] font-medium text-muted-foreground shadow-xs backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />Workflows · cases · connectors
            </p>
            <h1 className="mt-5 text-[40px] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-[50px]">
              Onboard, verify and <span className="text-gradient">decide</span> — with every step on record.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
              Fintivio is the workflow platform for financial institutions: account opening, KYC and KYB, lending and
              investigations, built from components and run by your teams with a full audit trail.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/sign-on" className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground shadow-glow transition hover:bg-primary/90">
                Open the console<ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#product" className="inline-flex h-11 items-center rounded-xl border bg-background px-5 text-[15px] font-medium shadow-xs transition hover:bg-accent">See how it works</a>
            </div>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[['Durable', 'executions survive restarts'], ['Four-eyes', 'approvals built in'], ['Per case', 'evidence export']].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[15px] font-semibold tracking-tight">{k}</dt>
                  <dd className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <ProductShot className="mx-auto w-full max-w-[620px] lg:translate-x-4" />
        </div>
      </section>

      {/* connectors strip */}
      <section id="connectors" className="border-y bg-canvas/60">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="text-center text-[13px] font-medium text-muted-foreground">Connects to the services your compliance stack already relies on</p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONNECTORS.map(({ name, what, icon: Icon }) => (
              <li key={name} className="flex items-center gap-3 rounded-xl border bg-background px-3.5 py-3 shadow-xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13.5px] font-semibold">{name}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">{what}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* features */}
      <Section id="product" eyebrow="Product" title="Everything between “apply” and “approved”" text="One platform for the people who design flows, the teams who decide and the clients who apply.">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, art: Art, span }) => (
            <article key={title} className={cn('group relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card transition hover:shadow-raised', span)}>
              <div className={cn(Art && 'md:grid md:grid-cols-[1fr_200px] md:items-center md:gap-6')}>
                <div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">{text}</p>
                </div>
                {Art && <Art className="mt-4 hidden w-[200px] md:mt-0 md:block" />}
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* how it works */}
      <section className="border-y bg-canvas/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-3">
            {[
              { n: '01', icon: Blocks, title: 'Design', text: 'Designers build the flow and the forms, validate and publish versions. Running cases keep the version they started with.' },
              { n: '02', icon: Cable, title: 'Connect', text: 'Integration managers connect identity, signature, screening and data-source vendors, each in its own service.' },
              { n: '03', icon: BadgeCheck, title: 'Decide', text: 'Small, clear cases decide themselves. The rest reach the right queue with the full picture — and the client sees progress.' },
            ].map(({ n, icon: Icon, title, text }) => (
              <div key={n} className="relative">
                <span className="font-mono text-[13px] text-primary">{n}</span>
                <div className="mt-3 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border bg-background text-foreground shadow-xs"><Icon className="h-5 w-5" /></span>
                  <h3 className="text-[20px] font-semibold tracking-tight">{title}</h3>
                </div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* security */}
      <section id="security" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="relative overflow-hidden rounded-[28px] bg-[#120e2e] p-8 text-white shadow-overlay sm:p-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(123,104,246,0.45),transparent_60%),radial-gradient(50%_70%_at_0%_100%,rgba(14,116,144,0.35),transparent_60%)]" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_260px]">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-300">Security</p>
              <h2 className="mt-3 max-w-xl text-[32px] font-semibold leading-tight tracking-[-0.03em] sm:text-[38px]">Built for regulated work from the first line of code.</h2>
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {SECURITY.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="flex gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-200"><Icon className="h-5 w-5" /></span>
                    <div>
                      <h3 className="text-[15px] font-semibold">{title}</h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-white/65">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 lg:block [&_.fill-card]:fill-[#1d1846] [&_.stroke-border]:stroke-white/15">
              <ShieldArt />
            </div>
          </div>
        </div>
      </section>

      {/* call to action */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center justify-between gap-6 rounded-[28px] border bg-card p-10 text-center shadow-card md:flex-row md:text-left">
          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Your institution already has an address?</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">Members and clients sign in on it, e.g. <span className="font-mono text-[13.5px]">demo-bank.localhost:3001</span>. Platform staff sign in here.</p>
          </div>
          <Link to="/sign-on" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-medium text-primary-foreground shadow-glow transition hover:bg-primary/90">
            <Building2 className="h-4 w-4" />Staff sign-in
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-[13px] text-muted-foreground">
          <Logo size="sm" />
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-success" />Two-factor sign-in · tamper-evident audit · per-institution isolation</span>
        </div>
      </footer>
    </div>
  );
}
