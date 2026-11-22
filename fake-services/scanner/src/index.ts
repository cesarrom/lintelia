import { createFakeService, devPort } from '@repo/fake-kit';

/**
 * Malware scanner (docs/plans/07): `POST /scan` with the file bytes answers `{ result: clean | infected, signature }`.
 * It detects the EICAR anti-virus test string (what ClamAV reports as `Eicar-Signature`), so tests can upload a
 * "virus" safely. `/__control/fail-next` makes the next scans fail (HTTP 503) to exercise the error path.
 */
const EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

const service = createFakeService({ name: 'scanner', port: devPort('scanner', 9501), recordPaths: (p) => p === '/scan' });
let failNext = 0;
let scanned = 0;
service.onReset(() => { failNext = 0; scanned = 0; });

service.app.post('/scan', async (c) => {
  if (failNext > 0) {
    failNext -= 1;
    return c.json({ error: 'scanner unavailable' }, 503);
  }
  const bytes = Buffer.from(await c.req.arrayBuffer());
  scanned += 1;
  const infected = bytes.includes(Buffer.from(EICAR));
  return c.json({ result: infected ? 'infected' : 'clean', signature: infected ? 'Eicar-Signature' : null, engine: 'fake-scanner 1.0', bytes: bytes.length });
});

service.app.post('/__control/fail-next', async (c) => {
  const { count = 1 } = await c.req.json().catch(() => ({}));
  failNext = count;
  return c.json({ failNext });
});

service.app.get('/__control/stats', (c) => c.json({ scanned, failNext }));

service.start();
