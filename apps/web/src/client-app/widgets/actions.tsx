import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Check, Copy, Loader2 } from 'lucide-react';
import { buildEmvPayload, buildEpcPayload } from '@repo/lintelia/utilities';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { resolveProps, useResolved } from '../expressions';
import { appCurrency, formatAs } from '../format';
import { AppIcon } from '../icons';
import { useRuntime } from '../runtime';
import { WidgetCard, useLink, type WidgetProps } from './shared';

/**
 * Buttons and codes (docs/plans/14): a button in the page (any style, icon, size), a floating button over the page,
 * and a QR code to be scanned (a payment request, a reference, a link).
 */

const BUTTON_SIZE = { sm: 'sm', md: 'default', lg: 'lg' } as const;

export function ButtonWidget({ props, scope }: WidgetProps) {
  const link = useLink();
  const p = useResolved(() => resolveProps(props, scope, ['label']), [props, scope]) ?? props;
  const busy = !!props.journey && link.starting === props.journey;
  const style = String(props.style ?? 'primary');
  const variant = style === 'secondary' ? 'secondary' : style === 'outline' ? 'outline' : style === 'ghost' ? 'ghost' : 'default';
  const align = props.align === 'center' ? 'justify-center' : props.align === 'right' ? 'justify-end' : 'justify-start';
  return (
    <div className={cn('flex', align)}>
      <Button
        variant={variant} size={BUTTON_SIZE[props.size as keyof typeof BUTTON_SIZE] ?? 'lg'}
        disabled={!!link.starting || !link.has(props)} onClick={() => void link.go(props, null, scope)}
        className={cn(props.width === 'full' && 'w-full', style === 'accent' && 'bg-highlight text-highlight-foreground hover:bg-highlight/90 active:bg-highlight')}
        data-testid="app-button" data-style={style}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : props.icon ? <AppIcon name={String(props.icon)} className="h-4 w-4" /> : null}
        {String(p.label ?? 'Continue')}
      </Button>
    </div>
  );
}

const FAB_POSITION: Record<string, string> = {
  'bottom-right': 'right-4 sm:right-6',
  'bottom-left': 'left-4 sm:left-6 lg:left-[calc(16rem+1.5rem)]',
  'bottom-center': 'left-1/2 -translate-x-1/2 lg:left-[calc(50%+8rem)]',
};

/** A floating action button: always at hand over the page (above the tab bar on phones). */
export function FabWidget({ props, scope }: WidgetProps) {
  const link = useLink();
  const runtime = useRuntime();
  const p = useResolved(() => resolveProps(props, scope, ['label']), [props, scope]) ?? props;
  const busy = !!props.journey && link.starting === props.journey;
  const label = String(p.label ?? '').trim();
  const accent = props.color === 'accent';
  const button = (
    <button
      type="button" onClick={() => void link.go(props, null, scope)} disabled={!!link.starting || !link.has(props)} aria-label={label || 'Action'}
      className={cn(
        'ui-button inline-flex h-14 items-center justify-center gap-2.5 rounded-full font-semibold shadow-overlay ring-1 ring-black/5 transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60',
        label ? 'px-6 text-[15px]' : 'w-14',
        accent ? 'bg-highlight text-highlight-foreground' : 'bg-primary text-primary-foreground',
      )}
      data-testid="app-fab"
    >
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <AppIcon name={String(props.icon || 'plus')} fallback="plus" className="h-5 w-5" />}
      {label}
    </button>
  );
  // In the studio the button stays in the page (selectable); live, it floats.
  if (runtime.mode === 'preview') return <div className={cn('flex', props.position === 'bottom-left' ? 'justify-start' : props.position === 'bottom-center' ? 'justify-center' : 'justify-end')}>{button}</div>;
  return (
    <div className={cn('fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-40 lg:bottom-8', FAB_POSITION[String(props.position)] ?? FAB_POSITION['bottom-right'])}>{button}</div>
  );
}

/** UTF-8 bytes as a binary string (qrcode-generator writes one byte per character). */
const utf8 = (text: string) => Array.from(new TextEncoder().encode(text), (b) => String.fromCharCode(b)).join('');

/** The dark modules of a QR code as one SVG path (no HTML injection). */
export function qrPath(text: string) {
  const qr = qrcode(0, 'M');
  qr.addData(utf8(text), 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
  }
  return { d, count };
}

export function QrCodeWidget({ props, scope }: WidgetProps) {
  const p = useResolved(() => resolveProps(props, scope), [props, scope]);
  const [copied, setCopied] = useState(false);
  const payload = useMemo(() => {
    if (!p) return null;
    const text = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());
    const amount = text(p.amount);
    try {
      if (p.kind === 'emv') {
        if (!text(p.account) || !text(p.name)) return null;
        return buildEmvPayload({ gui: text(p.accountScheme) || 'br.gov.bcb.pix', account: text(p.account), name: text(p.name), city: text(p.city) || 'CITY', country: text(p.country) || undefined, currency: text(p.currency) || appCurrency(), amount: amount || undefined, reference: text(p.reference) || undefined });
      }
      if (p.kind === 'epc') {
        if (!text(p.account) || !text(p.name)) return null;
        return buildEpcPayload({ name: text(p.name), iban: text(p.account), amount: amount || undefined, reference: text(p.reference) || undefined });
      }
      return text(p.value) || null;
    } catch {
      return null;
    }
  }, [p]);
  const code = useMemo(() => { try { return payload ? qrPath(payload) : null; } catch { return null; } }, [payload]);
  const size = Math.max(96, Math.min(360, Number(props.size) || 200));
  const caption = p?.text ? String(p.text) : '';
  const amount = p?.amount !== undefined && p?.amount !== '' && Number(p?.amount) > 0 ? formatAs(p.amount, 'money', p.kind === 'epc' ? 'EUR' : String(p.currency || appCurrency())) : null;
  const copy = async () => {
    if (!payload) return;
    await navigator.clipboard?.writeText(payload).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <WidgetCard title={props.title || undefined} testId="qr-code">
      <div className="flex flex-col items-center gap-3 p-5 text-center">
        {code ? (
          <svg
            viewBox={`-2 -2 ${code.count + 4} ${code.count + 4}`} width={size} height={size} role="img" aria-label={caption || 'QR code'} shapeRendering="crispEdges"
            className="rounded-xl bg-white p-1 ring-1 ring-border" data-testid="qr-svg" data-payload={payload ?? undefined}
          >
            <rect x={-2} y={-2} width={code.count + 4} height={code.count + 4} fill="#fff" />
            <path d={code.d} fill="#0b1020" />
          </svg>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground" style={{ width: size, height: size }}>{p ? 'Nothing to encode yet' : ''}</div>
        )}
        {amount && <p className="text-xl font-semibold tabular" data-testid="qr-amount">{amount}</p>}
        {caption && <p className="max-w-xs text-sm text-muted-foreground">{caption}</p>}
        {payload && p?.kind !== 'text' && (
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()} data-testid="qr-copy">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy the code'}
          </Button>
        )}
      </div>
    </WidgetCard>
  );
}
