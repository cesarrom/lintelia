import { inflateSync } from 'node:zlib';

/**
 * The text layer of a PDF, without dependencies: content streams (Flate or raw) are scanned for text-showing operators
 * (`Tj`, `TJ`, `'`, `"`) with literal `(…)` or hex `<…>` strings; positioning operators start new lines. Enough for
 * digital documents (pay stubs, buyer's orders, statements); scanned images need a model that reads files
 * (`Send the document itself`).
 */
export function pdfText(bytes: Uint8Array): string {
  const data = Buffer.from(bytes);
  const latin = data.toString('latin1');
  const lines: string[] = [];
  const streamRe = /<<(.*?)>>\s*stream\r?\n/gs;
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(latin))) {
    const start = match.index + match[0].length;
    const end = latin.indexOf('endstream', start);
    if (end < 0) break;
    let content: Buffer = data.subarray(start, end);
    if (/\/FlateDecode/.test(match[1])) {
      try {
        content = inflateSync(content);
      } catch {
        continue;
      }
    } else if (/\/Filter/.test(match[1])) continue;
    lines.push(...textOperators(content.toString('latin1')));
    streamRe.lastIndex = end;
  }
  return lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

function textOperators(stream: string): string[] {
  if (!/\bBT\b/.test(stream)) return [];
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) lines.push(current);
    current = '';
  };
  const tokenRe = /\((?:\\.|[^\\)])*\)|<[0-9a-fA-F\s]*>|\[|\]|\/[^\s/<>[\]()]+|[A-Za-z'"*]+|-?\d*\.?\d+/g;
  let pending: string[] = [];
  let token: RegExpExecArray | null;
  while ((token = tokenRe.exec(stream))) {
    const t = token[0];
    if (t.startsWith('(')) pending.push(literal(t.slice(1, -1)));
    else if (t.startsWith('<') && t !== '<<') pending.push(hex(t.slice(1, -1)));
    else if (t === 'Tj' || t === 'TJ' || t === "'" || t === '"') {
      if (t === "'" || t === '"') flush();
      current += pending.join('');
      pending = [];
    } else if (['Td', 'TD', 'T*', 'Tm', 'BT', 'ET'].includes(t)) {
      pending = [];
      flush();
    } else if (t === '[' || t === ']' || /^-?\d/.test(t) || t.startsWith('/')) {
      // operands
    } else pending = [];
  }
  flush();
  return lines;
}

function literal(value: string) {
  return value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e: string) => {
    const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
    return map[e] ?? String.fromCharCode(parseInt(e, 8));
  });
}

function hex(value: string) {
  const clean = value.replace(/\s+/g, '');
  const padded = clean.length % 2 ? `${clean}0` : clean;
  return Buffer.from(padded, 'hex').toString('latin1');
}
