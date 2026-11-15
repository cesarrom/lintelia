import { createContext, useContext } from 'react';
import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentDefinition } from '@repo/fintivio/schemas';
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

/** Render a summary template such as "Queue {{assignTo.role}} · SLA {{sla}}" against a step config. */
export function renderSummary(template: string | undefined, config: Record<string, unknown> | undefined) {
  if (!template) return '';
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path: string) => display(getPath(config ?? {}, path)));
}

export const CATEGORY_LABELS: Record<string, string> = {
  flow: 'Flow', data: 'Data', people: 'People', client: 'Client', case: 'Case', communication: 'Communication', connector: 'Connectors',
};
