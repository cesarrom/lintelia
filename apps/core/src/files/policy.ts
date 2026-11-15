import type { UploadPurpose } from '@repo/fintivio/entities/tenant';

/**
 * Upload limits (docs/plans/07 §Decisions). Types are checked three times: declared at intent, sniffed from the bytes
 * after upload (magic numbers, never the extension), and by the sanitiser. A workflow step may narrow a policy
 * (e.g. an item accepting only PDFs), never widen it.
 */
export interface UploadPolicy {
  types: string[];
  maxBytes: number;
  maxFilesPerItem: number;
  /**
   * Content disarm and reconstruction. Off only for documents from trusted connectors whose bytes must stay intact
   * (signed PDFs: rebuilding them would break the signatures); they are still scanned.
   */
  sanitize: boolean;
}

const MB = 1024 * 1024;

export const UPLOAD_POLICIES: Record<UploadPurpose, UploadPolicy> = {
  client_request_item: { types: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'], maxBytes: 20 * MB, maxFilesPerItem: 10, sanitize: true },
  case_document: {
    types: ['application/pdf', 'image/jpeg', 'image/png', 'text/csv', 'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    maxBytes: 50 * MB, maxFilesPerItem: 50, sanitize: true,
  },
  connector_document: { types: ['application/pdf', 'image/jpeg', 'image/png'], maxBytes: 50 * MB, maxFilesPerItem: 50, sanitize: false },
};

/** Intents expire if the bytes do not arrive in time. */
export const INTENT_TTL_MS = 15 * 60_000;
/** Abuse control: pending intents per uploader. */
export const MAX_PENDING_INTENTS = 100;

/** Narrow a policy with a request item's own restrictions (`accept`, `maxSizeMb`). */
export function policyFor(purpose: UploadPurpose, item?: { accept?: string[] | string | null; maxSizeMb?: number | null }): UploadPolicy {
  const base = UPLOAD_POLICIES[purpose];
  const accept = item?.accept ? (Array.isArray(item.accept) ? item.accept : String(item.accept).split(',')).map((t) => t.trim()).filter(Boolean) : null;
  return {
    types: accept ? base.types.filter((t) => accept.includes(t)) : base.types,
    maxBytes: item?.maxSizeMb ? Math.min(base.maxBytes, item.maxSizeMb * MB) : base.maxBytes,
    maxFilesPerItem: base.maxFilesPerItem,
    sanitize: base.sanitize,
  };
}

/** Plain-text types have no magic number: accepted when the bytes are valid UTF-8 without NUL bytes. */
export const TEXT_TYPES = new Set(['text/csv', 'text/plain']);
