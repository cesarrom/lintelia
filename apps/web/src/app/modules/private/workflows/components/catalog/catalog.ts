import { createContext, useContext } from 'react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentDefinition } from '@repo/lintelia/schemas';
import { useApiQuery } from '@/lib/services/api';

/** The component catalogue (GET /workflow-components): built-ins + the institution's connector components. */
export function useComponentCatalog() {
  return useApiQuery<ComponentDefinition[]>(['workflow-components'], '/workflow-components');
}

export const CatalogContext = createContext<Map<string, ComponentDefinition>>(new Map());
export const useCatalog = () => useContext(CatalogContext);

export function iconFor(name: string | undefined): LucideIcon {
  const icon = name ? (icons as unknown as Record<string, LucideIcon>)[name] : undefined;
  return icon ?? icons.Puzzle;
}

/** Read a dotted path from an object. */
export const getPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined), value);

const display = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.map((v) => (typeof v === 'object' ? (v as { key?: string; label?: string }).label ?? (v as { key?: string }).key ?? '…' : String(v))).join(', ') : '—';
  if (typeof value === 'object') return Object.keys(value as object).join(', ') || '—';
  return String(value);
};

/**
 * Render a summary template such as "Queue {{assignTo.role}} · SLA {{sla}}" against a step config. Parts (separated
 * by " · ") whose values are all unset are left out, when another part says something ("Stage {{stage}} · Risk
 * {{riskLevel}}" without a stage reads "Risk high").
 */
export function renderSummary(template: string | undefined, config: Record<string, unknown> | undefined) {
  if (!template) return '';
  const parts = template.split(' · ').map((part) => {
    let placeholders = 0;
    let unset = 0;
    const text = part.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => {
      placeholders += 1;
      const shown = display(getPath(config ?? {}, path));
      if (shown === '—') unset += 1;
      return shown;
    });
    return { text, empty: placeholders > 0 && unset === placeholders };
  });
  const kept = parts.some((p) => !p.empty) ? parts.filter((p) => !p.empty) : parts;
  return kept.map((p) => p.text).join(' · ');
}

export const CATEGORY_LABELS: Record<string, string> = {
  flow: 'Flow', data: 'Data', people: 'People', client: 'Client', case: 'Case', communication: 'Communication', connector: 'Connectors', function: 'Your functions',
};

/** Colour of each component category (palette tiles, node icons and accents), light and dark. */
export const CATEGORY_STYLES: Record<string, { tile: string; accent: string }> = {
  people: { tile: 'bg-violet-500/10 text-violet-600 dark:text-violet-300', accent: 'bg-violet-500' },
  client: { tile: 'bg-sky-500/10 text-sky-600 dark:text-sky-300', accent: 'bg-sky-500' },
  case: { tile: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', accent: 'bg-amber-500' },
  flow: { tile: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', accent: 'bg-slate-400' },
  data: { tile: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', accent: 'bg-emerald-500' },
  communication: { tile: 'bg-pink-500/10 text-pink-600 dark:text-pink-300', accent: 'bg-pink-500' },
  connector: { tile: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300', accent: 'bg-indigo-500' },
  // Published workflows marked as functions: the institution's own building blocks (docs/plans/12).
  function: { tile: 'bg-teal-500/10 text-teal-600 dark:text-teal-300', accent: 'bg-teal-500' },
};
export const categoryStyle = (category: string | undefined) => CATEGORY_STYLES[category ?? ''] ?? CATEGORY_STYLES.flow;
