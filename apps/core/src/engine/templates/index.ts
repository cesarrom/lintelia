import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Ready-made workflows institutions start from and adapt (like Camunda/Pega accelerators). */
export const WORKFLOW_TEMPLATES = [
  { id: 'loan-pre-approval', name: 'Personal loan pre-approval', category: 'Lending', description: 'Affordability estimate, automatic pre-approval of small loans, credit review with four-eyes above 50,000.' },
  { id: 'suspicious-activity', name: 'Suspicious activity investigation', category: 'Financial crime', description: 'Flagged client: analyst triage, senior investigation (with requests to the client), MLRO decision on a SAR.' },
  { id: 'account-opening', name: 'Account opening review', category: 'Onboarding', description: 'Manual review of every application with requests for documents.' },
] as const;

export function templateYaml(id: string): string | null {
  if (!WORKFLOW_TEMPLATES.some((t) => t.id === id)) return null;
  return readFileSync(join(import.meta.dir, `${id}.yaml`), 'utf8');
}
