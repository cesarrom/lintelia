import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import qrcode from 'qrcode-generator';

/**
 * Payment QR codes for the tests (docs/plans/14), built independently of the app's own reader: an EMVCo
 * merchant-presented payload (as Pix and most pay-by-QR schemes) and the code as an image a client photographs.
 */

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE, as EMV QR codes end with (tag 63). */
function crc16(text: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(text, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const CURRENCY: Record<string, string> = { GBP: '826', EUR: '978', USD: '840', BRL: '986' };

export function emvPayload(input: { payee: string; city: string; account: string; amount?: number; currency?: string; country?: string; reference?: string; scheme?: string }) {
  let payload = tlv('00', '01') + tlv('01', input.amount ? '12' : '11')
    + tlv('26', tlv('00', input.scheme ?? 'uk.lintelia.example') + tlv('01', input.account))
    + tlv('52', '5812') + tlv('53', CURRENCY[input.currency ?? 'GBP'])
    + (input.amount ? tlv('54', input.amount.toFixed(2)) : '')
    + tlv('58', input.country ?? 'GB') + tlv('59', input.payee) + tlv('60', input.city)
    + (input.reference ? tlv('62', tlv('05', input.reference)) : '')
    + '6304';
  return payload + crc16(payload);
}

/** The code as a picture (GIF), for the scanner's "Use a photo". */
export function qrImage(text: string, name = 'code.gif') {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const url = qr.createDataURL(8, 4);
  return { name, mimeType: 'image/gif', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

/**
 * A camera that films the code: a Y4M video (raw YUV 4:2:0, what Chromium's fake camera plays with
 * `--use-file-for-fake-video-capture`) showing the QR code on a light table. Returns the file's path.
 */
export function fakeCameraVideo(text: string, dir: string, width = 640, height = 480) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cell = Math.floor((Math.min(width, height) * 0.62) / (count + 8));
  const size = cell * (count + 8);
  const left = Math.floor((width - size) / 2);
  const top = Math.floor((height - size) / 2);
  const luma = Buffer.alloc(width * height, 150); // a grey table…
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const row = Math.floor(y / cell) - 4;
      const col = Math.floor(x / cell) - 4;
      const dark = row >= 0 && col >= 0 && row < count && col < count && qr.isDark(row, col);
      luma[(top + y) * width + left + x] = dark ? 20 : 240; // …with the printed code (quiet zone included)
    }
  }
  const chroma = Buffer.alloc((width / 2) * (height / 2), 128);
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma]);
  const video = Buffer.concat([Buffer.from(`YUV4MPEG2 W${width} H${height} F10:1 Ip A1:1 C420jpeg\n`), frame, frame, frame]);
  const path = join(dir, `camera-${Date.now()}.y4m`);
  writeFileSync(path, video);
  return path;
}
