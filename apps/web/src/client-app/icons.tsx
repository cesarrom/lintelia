import { icons, type LucideProps } from 'lucide-react';

const pascal = (name: string) => name.replace(/(^|[-_ ])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

/** A lucide icon by name: `arrow-left-right` or `ArrowLeftRight`. Unknown names fall back to `fallback` (or nothing). */
export function AppIcon({ name, fallback = 'circle', ...props }: { name?: string | null; fallback?: string } & Omit<LucideProps, 'name'>) {
  const Icon = (name && (icons[pascal(name) as keyof typeof icons] ?? icons[name as keyof typeof icons])) || (fallback ? icons[pascal(fallback) as keyof typeof icons] : null);
  return Icon ? <Icon aria-hidden="true" {...props} /> : null;
}

export const iconExists = (name: string) => !!(icons[pascal(name) as keyof typeof icons] ?? icons[name as keyof typeof icons]);

/** Every icon name, kebab-case (icon picker). */
export const ICON_NAMES = Object.keys(icons).map((name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase());
