import { expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Api, expectStatus } from './api';

/** The EICAR anti-virus test string: harmless, but every scanner reports it as malware. */
export const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

/** A real one-page PDF, optionally with document-level JavaScript (active content the sanitiser must remove). */
export async function pdfBytes(text = 'Utility bill — 1 High Street', opts: { javascript?: boolean; trailer?: string } = {}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText(text, { x: 50, y: 780, size: 14, font: await doc.embedFont(StandardFonts.Helvetica) });
  if (opts.javascript) doc.addJavaScript('hello', 'app.alert("pwned");');
  const bytes = Buffer.from(await doc.save({ useObjectStreams: false }));
  return opts.trailer ? Buffer.concat([bytes, Buffer.from(`\n%${opts.trailer}\n`)]) : bytes;
}

/** A digital document (pay stub, buyer's order…): one line of text per entry, readable by text extraction. */
export async function documentPdf(lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 22, size: i === 0 ? 16 : 12, font }));
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

export interface UploadOutcome {
  id: string;
  status: string;
  fileId: string | null;
  rejectionReason: string | null;
  sanitization: string[];
}

/** Intent → PUT the bytes to the signed URL → complete → wait for the intake verdict. */
export async function uploadForRequest(api: Api, opts: { taskId: string; itemKey: string; name: string; type: string; bytes: Buffer; declaredSize?: number }) {
  const intent = await api.post('/uploads', {
    purpose: 'client_request_item', taskId: opts.taskId, itemKey: opts.itemKey, name: opts.name, type: opts.type,
    size: opts.declaredSize ?? opts.bytes.length, sha256: createHash('sha256').update(opts.bytes).digest('hex'),
  });
  expectStatus(intent, 201);
  const put = await fetch(intent.body.upload.url, { method: 'PUT', headers: intent.body.upload.headers, body: opts.bytes });
  if (put.status !== 201) return { intent: intent.body, putStatus: put.status, outcome: null };
  expectStatus(await api.post(`/uploads/${intent.body.id}/complete`), 202);
  let outcome: UploadOutcome | null = null;
  await expect.poll(async () => {
    outcome = (await api.get(`/uploads/${intent.body.id}`)).body;
    return outcome!.status;
  }, { timeout: 30_000 }).toMatch(/^(available|rejected)$/);
  return { intent: intent.body, putStatus: put.status, outcome: outcome! as UploadOutcome };
}
