/** ISO-8601 durations (`PT24H`, `P3D`, `PT90S`, `P1DT12H`) to milliseconds. Plain numbers are milliseconds. */
export function durationMs(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  const match = String(value).trim().match(/^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const [, w, d, h, m, s] = match.map((part) => (part ? Number(part) : 0));
  return Math.round((((w * 7 + d) * 24 + h) * 60 + m) * 60_000 + s * 1000);
}
