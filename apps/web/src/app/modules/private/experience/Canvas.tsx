import { useEffect, useRef, useState } from 'react';
import { Laptop, Smartphone, Tablet, UserRound, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/lib/services/api';
import { cn } from '@/lib/utils';
import { PREVIEW_BASE, type PreviewMessage, type StudioMessage } from '@/client-app/preview';
import type { AppData, AppDefinition, Institution } from '@/client-app/types';

export type Device = 'desktop' | 'tablet' | 'phone';
const WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, phone: 390 };

/**
 * The live preview of the draft: the client app itself in a frame (same origin), at the size of a computer, a tablet or
 * a phone (scaled to fit). Selecting a widget in the frame selects it in the studio.
 */
export function Canvas({ definition, institution, data, page, params, selected, onSelect, onNavigate, device }: {
  definition: AppDefinition;
  institution: Institution;
  data: AppData | null;
  page: string;
  params?: Record<string, string>;
  selected: string | null;
  onSelect: (widgetId: string) => void;
  onNavigate: (page: string) => void;
  device: Device;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [size, setSize] = useState({ width: 900, height: 700 });
  const shownPage = useRef(page);
  // A page the studio asked the preview to show: until the preview reports it, its location messages are echoes.
  const pending = useRef<string | null>(null);

  // Size of the canvas, to scale the device into it.
  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent<PreviewMessage>) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === 'fintivio-preview:ready') setReady(true);
      if (event.data?.type === 'fintivio-preview:select') onSelect(event.data.widgetId);
      if (event.data?.type === 'fintivio-preview:location') {
        if (pending.current) {
          if (event.data.page === pending.current) pending.current = null;
          return;
        }
        shownPage.current = event.data.page;
        // The designer followed a link in the preview: the studio follows.
        if (event.data.page !== page) onNavigate(event.data.page);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onSelect, onNavigate, page]);

  const send = (message: StudioMessage) => frame.current?.contentWindow?.postMessage(message, window.location.origin);

  useEffect(() => {
    if (ready && data) send({ type: 'fintivio-studio:state', definition, institution, data, selected });
  }, [ready, definition, institution, data, selected]);

  useEffect(() => {
    if (ready && data && (page !== shownPage.current || params)) {
      shownPage.current = page;
      pending.current = page;
      send({ type: 'fintivio-studio:navigate', page, params });
    }
  }, [ready, page, params, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const width = WIDTH[device];
  const scale = Math.min(1, (size.width - 48) / width);
  const height = device === 'desktop' ? (size.height - 48) / scale : Math.min(844, (size.height - 48) / scale);
  return (
    <div ref={box} className="relative min-h-0 flex-1 overflow-auto bg-[radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] [background-size:16px_16px]" data-testid="studio-canvas">
      <div className="flex justify-center p-6">
        <div style={{ width: width * scale, height: height * scale }} className={cn('relative shrink-0 overflow-hidden bg-background shadow-overlay', device === 'phone' ? 'rounded-[28px] ring-8 ring-foreground/85' : 'rounded-xl ring-1 ring-border')}>
          <iframe
            ref={frame} title="App preview" src={PREVIEW_BASE} data-testid="preview-frame"
            style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
            className="border-0"
          />
        </div>
      </div>
    </div>
  );
}

export function DeviceToggle({ device, onChange }: { device: Device; onChange: (device: Device) => void }) {
  const options: Array<{ key: Device; label: string; icon: typeof Laptop }> = [
    { key: 'desktop', label: 'Computer', icon: Laptop }, { key: 'tablet', label: 'Tablet', icon: Tablet }, { key: 'phone', label: 'Phone', icon: Smartphone },
  ];
  return (
    <div className="inline-flex rounded-lg border bg-background p-0.5" role="radiogroup" aria-label="Device">
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={device === o.key} aria-label={o.label} title={o.label} onClick={() => onChange(o.key)} data-testid={`device-${o.key}`}
          className={cn('rounded-md p-1.5 transition-colors', device === o.key ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground')}>
          <o.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

interface ClientRow { id: string; email: string; name: string | null }

/** Preview with sample data, or as a real client (their data; reading it is audited). */
export function PreviewAs({ client, onChange, allowed }: { client: ClientRow | null; onChange: (client: ClientRow | null) => void; allowed: boolean }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: clients = [] } = useApiQuery<ClientRow[]>(['clients', 'preview-search', search], open && allowed ? `/clients?search=${encodeURIComponent(search)}` : null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 max-w-[240px]" data-testid="preview-as">
          <UserRound className="h-4 w-4" /><span className="truncate">{client ? client.name || client.email : 'Sample client'}</span>
          {client && <span role="button" aria-label="Back to the sample client" className="-mr-1 rounded p-0.5 hover:bg-muted" onClick={(e) => { e.stopPropagation(); onChange(null); }}><X className="h-3.5 w-3.5" /></span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-2">
        <p className="px-1 pb-2 text-xs text-muted-foreground">{allowed ? 'See the app with the data of a real client. Each preview is recorded in the audit log.' : 'Previewing as a client needs the clients:read permission.'}</p>
        <button type="button" onClick={() => { onChange(null); setOpen(false); }} className={cn('mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', !client && 'bg-primary-soft text-primary')}>Sample client (generated data)</button>
        {allowed && (
          <>
            <Input placeholder="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8" />
            <div className="mt-1 max-h-64 overflow-y-auto">
              {clients.slice(0, 30).map((c) => (
                <button key={c.id} type="button" onClick={() => { onChange(c); setOpen(false); }} data-testid="preview-client"
                  className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted">
                  <span className="block truncate text-sm">{c.name || c.email}</span>
                  <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
