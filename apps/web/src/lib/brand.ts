import type { CSSProperties } from 'react';

/** `#0f3d91` / `#fff` → [h, s, l] (degrees, percent, percent); null when the value is not a hex colour. */
export function hexToHsl(value: string | null | undefined): [number, number, number] | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((value ?? '').trim());
  if (!match) return null;
  const hex = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** Relative luminance of a hex colour (0 black … 1 white). */
function luminance(value: string) {
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Theme variables that make `bg-primary`, rings, soft tints… use an institution's brand colour (client-facing pages:
 * sign-on, portal, client app, embedded forms), for the light and the dark theme: in the dark theme a dark brand colour
 * is lifted so it stays readable, and soft tints are dark. The element needs `data-brand` (see `brandProps`);
 * `globals.css` picks the light or dark set. Empty when the colour is not a hex value (the Fintivio theme stays).
 */
export function brandStyle(color: string | null | undefined): CSSProperties {
  const hsl = hexToHsl(color);
  if (!hsl || !color) return {};
  const [h, s, l] = hsl;
  const foreground = luminance(color.startsWith('#') ? color : `#${color}`) > 0.45 ? '232 33% 11%' : '0 0% 100%';
  const dark = l < 50 ? Math.min(60, l + 22) : l;
  return {
    '--brand-l-primary': `${h} ${s}% ${l}%`,
    '--brand-l-primary-foreground': foreground,
    '--brand-l-ring': `${h} ${s}% ${Math.min(l, 55)}%`,
    '--brand-l-soft': `${h} ${Math.min(s, 80)}% 96.5%`,
    '--brand-l-strong': `${h} ${s}% ${Math.max(l - 12, 18)}%`,
    '--brand-d-primary': `${h} ${s}% ${dark}%`,
    '--brand-d-primary-foreground': dark >= 65 ? '232 33% 11%' : '0 0% 100%',
    '--brand-d-ring': `${h} ${s}% ${Math.max(dark, 55)}%`,
    '--brand-d-soft': `${h} ${Math.min(s, 45)}% 17%`,
    '--brand-d-strong': `${h} ${s}% ${Math.min(dark + 10, 75)}%`,
  } as CSSProperties;
}

/** Props of an element in the institution's colours: the variables and the `data-brand` marker. */
export function brandProps(color: string | null | undefined, extra: CSSProperties = {}): { style: CSSProperties; 'data-brand'?: string } {
  const style = brandStyle(color);
  return Object.keys(style).length ? { style: { ...style, ...extra }, 'data-brand': '' } : { style: extra };
}

/** Variables of a second (accent) colour, light and dark: `bg-highlight` in client apps. Empty without a hex colour. */
export function accentStyle(color: string | null | undefined): CSSProperties {
  const hsl = hexToHsl(color);
  if (!hsl || !color) return {};
  const [h, s, l] = hsl;
  const dark = l < 50 ? Math.min(62, l + 20) : l;
  return {
    '--brand-l-accent': `${h} ${s}% ${l}%`,
    '--brand-l-accent-foreground': luminance(color.startsWith('#') ? color : `#${color}`) > 0.45 ? '232 33% 11%' : '0 0% 100%',
    '--brand-d-accent': `${h} ${s}% ${dark}%`,
    '--brand-d-accent-foreground': dark >= 65 ? '232 33% 11%' : '0 0% 100%',
  } as CSSProperties;
}

/** The label colour used on a colour (buttons, badges): near-black on light colours, white on the others. */
export function labelColour(color: string) {
  return luminance(color.startsWith('#') ? color : `#${color}`) > 0.45 ? '#141827' : '#ffffff';
}

/** WCAG contrast ratio between two hex colours (1 … 21); 4.5 is the minimum for body text, 3 for large text. */
export function contrastRatio(a: string, b: string) {
  if (!hexToHsl(a) || !hexToHsl(b)) return null;
  const [x, y] = [luminance(a.startsWith('#') ? a : `#${a}`), luminance(b.startsWith('#') ? b : `#${b}`)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
