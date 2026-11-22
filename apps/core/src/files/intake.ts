import { fileTypeFromBuffer } from 'file-type';
import { env } from '../constants';
import { TEXT_TYPES } from './policy';

/**
 * The intake pipeline's building blocks (docs/plans/07): type sniffing, the malware scanner port and the content
 * sanitiser port. HTTP adapters talk to ClamAV-like / CDR services; locally the fakes in fake-services/.
 */
export async function sniffType(bytes: Buffer, declaredType: string): Promise<string | null> {
  const detected = await fileTypeFromBuffer(bytes);
  if (detected) return detected.mime === 'image/heif' || detected.mime === 'image/heic' ? detected.mime : detected.mime;
  if (TEXT_TYPES.has(declaredType)) {
    if (bytes.includes(0)) return null;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return declaredType;
    } catch {
      return null;
    }
  }
  return null;
}

export interface ScanResult {
  result: 'clean' | 'infected' | 'error';
  signature?: string | null;
  engine?: string | null;
}

export interface MalwareScanner {
  scan(bytes: Buffer): Promise<ScanResult>;
}

export interface SanitizeResult {
  content: Buffer;
  actions: string[];
  engine?: string | null;
}

export interface ContentSanitizer {
  sanitize(bytes: Buffer, contentType: string): Promise<SanitizeResult>;
}

export class HttpScanner implements MalwareScanner {
  constructor(private readonly url = env.SCANNER_URL) { }

  async scan(bytes: Buffer): Promise<ScanResult> {
    const response = await fetch(new URL('/scan', this.url), { method: 'POST', body: bytes, headers: { 'Content-Type': 'application/octet-stream' }, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`scanner answered ${response.status}`);
    const body = await response.json() as ScanResult;
    if (body.result !== 'clean' && body.result !== 'infected') throw new Error('scanner gave no verdict');
    return body;
  }
}

export class HttpSanitizer implements ContentSanitizer {
  constructor(private readonly url = env.SANITIZER_URL) { }

  async sanitize(bytes: Buffer, contentType: string): Promise<SanitizeResult> {
    const response = await fetch(new URL(`/sanitize?type=${encodeURIComponent(contentType)}`, this.url), {
      method: 'POST', body: bytes, headers: { 'Content-Type': 'application/octet-stream' }, signal: AbortSignal.timeout(120_000),
    });
    const body = await response.json().catch(() => ({})) as { content?: string; actions?: string[]; engine?: string; error?: string };
    if (response.status === 422) throw new UnsanitizableError(body.error ?? 'the file could not be sanitised');
    if (!response.ok || !body.content) throw new Error(`sanitiser answered ${response.status}`);
    return { content: Buffer.from(body.content, 'base64'), actions: body.actions ?? [], engine: body.engine ?? null };
  }
}

/** The file itself cannot be made safe (corrupt, encrypted…): reject it, do not retry. */
export class UnsanitizableError extends Error { }
