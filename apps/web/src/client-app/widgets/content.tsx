import { ArrowRight, Info, Loader2, Megaphone, PartyPopper, Sparkles } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveProps, useResolved } from '../expressions';
import { appCurrency, formatAs } from '../format';
import { HeroArt } from '../art';
import { RichText, WidgetCard, useLink, type WidgetProps } from './shared';

const useProps = ({ props, scope }: WidgetProps) => useResolved(() => resolveProps(props, scope), [props, scope]);

export function HeroWidget(widget: WidgetProps) {
  const p = useProps(widget) ?? {};
  const value = p.value !== undefined && p.value !== null && p.value !== '' ? formatAs(p.value, (p.format as string) || 'text', (p.currency as string) || appCurrency()) : '';
  return (
    <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-raised" data-testid="hero">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_100%_0%,rgba(255,255,255,0.22),transparent_60%),radial-gradient(60%_90%_at_0%_100%,rgba(0,0,0,0.22),transparent_60%)]" />
      <div className="relative grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[1fr_220px]">
        <div className="min-w-0">
          {!!p.eyebrow && <p className="text-[13px] font-medium opacity-80">{String(p.eyebrow)}</p>}
          {!!p.title && <p className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">{String(p.title)}</p>}
          {!!value && <p className="mt-1 text-[38px] font-semibold leading-none tracking-[-0.03em] tabular sm:text-[44px]" data-testid="hero-value">{value}</p>}
          {!!p.valueLabel && <p className="mt-1 text-[13px] opacity-75">{String(p.valueLabel)}</p>}
          {!!p.subtitle && <p className="mt-3 max-w-md text-[14.5px] leading-relaxed opacity-85">{String(p.subtitle)}</p>}
        </div>
        <HeroArt name={String(p.art ?? 'welcome')} className="hidden w-[220px] text-primary md:block" />
      </div>
    </section>
  );
}

export function HeadingWidget(widget: WidgetProps) {
  const p = useProps(widget) ?? {};
  return (
    <div className="pt-2">
      <h2 className="text-lg font-semibold tracking-tight">{String(p.text ?? '')}</h2>
      {!!p.subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{String(p.subtitle)}</p>}
    </div>
  );
}

export function TextWidget(widget: WidgetProps) {
  const p = useProps(widget) ?? {};
  return <RichText text={String(p.text ?? '')} className={cn(p.muted ? 'text-muted-foreground' : undefined)} />;
}

const TONES: Record<string, { box: string; icon: typeof Info; iconBox: string }> = {
  info: { box: 'border-info/25 bg-info-soft/60', icon: Info, iconBox: 'bg-info/15 text-info' },
  success: { box: 'border-success/25 bg-success-soft/60', icon: PartyPopper, iconBox: 'bg-success/15 text-success' },
  warning: { box: 'border-warning/30 bg-warning-soft/60', icon: Megaphone, iconBox: 'bg-warning/15 text-[hsl(30_85%_38%)]' },
  brand: { box: 'border-primary/25 bg-primary-soft', icon: Sparkles, iconBox: 'bg-primary text-primary-foreground' },
};

export function CalloutWidget(widget: WidgetProps) {
  const p = useProps(widget) ?? {};
  const link = useLink();
  const tone = TONES[String(p.tone ?? 'info')] ?? TONES.info;
  const Icon = tone.icon;
  const raw = widget.props;
  const starting = !!raw.journey && link.starting === raw.journey;
  return (
    <div className={cn('flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center', tone.box)} data-testid="callout">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone.iconBox)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        {!!p.title && <p className="font-semibold tracking-tight">{String(p.title)}</p>}
        {!!p.text && <RichText text={String(p.text)} className="mt-0.5 text-sm text-foreground/80" />}
      </div>
      {!!p.action && link.has(raw) && (
        <Button onClick={() => void link.go(raw, null, widget.scope)} disabled={starting} className="shrink-0">
          {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{String(p.action)}<ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function ImageWidget({ props }: WidgetProps) {
  const url = String(props.url ?? '');
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost(:\d+)?\//.test(url)) return <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">Image address missing</div>;
  return <img src={url} alt={String(props.alt ?? '')} style={{ height: Number(props.height) || 200 }} className="w-full rounded-2xl border object-cover" loading="lazy" referrerPolicy="no-referrer" />;
}

export function FaqWidget({ props }: WidgetProps) {
  const items = Array.isArray(props.items) ? (props.items as Array<{ question?: string; answer?: string }>) : [];
  return (
    <WidgetCard title={props.title as string | undefined} testId="faq">
      <Accordion type="single" collapsible className="px-5">
        {items.map((item, i) => (
          <AccordionItem key={i} value={String(i)} className="last:border-b-0">
            <AccordionTrigger className="text-left text-[14.5px] hover:no-underline">{item.question}</AccordionTrigger>
            <AccordionContent><RichText text={item.answer ?? ''} className="text-sm text-muted-foreground" /></AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </WidgetCard>
  );
}

export function EmbedWidget({ props }: WidgetProps) {
  const url = String(props.url ?? '');
  if (!/^https:\/\//.test(url) && !/^http:\/\/localhost(:\d+)?\//.test(url)) return <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed text-sm text-muted-foreground">Embedded page: address missing</div>;
  // Sandboxed: scripts run in their own origin, no access to the app, its session or the top window.
  return (
    <iframe
      src={url} title={String(props.title ?? 'Embedded page')} style={{ height: Number(props.height) || 480 }}
      className="w-full rounded-2xl border bg-card" sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" loading="lazy"
    />
  );
}
