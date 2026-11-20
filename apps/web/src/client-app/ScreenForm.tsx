import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Timer } from 'lucide-react';
import { parsePaymentCode, VALUE_CHECKS } from '@repo/lintelia/utilities';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { RequestFileUploader } from '@/components/app/files';
import { cn } from '@/lib/utils';
import { evaluate, useResolved } from './expressions';
import { currencySymbol, formatAs } from './format';
import { OtpInput } from './inputs/OtpInput';
import { ScanInput } from './inputs/ScanInput';
import { SignatureInput } from './inputs/SignatureInput';
import { RichText } from './widgets/shared';
import type { ScreenField, ScreenView } from './types';

export type FieldErrors = Record<string, string>;

type Values = Record<string, unknown>;

const isEmpty = (field: ScreenField, value: unknown) =>
  value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length) || (field.type === 'checkbox' && value !== true);

/**
 * What expressions of a screen read (visibleIf, calculated fields, the auto-submit rule): the answers, plus what each
 * scanned code says as `<key>Details` (payee, amount…), as the API does.
 */
export function screenScope(fields: ScreenField[], values: Values): Values {
  const scope: Values = { ...values };
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === 'scan' && field.parse && field.parse !== 'raw' && typeof value === 'string' && value) {
      const { raw: _raw, ...details } = parsePaymentCode(value, field.parse);
      scope[`${field.key}Details`] = details;
    }
  }
  return scope;
}

/** The problem with one answer (the same rules as the API), or null. */
function problemOf(field: ScreenField, value: unknown): string | null {
  if (field.type === 'display') return null;
  if (isEmpty(field, value)) {
    if (!field.required) return null;
    return field.type === 'checkbox' ? 'Please confirm to continue'
      : field.type === 'file' ? 'Please add a file (wait until it is checked)'
      : field.type === 'signature' ? 'Please sign and save your signature'
      : field.type === 'scan' ? 'Please scan the code'
      : 'Required';
  }
  if (field.type === 'number' || field.type === 'money' || field.type === 'slider') {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'Enter a number';
    if (field.min !== undefined && n < field.min) return `At least ${field.type === 'money' ? formatAs(field.min, 'money') : field.min}`;
    if (field.max !== undefined && n > field.max) return `At most ${field.type === 'money' ? formatAs(field.max, 'money') : field.max}`;
  }
  if (field.type === 'otp' && !new RegExp(`^\\d{${field.length ?? 6}}$`).test(String(value))) return `Enter the ${field.length ?? 6} digits`;
  if (field.type === 'scan' && field.parse && field.parse !== 'raw' && field.parse !== 'auto') {
    const details = parsePaymentCode(String(value), field.parse);
    if (!details.valid) return details.problem ?? 'This code cannot be read';
  }
  if (typeof value === 'string' && value) {
    if (field.pattern) {
      try {
        if (!new RegExp(field.pattern).test(value)) return field.patternMessage ?? 'Not in the expected format';
      } catch { /* the API refused broken patterns at publication */ }
    }
    if (field.check && VALUE_CHECKS[field.check] && !VALUE_CHECKS[field.check].test(value)) {
      const message = VALUE_CHECKS[field.check].message;
      return message.charAt(0).toUpperCase() + message.slice(1);
    }
  }
  return null;
}

/**
 * A journey screen (`client.screen` step): text, fields and buttons. Each button is an event of the workflow; buttons
 * marked `skipValidation` (Back, Cancel) send without checks. The API validates again and answers per field.
 * Fields may show on a condition (`visibleIf`), be calculated (`display`), sit two per row (`width: half`); a screen
 * may continue by itself (`autoSubmit`) once complete or when a rule holds, after a countdown the client can stop.
 */
export function ScreenForm({ screen, onSubmit, busy, errors, error, preview }: {
  screen: ScreenView;
  onSubmit: (event: string, values: Record<string, unknown>) => void;
  busy: string | null;
  errors: FieldErrors;
  error: string | null;
  preview?: boolean;
}) {
  // Sliders start at their minimum (a slider always has a value).
  const initial = (): Values => ({
    ...Object.fromEntries(screen.fields.filter((f) => f.type === 'slider').map((f) => [f.key, f.min ?? 0])),
    ...screen.values,
  });
  const [values, setValues] = useState<Values>(initial);
  const [local, setLocal] = useState<FieldErrors>({});
  useEffect(() => setValues(initial()), [screen.taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    setLocal((e) => ({ ...e, [key]: '' }));
  };

  const scope = useMemo(() => screenScope(screen.fields, values), [screen.fields, values]);
  // Which conditional fields show (hidden until their rule was evaluated once, so they never flash).
  const visibility = useResolved(async () => {
    const entries = await Promise.all(screen.fields.filter((f) => f.visibleIf).map(async (f) => [f.key, Boolean(await evaluate(f.visibleIf!, scope))] as const));
    return Object.fromEntries(entries) as Record<string, boolean>;
  }, [screen.fields, scope]);
  const shown = (field: ScreenField) => !field.visibleIf || visibility?.[field.key] === true;
  const visible = screen.fields.filter(shown);

  /** The answers sent: hidden fields and calculated ones are left out. */
  const answers = () => Object.fromEntries(Object.entries(values).filter(([key]) => {
    const field = screen.fields.find((f) => f.key === key);
    return !field || (field.type !== 'display' && shown(field));
  }));

  const check = () => {
    const found: FieldErrors = {};
    for (const field of visible) {
      const problem = problemOf(field, values[field.key]);
      if (problem) found[field.key] = problem;
    }
    setLocal(found);
    return !Object.values(found).some(Boolean);
  };

  const press = (button: ScreenView['buttons'][number]) => {
    if (!button.skipValidation && !check()) return;
    onSubmit(button.key, answers());
  };
  const primary = screen.buttons.find((b) => b.style === 'primary') ?? screen.buttons[0];
  const fieldError = (key: string) => local[key] || errors[key];

  // Continue by itself: when every visible field is valid (and, with a rule, when the rule holds too).
  const auto = screen.autoSubmit;
  const autoButton = auto ? screen.buttons.find((b) => b.key === auto.button) : undefined;
  // The answers it is ready for: a result computed for other answers (still resolving) never counts.
  const answersKey = JSON.stringify(answers());
  const readyFor = useResolved(async () => {
    if (!auto || !autoButton || preview || (visibility === undefined && screen.fields.some((f) => f.visibleIf))) return null;
    // Never with a problem on the screen; with a rule, also when the rule holds.
    const valid = visible.some((f) => f.type !== 'display' && !isEmpty(f, values[f.key])) && visible.every((f) => !problemOf(f, values[f.key]));
    if (!valid) return null;
    const holds = auto.when === 'expression' ? Boolean(await evaluate(auto.expression ?? '', scope)) : true;
    return holds ? answersKey : null;
  }, [auto, scope, visibility, preview]);
  const readyKey = readyFor && readyFor === answersKey ? readyFor : null;
  const [stopped, setStopped] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const fired = useRef<string | null>(null);
  useEffect(() => {
    setCountdown(null);
    if (!readyKey || !autoButton || busy || error || stopped === readyKey || fired.current === readyKey) return;
    let left = auto?.delay ?? 0;
    const fire = () => {
      fired.current = readyKey;
      setCountdown(null);
      press(autoButton);
    };
    if (left <= 0) { fire(); return; }
    setCountdown(left);
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(timer); fire(); } else setCountdown(left);
    }, 1000);
    return () => clearInterval(timer);
  }, [readyKey, stopped, busy, error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form
      className="space-y-6" data-testid="journey-screen" data-task={screen.taskId}
      onSubmit={(e) => { e.preventDefault(); if (primary) press(primary); }}
    >
      <div>
        <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]" data-testid="screen-title">{screen.title}</h2>
        {screen.description && <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{screen.description}</p>}
      </div>
      {screen.content && <div className="rounded-xl border bg-muted/25 p-4" data-testid="screen-content"><RichText text={screen.content} /></div>}
      {visible.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          {visible.map((field) => (
            <div key={field.key} className={cn('min-w-0', field.width === 'half' && field.type !== 'checkbox' ? 'col-span-2 sm:col-span-1' : 'col-span-2')}>
              {field.type === 'display'
                ? <DisplayField field={field} scope={scope} />
                : <FieldInput field={field} value={values[field.key]} onChange={(v) => set(field.key, v)} error={fieldError(field.key)} taskId={screen.taskId} preview={preview} />}
            </div>
          ))}
        </div>
      )}
      {countdown !== null && autoButton && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft px-3.5 py-3 text-sm" role="status" data-testid="auto-submit">
          <Timer className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1">{autoButton.label} in <b className="tabular" data-testid="auto-submit-seconds">{countdown}</b> s…</span>
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => setStopped(readyKey)} data-testid="auto-submit-stop">Stop</Button>
        </div>
      )}
      {error && <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive" role="alert" data-testid="screen-error"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        {/* Primary action last: right-most on wide screens, on top on phones. */}
        {[...screen.buttons].sort((a, b) => Number(a === primary) - Number(b === primary)).map((button) => (
          <Button
            key={button.key} type={button === primary ? 'submit' : 'button'} size="lg" disabled={!!busy}
            variant={button.style === 'danger' ? 'destructive' : button.style === 'secondary' ? 'outline' : 'default'}
            onClick={button === primary ? undefined : () => press(button)}
            className={cn(button.style === 'primary' && 'sm:min-w-[160px]')} data-testid={`screen-button-${button.key}`}
          >
            {busy === button.key && <Loader2 className="h-4 w-4 animate-spin" />}{button.label}
          </Button>
        ))}
      </div>
    </form>
  );
}

/** A calculated line (a total, a monthly payment, a fee): JSONata over the answers, formatted; never sent. */
function DisplayField({ field, scope }: { field: ScreenField; scope: Values }) {
  const value = useResolved(() => evaluate(field.expression ?? '', scope), [field.expression, scope]);
  const text = value === undefined || value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value)) ? '—' : formatAs(value, field.format ?? 'text');
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-xl border bg-muted/25 px-4 py-3" data-testid={`field-${field.key}`}>
      <span className="text-[13.5px] text-muted-foreground">{field.label}</span>
      <span className="text-lg font-semibold tabular" data-testid={`display-${field.key}`}>{text}</span>
    </div>
  );
}

function FieldInput({ field, value, onChange, error, taskId, preview }: { field: ScreenField; value: unknown; onChange: (value: unknown) => void; error?: string; taskId: string; preview?: boolean }) {
  const id = `field-${field.key}`;
  const invalid = !!error;
  const text = value === undefined || value === null ? '' : String(value);
  const control = 'h-11 text-[15px] aria-[invalid=true]:border-destructive';
  const label = (
    <Label htmlFor={id} className="text-[13.5px]">
      {field.label}{!field.required && field.type !== 'checkbox' && <span className="font-normal text-muted-foreground"> (optional)</span>}
    </Label>
  );
  let input;
  switch (field.type) {
    case 'textarea':
      input = <Textarea id={id} rows={4} value={text} placeholder={field.placeholder} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} className="text-[15px]" />;
      break;
    case 'select':
      input = (
        <select id={id} value={text} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)} className={cn('w-full rounded-lg border border-input bg-background px-3 shadow-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20', control, !text && 'text-muted-foreground')}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case 'choice':
      input = (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="grid gap-2.5 sm:grid-cols-2">
          {(field.options ?? []).map((o) => {
            const selected = text === o.value;
            return (
              <button
                key={o.value} type="button" role="radio" aria-checked={selected} onClick={() => onChange(o.value)} data-testid={`choice-${field.key}-${o.value}`}
                className={cn('flex items-start gap-3 rounded-xl border p-3.5 text-left text-sm transition-colors', selected ? 'border-primary bg-primary-soft ring-2 ring-primary/20' : 'bg-card hover:border-foreground/25')}
              >
                <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', selected ? 'border-primary' : 'border-input')}>{selected && <span className="h-2 w-2 rounded-full bg-primary" />}</span>
                <RichText text={o.label} className="text-sm leading-snug" />
              </button>
            );
          })}
        </div>
      );
      break;
    case 'checkbox':
      return (
        <div className="space-y-1.5">
          <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm', invalid ? 'border-destructive/50' : 'bg-muted/20')}>
            <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(c === true)} className="mt-0.5" />
            <span className="leading-snug">{field.label}</span>
          </label>
          {error && <p className="text-[13px] text-destructive" data-testid={`error-${field.key}`}>{error}</p>}
        </div>
      );
    case 'file':
      input = preview
        ? <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Upload (not available in the preview)</div>
        : <RequestFileUploader taskId={taskId} itemKey={field.key} label={field.label} onChange={(ids) => onChange(ids)} capture={field.capture} />;
      break;
    case 'money': {
      const symbol = currencySymbol();
      input = (
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground" data-testid={`currency-${field.key}`}>{symbol}</span>
          <Input id={id} className={cn(control, 'tabular')} style={{ paddingLeft: `${Math.max(2, symbol.length * 0.6 + 1.4)}rem` }} inputMode="decimal" value={text} placeholder={field.placeholder ?? '0.00'} aria-invalid={invalid} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ''))} />
        </div>
      );
      break;
    }
    case 'scan':
      input = <ScanInput field={field} value={value} onChange={onChange} invalid={invalid} preview={preview} />;
      break;
    case 'signature':
      input = <SignatureInput taskId={taskId} fieldKey={field.key} label={field.label} value={value} onChange={onChange} invalid={invalid} preview={preview} />;
      break;
    case 'otp':
      input = <OtpInput id={id} length={field.length} value={value} onChange={onChange} secret={field.secret} invalid={invalid} />;
      break;
    case 'slider': {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const current = Number.isFinite(Number(value)) && value !== '' && value !== undefined && value !== null ? Number(value) : min;
      const shown = (n: number) => formatAs(n, field.format === 'money' || field.format === 'percent' || field.format === 'number' ? field.format : 'number');
      input = (
        <div className="space-y-2.5 rounded-xl border bg-muted/20 px-4 py-3.5" data-testid={`slider-${field.key}`}>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-semibold tabular" data-testid={`slider-value-${field.key}`}>{value === undefined || value === '' || value === null ? '—' : shown(current)}</span>
            <span className="text-xs text-muted-foreground">{shown(min)} – {shown(max)}</span>
          </div>
          <Slider id={id} min={min} max={max} step={field.step ?? 1} value={[current]} onValueChange={([n]) => onChange(n)} aria-invalid={invalid} aria-labelledby={`${id}-label`} />
        </div>
      );
      break;
    }
    default:
      input = (
        <Input
          id={id} className={control} value={text} placeholder={field.placeholder} aria-invalid={invalid} onChange={(e) => onChange(e.target.value)}
          type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          autoComplete={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : undefined}
        />
      );
  }
  return (
    <div className="space-y-1.5" data-testid={`field-${field.key}`}>
      <span id={`${id}-label`}>{label}</span>
      {input}
      {field.help && !error && <p className="text-[13px] text-muted-foreground">{field.help}</p>}
      {error && <p className="text-[13px] text-destructive" data-testid={`error-${field.key}`}>{error}</p>}
    </div>
  );
}
