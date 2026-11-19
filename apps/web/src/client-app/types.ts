import type { ClientAppDefinition, ClientWidget } from '@repo/fintivio/schemas';

/** The published app as clients get it (`GET /me/app`; identity settings stay on the server). */
export type AppDefinition = Omit<ClientAppDefinition, 'identity'> & { identity?: ClientAppDefinition['identity'] };

export interface Institution {
  name: string;
  pallette?: { primary?: string; secondary?: string; accent?: string } | null;
  logoUrl?: string | null;
}

export interface AppView {
  available: boolean;
  version?: number;
  definition?: AppDefinition;
  institution: Institution;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  segments: string[];
  externalId: string | null;
  attributes: Record<string, unknown>;
  since: string;
  consents: Array<{ key: string; version: string; acceptedAt: string }>;
  [attribute: string]: unknown;
}

export interface MyCaseView {
  id: string;
  reference: string;
  title: string;
  status: string;
  statusLabel: string;
  journey: string | null;
  icon: string | null;
  stage: string | null;
  waitingForMe: boolean;
  final: boolean;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface MyRequestView {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  status: string;
  dueAt: string | null;
  createdAt: string;
  case: { id: string; reference: string; title: string } | null;
  journey: string | null;
}

export interface NotificationView {
  id: string;
  title: string;
  body: string | null;
  tone: string;
  /** Where the notification leads: a page of the app (with parameters) or a journey's case. */
  link: { page?: string; params?: Record<string, string>; caseId?: string } | null;
  read: boolean;
  createdAt: string;
}

export interface JourneyView {
  key: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
}

/** What `POST /me/app/data` returns for the requested sources. */
export interface AppData {
  me: Me;
  records: Record<string, Array<Record<string, unknown> & { key: string }>>;
  cases?: MyCaseView[];
  requests?: MyRequestView[];
  notifications?: NotificationView[];
  journeys?: JourneyView[];
}

export type { ClientWidget };

export interface ScreenField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'money' | 'date' | 'select' | 'choice' | 'checkbox' | 'textarea' | 'file' | 'scan' | 'signature' | 'otp' | 'slider' | 'display';
  required?: boolean;
  help?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  width?: 'full' | 'half';
  /** JSONata over the screen's answers: shown (and checked) only when true. */
  visibleIf?: string;
  pattern?: string;
  patternMessage?: string;
  check?: 'iban' | 'luhn' | 'email';
  scanCodes?: 'qr' | 'barcode' | 'any';
  parse?: 'raw' | 'auto' | 'emv' | 'epc' | 'url' | 'json';
  length?: number;
  secret?: boolean;
  capture?: 'environment' | 'user';
  expression?: string;
  format?: 'text' | 'number' | 'money' | 'percent';
}

/** Press a button by itself (when complete, or when a rule over the answers holds), after an optional countdown. */
export interface ScreenAutoSubmit { button: string; when: 'complete' | 'expression'; expression?: string; delay?: number }

export interface ScreenView {
  taskId: string;
  title: string;
  description?: string;
  content?: string;
  stage?: string;
  fields: ScreenField[];
  buttons: Array<{ key: string; label: string; style: 'primary' | 'secondary' | 'danger'; skipValidation?: boolean }>;
  values: Record<string, unknown>;
  autoSubmit?: ScreenAutoSubmit;
}

export interface JourneyState {
  case: { id: string; reference: string; title: string; status: string; statusLabel: string; outcome: string | null };
  journey: { key: string; title: string; donePage: string | null; icon: string | null } | null;
  state: 'screen' | 'request' | 'waiting' | 'working' | 'done';
  stages: Array<{ key: string; label: string; status: 'done' | 'current' | 'todo' }>;
  screen: ScreenView | null;
  /** The journey's last message (shown when it ends). */
  message: { title: string; body: string | null; tone: string } | null;
  requests: Array<{
    id: string; kind: string; title: string; description: string | null; status: string; dueAt: string | null; answeredAt: string | null;
    items: Array<{ key: string; label: string; type: string }>;
    action: { type: string; sdk: string | null; url: string; title: string | null; instructions: string | null } | null;
  }>;
  /** Where to listen from the start (docs/plans/17 §4.6): the case, and what its workflow publishes. */
  live?: { topics: string[] };
}
