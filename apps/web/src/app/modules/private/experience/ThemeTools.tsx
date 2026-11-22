import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ImageUp, Loader2, Pipette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contrastRatio, hexToHsl, labelColour } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { InspectorSection } from './Inspector';
import type { Definition } from './studio-model';

/**
 * Branding helpers of the studio (docs/plans/14): theme presets, colours taken from the logo, and a contrast check
 * (WCAG) of the chosen colours.
 */

type Theme = Definition['theme'];

export const CURRENCIES: Array<[string, string]> = [
  ['GBP', 'Pound sterling'], ['EUR', 'Euro'], ['USD', 'US dollar'], ['CAD', 'Canadian dollar'], ['AUD', 'Australian dollar'], ['NZD', 'New Zealand dollar'],
  ['CHF', 'Swiss franc'], ['SEK', 'Swedish krona'], ['NOK', 'Norwegian krone'], ['DKK', 'Danish krone'], ['PLN', 'Polish złoty'], ['BRL', 'Brazilian real'],
  ['MXN', 'Mexican peso'], ['ARS', 'Argentine peso'], ['CLP', 'Chilean peso'], ['COP', 'Colombian peso'], ['INR', 'Indian rupee'], ['SGD', 'Singapore dollar'],
  ['HKD', 'Hong Kong dollar'], ['JPY', 'Japanese yen'], ['ZAR', 'South African rand'], ['AED', 'UAE dirham'],
];
export const LOCALES: Array<[string, string]> = [
  ['en-GB', 'English, UK'], ['en-US', 'English, US'], ['en-IE', 'English, Ireland'], ['en-CA', 'English, Canada'], ['en-AU', 'English, Australia'], ['en-IN', 'English, India'],
  ['fr-FR', 'Français'], ['de-DE', 'Deutsch'], ['es-ES', 'Español, España'], ['es-MX', 'Español, México'], ['es-AR', 'Español, Argentina'], ['pt-BR', 'Português, Brasil'],
  ['pt-PT', 'Português, Portugal'], ['it-IT', 'Italiano'], ['nl-NL', 'Nederlands'], ['pl-PL', 'Polski'], ['sv-SE', 'Svenska'],
];

/** Starting points: a coherent set of colour, type and shapes. */
export const THEME_PRESETS: Array<{ key: string; label: string; theme: Partial<Theme> }> = [
  { key: 'classic', label: 'Classic bank', theme: { primary: '#0b3b8c', accent: '#f2a900', background: '', font: 'system', radius: 'default', buttonShape: 'rounded', header: 'brand', colorScheme: 'auto' } },
  { key: 'neo', label: 'Neo bank', theme: { primary: '#6d28d9', accent: '#0e7490', background: '#f7f5ff', font: 'geometric', radius: 'soft', buttonShape: 'pill', header: 'light', colorScheme: 'auto' } },
  { key: 'private', label: 'Private banking', theme: { primary: '#1f2937', accent: '#8a6a2f', background: '#faf8f5', font: 'serif', radius: 'sharp', buttonShape: 'square', header: 'light', colorScheme: 'light' } },
  { key: 'fresh', label: 'Fresh', theme: { primary: '#047857', accent: '#c2410c', background: '#f3faf7', font: 'rounded', radius: 'soft', buttonShape: 'pill', header: 'light', colorScheme: 'auto' } },
  { key: 'midnight', label: 'Midnight', theme: { primary: '#2563eb', accent: '#be185d', background: '', font: 'humanist', radius: 'default', buttonShape: 'rounded', header: 'light', colorScheme: 'dark' } },
];

const clean = (theme: Theme): Theme => Object.fromEntries(Object.entries(theme).filter(([, v]) => v !== '' && v !== undefined)) as Theme;

export function ThemeTools({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <>
      <InspectorSection title="Start from a preset" description="Sets colours, font and shapes at once; adjust anything below.">
        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((preset) => {
            const active = preset.theme.primary === theme.primary && preset.theme.font === theme.font;
            return (
              <button
                key={preset.key} type="button" onClick={() => onChange(clean({ ...theme, ...preset.theme } as Theme))} data-testid="theme-preset" data-preset={preset.key}
                className={cn('flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors hover:border-foreground/30', active && 'border-primary ring-2 ring-primary/20')}
              >
                <span className="flex shrink-0 -space-x-1.5">
                  <span className="h-5 w-5 rounded-full ring-2 ring-background" style={{ background: preset.theme.primary }} />
                  <span className="h-5 w-5 rounded-full ring-2 ring-background" style={{ background: preset.theme.accent }} />
                </span>
                <span className="min-w-0 truncate font-medium">{preset.label}</span>
              </button>
            );
          })}
        </div>
      </InspectorSection>
      <LogoColours theme={theme} onChange={onChange} />
      <ContrastCheck theme={theme} />
    </>
  );
}

/**
 * How readable the chosen colours are (WCAG 2 AA): labels on the primary and accent colours (4.5:1; labels are
 * near-black or white, chosen by the app), the primary colour as links and icons on the background (3:1), text on the
 * background tint (4.5:1).
 */
export function ContrastCheck({ theme }: { theme: Theme }) {
  const checks: Array<{ key: string; label: string; ratio: number | null; min: number; advice: string }> = [];
  const background = hexToHsl(theme.background) ? theme.background! : '#ffffff';
  const labelOn = (colour: string) => contrastRatio(colour, labelColour(colour));
  if (hexToHsl(theme.primary)) {
    checks.push({ key: 'primary-label', label: 'Labels on buttons in the primary colour', ratio: labelOn(theme.primary!), min: 4.5, advice: 'choose a darker or a lighter colour' });
    checks.push({ key: 'primary-text', label: 'Links and icons in the primary colour, on the background', ratio: contrastRatio(theme.primary!, background), min: 3, advice: 'choose a darker colour' });
  }
  if (hexToHsl(theme.accent)) checks.push({ key: 'accent', label: 'Labels on the accent colour (floating buttons, accent buttons)', ratio: labelOn(theme.accent!), min: 4.5, advice: 'choose a darker or a lighter colour' });
  if (hexToHsl(theme.background)) checks.push({ key: 'background', label: 'Text on the background tint', ratio: contrastRatio('#141827', theme.background!), min: 4.5, advice: 'choose a lighter tint' });
  if (!checks.length) return null;
  return (
    <InspectorSection title="Readability" description="Contrast of your colours (WCAG AA). Labels on colours are black or white, whichever the colour allows.">
      <ul className="space-y-1.5" data-testid="contrast-check">
        {checks.map((c) => {
          const ok = c.ratio !== null && c.ratio >= c.min;
          return (
            <li key={c.key} className="flex items-start gap-2 text-xs" data-testid="contrast" data-check={c.key} data-ok={ok}>
              {ok ? <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-success" /> : <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />}
              <span className="flex-1">{c.label}{!ok && <span className="block text-muted-foreground">Hard to read for some clients: {c.advice}.</span>}</span>
              <span className="font-mono tabular text-muted-foreground">{c.ratio ? c.ratio.toFixed(1) : '–'}:1</span>
            </li>
          );
        })}
      </ul>
    </InspectorSection>
  );
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * The dominant colours of an image: pixels grouped in buckets (transparent, near-white, near-grey and near-black ones
 * left out), the most frequent saturated colour first, then colours of another hue.
 */
export function dominantColours(data: Uint8ClampedArray, count = 3): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max > 240 && min > 225) continue; // white
    if (max < 28) continue; // black
    if (max - min < 24) continue; // grey
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1; bucket.r += r; bucket.g += g; bucket.b += b;
    buckets.set(key, bucket);
  }
  const sorted = [...buckets.values()].sort((x, y) => y.n - x.n).map((c) => toHex(c.r / c.n, c.g / c.n, c.b / c.n));
  const picked: string[] = [];
  for (const colour of sorted) {
    const hue = hexToHsl(colour)![0];
    if (picked.every((p) => Math.min(Math.abs(hexToHsl(p)![0] - hue), 360 - Math.abs(hexToHsl(p)![0] - hue)) > 25)) picked.push(colour);
    if (picked.length >= count) break;
  }
  return picked;
}

function LogoColours({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  const [colours, setColours] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const read = async (source: string) => {
    setBusy(true);
    setProblem(null);
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('load')); image.src = source; });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 160 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const found = dominantColours(context.getImageData(0, 0, canvas.width, canvas.height).data);
      setColours(found);
      if (!found.length) setProblem('No brand colour found (the logo looks black, white or grey).');
    } catch {
      setProblem('This logo cannot be read from its address (the site does not allow it): use “From a file”.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <InspectorSection title="Colours from your logo" description="Reads the logo in your browser (nothing is uploaded) and suggests colours.">
      <div className="flex flex-wrap gap-2">
        {theme.logoUrl && <Button type="button" size="sm" variant="outline" onClick={() => void read(theme.logoUrl!)} disabled={busy} data-testid="logo-colours-url">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pipette className="h-3.5 w-3.5" />}From the logo address</Button>}
        <Button type="button" size="sm" variant="outline" onClick={() => file.current?.click()} disabled={busy}><ImageUp className="h-3.5 w-3.5" />From a file</Button>
        <input
          ref={file} type="file" accept="image/*" className="sr-only" data-testid="logo-colours-file"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            e.target.value = '';
            if (!picked) return;
            const url = URL.createObjectURL(picked);
            void read(url).finally(() => URL.revokeObjectURL(url));
          }}
        />
      </div>
      {problem && <p className="text-xs text-destructive">{problem}</p>}
      {colours && colours.length > 0 && (
        <div className="space-y-2" data-testid="logo-colours">
          {colours.map((colour, i) => (
            <div key={colour} className="flex items-center gap-2 text-xs" data-testid="logo-colour" data-colour={colour}>
              <span className="h-6 w-6 shrink-0 rounded-md ring-1 ring-border" style={{ background: colour }} />
              <span className="flex-1 font-mono">{colour}</span>
              <Button type="button" size="sm" variant={i === 0 ? 'default' : 'ghost'} className="h-7 px-2 text-xs" onClick={() => onChange({ ...theme, primary: colour })} data-testid="use-as-primary">Primary</Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onChange({ ...theme, accent: colour })} data-testid="use-as-accent">Accent</Button>
            </div>
          ))}
        </div>
      )}
    </InspectorSection>
  );
}
