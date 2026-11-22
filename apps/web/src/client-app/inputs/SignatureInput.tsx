import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eraser, Loader2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadRequestFile } from '@/components/app/files';
import { useAxios } from '@/lib/services/axios';
import { cn } from '@/lib/utils';

/**
 * A handwritten signature (docs/plans/14): drawn with a finger, a pen or the mouse, kept as a PNG that goes through the
 * same intake as any upload (scan, sanitisation) and reaches the case as a file. Not a qualified electronic signature:
 * for contracts, use a signature provider (Documenso).
 */
export function SignatureInput({ taskId, fieldKey, label, value, onChange, invalid, preview }: {
  taskId: string; fieldKey: string; label: string; value: unknown; onChange: (value: string[] | null) => void; invalid?: boolean; preview?: boolean;
}) {
  const { axios } = useAxios();
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [strokes, setStrokes] = useState(0);
  const [state, setState] = useState<'drawing' | 'uploading' | 'saved' | 'error'>(Array.isArray(value) && value.length ? 'saved' : 'drawing');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ratio = window.devicePixelRatio || 1;
    element.width = element.offsetWidth * ratio;
    element.height = element.offsetHeight * ratio;
    const context = element.getContext('2d')!;
    context.scale(ratio, ratio);
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#111827';
  }, [state === 'drawing']); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as const;
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (preview) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const context = e.currentTarget.getContext('2d')!;
    const [x, y] = point(e);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 0.1, y + 0.1);
    context.stroke();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = e.currentTarget.getContext('2d')!;
    const [x, y] = point(e);
    context.lineTo(x, y);
    context.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setStrokes((n) => n + 1);
  };
  const clear = () => {
    const element = canvas.current;
    element?.getContext('2d')?.clearRect(0, 0, element.width, element.height);
    setStrokes(0);
    onChange(null);
    setState('drawing');
  };
  const save = async () => {
    const element = canvas.current;
    if (!element) return;
    setState('uploading');
    const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, 'image/png'));
    if (!blob) return setState('error');
    const result = await uploadRequestFile(axios, taskId, fieldKey, new File([blob], 'signature.png', { type: 'image/png' }));
    if (result.status === 'available' && result.fileId) {
      onChange([result.fileId]);
      setState('saved');
    } else {
      setMessage(result.message ?? 'The signature could not be saved');
      setState('error');
    }
  };

  if (state === 'saved') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border bg-success-soft/50 px-3.5 py-3 text-sm" data-testid={`signature-${fieldKey}`} data-status="saved">
        <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Signed</span>
        <Button type="button" variant="ghost" size="sm" className="h-7" onClick={clear}>Sign again</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-testid={`signature-${fieldKey}`} data-status={state}>
      <div className={cn('relative rounded-xl border-2 border-dashed bg-white', invalid && 'border-destructive/60')}>
        <canvas
          ref={canvas} aria-label={label} className="h-40 w-full touch-none cursor-crosshair rounded-xl" data-testid="signature-pad"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        />
        {!strokes && <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground/70"><PenLine className="h-4 w-4" />Sign here</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-muted-foreground/30" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={!strokes || state === 'uploading' || preview} data-testid="signature-save">
          {state === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}Use this signature
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={clear} disabled={!strokes}><Eraser className="h-4 w-4" />Clear</Button>
        {message && <span className="text-[13px] text-destructive">{message}</span>}
      </div>
    </div>
  );
}
