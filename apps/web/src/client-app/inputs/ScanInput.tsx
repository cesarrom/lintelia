import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, ImageUp, Keyboard, Loader2, ScanLine, TriangleAlert, X } from 'lucide-react';
import { parsePaymentCode } from '@repo/fintivio/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatAs } from '../format';
import type { ScreenField } from '../types';

/**
 * A QR code or barcode scanner field (docs/plans/14): the camera (back camera on phones), a photo of the code, or the
 * code typed in. Reading uses the browser's BarcodeDetector when there is one (QR and barcodes), else jsQR (QR codes).
 * When the field reads a format (EMV, SEPA, links…), what the code says is shown at once; the API reads it again.
 */

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> };
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'codabar', 'data_matrix', 'pdf417'];

async function nativeDetector(codes: ScreenField['scanCodes']): Promise<Detector | null> {
  const Native = (window as unknown as { BarcodeDetector?: { new(o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!Native) return null;
  try {
    const supported = (await Native.getSupportedFormats?.()) ?? [];
    const wanted = codes === 'barcode' ? BARCODE_FORMATS : codes === 'any' ? ['qr_code', ...BARCODE_FORMATS] : ['qr_code'];
    const formats = wanted.filter((f) => !supported.length || supported.includes(f));
    return formats.length ? new Native({ formats }) : null;
  } catch {
    return null;
  }
}

/** Read a code from an image (a video frame, a photo). */
async function readCode(source: CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number }, canvas: HTMLCanvasElement, detector: Detector | null, codes: ScreenField['scanCodes']) {
  if (detector) {
    try {
      const found = await detector.detect(source);
      if (found[0]?.rawValue) return found[0].rawValue;
    } catch { /* fall back to jsQR */ }
  }
  if (codes === 'barcode') return null;
  const width = source.videoWidth || source.width || 0;
  const height = source.videoHeight || source.height || 0;
  if (!width || !height) return null;
  const scale = Math.min(1, 1024 / Math.max(width, height));
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

export function ScanInput({ field, value, onChange, invalid, preview }: { field: ScreenField; value: unknown; onChange: (value: string) => void; invalid?: boolean; preview?: boolean }) {
  const text = typeof value === 'string' ? value : '';
  const [mode, setMode] = useState<'idle' | 'camera' | 'manual'>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);

  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stop, []);

  // The camera: read frames until a code appears.
  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This device has no camera available here');
        stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled || !video.current) return stop();
        video.current.srcObject = stream.current;
        await video.current.play().catch(() => undefined);
        const detector = await nativeDetector(field.scanCodes);
        const tick = async () => {
          if (cancelled || !video.current || !canvas.current) return;
          if (video.current.readyState >= 2) {
            const code = await readCode(video.current, canvas.current, detector, field.scanCodes);
            if (code && !cancelled) {
              stop();
              setMode('idle');
              onChange(code);
              return;
            }
          }
          timer = setTimeout(() => void tick(), 160);
        };
        void tick();
      } catch (error) {
        setProblem((error as Error).name === 'NotAllowedError' ? 'The camera was not allowed. Allow it in the browser, or use a photo of the code.' : (error as Error).message);
        setMode('idle');
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stop();
    };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const fromPhoto = async (file: File | undefined) => {
    if (!file || !canvas.current) return;
    setBusy(true);
    setProblem(null);
    try {
      const bitmap = await createImageBitmap(file);
      const code = await readCode(bitmap as unknown as HTMLCanvasElement, canvas.current, await nativeDetector(field.scanCodes), field.scanCodes);
      if (code) onChange(code);
      else setProblem('No code found in this picture: take it closer, with the whole code visible.');
    } catch {
      setProblem('This picture cannot be read.');
    } finally {
      setBusy(false);
    }
  };

  const details = text && field.parse && field.parse !== 'raw' ? parsePaymentCode(text, field.parse) : null;
  const noun = field.scanCodes === 'barcode' ? 'barcode' : field.scanCodes === 'any' ? 'code' : 'QR code';

  return (
    <div className={cn('space-y-3 rounded-xl border bg-muted/20 p-3.5', invalid && 'border-destructive/60')} data-testid={`scan-${field.key}`} data-value={text || undefined}>
      <canvas ref={canvas} className="hidden" />
      {text ? (
        <div className="space-y-2.5" data-testid="scan-result">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{details?.payee ? `Pay ${details.payee}` : `${noun.charAt(0).toUpperCase()}${noun.slice(1)} read`}</p>
              {!details?.payee && <p className="truncate font-mono text-xs text-muted-foreground">{text}</p>}
            </div>
            <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => { onChange(''); setProblem(null); }} data-testid="scan-again"><X className="h-3.5 w-3.5" />Scan again</Button>
          </div>
          {details && (details.valid ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-background p-3 text-[13px]" data-testid="scan-details">
              {details.amount !== undefined && <><dt className="text-muted-foreground">Amount</dt><dd className="font-semibold tabular" data-testid="scan-amount">{formatAs(details.amount, 'money', details.currency)}</dd></>}
              {details.account && <><dt className="text-muted-foreground">Account</dt><dd className="truncate font-mono text-xs">{details.account}</dd></>}
              {details.city && <><dt className="text-muted-foreground">City</dt><dd>{details.city}</dd></>}
              {details.reference && <><dt className="text-muted-foreground">Reference</dt><dd className="truncate">{details.reference}</dd></>}
              {details.amount === undefined && details.format !== 'raw' && details.format !== 'json' && <><dt className="text-muted-foreground">Amount</dt><dd>you choose</dd></>}
            </dl>
          ) : <p className="flex items-center gap-1.5 text-[13px] text-destructive"><TriangleAlert className="h-4 w-4" />{details.problem}</p>)}
        </div>
      ) : mode === 'camera' ? (
        <div className="space-y-2.5">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={video} muted playsInline className="aspect-[4/3] w-full object-cover" data-testid="scan-video" />
            <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
            <ScanLine className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-pulse text-white/80" />
          </div>
          <p className="text-center text-[13px] text-muted-foreground">Point the camera at the {noun}.</p>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setMode('idle')}>Cancel</Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" className="h-11" onClick={() => { setProblem(null); setMode('camera'); }} disabled={preview} data-testid="scan-camera"><Camera className="h-4 w-4" />Scan the {noun}</Button>
            <label className={cn('inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background text-sm font-medium shadow-xs hover:bg-accent', preview && 'pointer-events-none opacity-50')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}Use a photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void fromPhoto(e.target.files?.[0]); e.target.value = ''; }} data-testid="scan-photo" aria-label={`A photo of the ${noun}`} />
            </label>
          </div>
          {mode === 'manual' ? (
            <div className="flex gap-2">
              {/* Inside the screen's form: no nested form, Enter uses the code. */}
              <Input
                autoFocus placeholder="Type or paste the code" className="h-10 font-mono text-sm" data-testid="scan-manual" value={manual} onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (manual.trim()) onChange(manual.trim()); } }}
              />
              <Button type="button" variant="outline" className="h-10" onClick={() => manual.trim() && onChange(manual.trim())} data-testid="scan-manual-use">Use</Button>
            </div>
          ) : (
            <button type="button" className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setMode('manual')}><Keyboard className="h-3.5 w-3.5" />Type the code instead</button>
          )}
        </div>
      )}
      {problem && <p className="text-[13px] text-destructive" data-testid="scan-problem">{problem}</p>}
    </div>
  );
}
