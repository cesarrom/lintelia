import { PDFDocument } from 'pdf-lib';
import { createFakeService, devPort } from '@repo/fake-kit';

/**
 * Content sanitiser (content disarm and reconstruction, docs/plans/07): `POST /sanitize?type=<content type>` with the
 * bytes answers `{ content (base64), actions[] }`.
 *  - PDF: rebuilt into a new document with only the pages (drops JavaScript, open actions, embedded files, XFA);
 *    reports what it found (`/JavaScript`, `/EmbeddedFile`, `/Launch`, `/OpenAction`).
 *  - JPEG: removes APPn metadata segments (EXIF/GPS, XMP); PNG: removes text/EXIF chunks.
 *  - text/csv: normalised to UTF-8 without a BOM.
 * `/__control/fail-next` makes the next calls fail; a PDF that cannot be parsed fails (the pipeline rejects it).
 */
const service = createFakeService({ name: 'sanitizer', port: devPort('sanitizer', 9502), recordPaths: (p) => p === '/sanitize' });
let failNext = 0;
service.onReset(() => { failNext = 0; });

const PDF_MARKERS: Array<[string, string]> = [
  ['/JavaScript', 'removed JavaScript'], ['/JS', 'removed JavaScript action'], ['/EmbeddedFile', 'removed embedded files'],
  ['/Launch', 'removed launch actions'], ['/OpenAction', 'removed open action'], ['/XFA', 'removed XFA form'], ['/RichMedia', 'removed rich media'],
];

async function sanitizePdf(bytes: Buffer) {
  const text = bytes.toString('latin1');
  const actions = [...new Set(PDF_MARKERS.filter(([marker]) => text.includes(marker)).map(([, action]) => action))];
  const source = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  const rebuilt = await PDFDocument.create();
  const pages = await rebuilt.copyPages(source, source.getPageIndices());
  for (const page of pages) rebuilt.addPage(page);
  rebuilt.setProducer('Lintelia sanitiser');
  actions.push(`rebuilt ${pages.length} page(s)`);
  return { content: Buffer.from(await rebuilt.save()), actions };
}

function sanitizeJpeg(bytes: Buffer) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('not a JPEG');
  const out: Buffer[] = [bytes.subarray(0, 2)];
  let removed = 0;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('corrupt JPEG');
    const marker = bytes[i + 1];
    if (marker === 0xda) { out.push(bytes.subarray(i)); break; } // start of scan: the rest is image data
    const length = bytes.readUInt16BE(i + 2);
    const segment = bytes.subarray(i, i + 2 + length);
    // APP1..APP15 carry EXIF/GPS/XMP/ICC-extras; APP0 (JFIF) is kept.
    if (marker >= 0xe1 && marker <= 0xef) removed += 1;
    else out.push(segment);
    i += 2 + length;
  }
  return { content: Buffer.concat(out), actions: removed ? [`removed ${removed} metadata segment(s) (EXIF/GPS/XMP)`] : ['no metadata found'] };
}

function sanitizePng(bytes: Buffer) {
  const signature = bytes.subarray(0, 8);
  const out: Buffer[] = [signature];
  let removed = 0;
  let i = 8;
  while (i < bytes.length) {
    const length = bytes.readUInt32BE(i);
    const type = bytes.subarray(i + 4, i + 8).toString('latin1');
    const chunk = bytes.subarray(i, i + 12 + length);
    if (['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'].includes(type)) removed += 1;
    else out.push(chunk);
    i += 12 + length;
    if (type === 'IEND') break;
  }
  return { content: Buffer.concat(out), actions: removed ? [`removed ${removed} metadata chunk(s)`] : ['no metadata found'] };
}

service.app.post('/sanitize', async (c) => {
  if (failNext > 0) {
    failNext -= 1;
    return c.json({ error: 'sanitiser unavailable' }, 503);
  }
  const type = c.req.query('type') ?? '';
  const bytes = Buffer.from(await c.req.arrayBuffer());
  try {
    const result = type === 'application/pdf' ? await sanitizePdf(bytes)
      : type === 'image/jpeg' ? sanitizeJpeg(bytes)
        : type === 'image/png' ? sanitizePng(bytes)
          : type.startsWith('text/') ? { content: Buffer.from(bytes.toString('utf8').replace(/^\uFEFF/, ''), 'utf8'), actions: ['normalised text encoding'] }
            : { content: bytes, actions: ['no sanitiser for this type: unchanged'] };
    return c.json({ content: result.content.toString('base64'), actions: result.actions, engine: 'fake-sanitizer 1.0' });
  } catch (error) {
    return c.json({ error: `Could not sanitise: ${(error as Error).message}` }, 422);
  }
});

service.app.post('/__control/fail-next', async (c) => {
  const { count = 1 } = await c.req.json().catch(() => ({}));
  failNext = count;
  return c.json({ failNext });
});

service.start();
