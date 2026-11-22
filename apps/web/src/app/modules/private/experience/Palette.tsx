import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { CLIENT_WIDGETS, type ClientWidgetDefinition, type WidgetCategory } from '@repo/lintelia/schemas';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppIcon } from '@/client-app/icons';

const CATEGORIES: Array<{ key: WidgetCategory; label: string }> = [
  { key: 'banking', label: 'Banking' },
  { key: 'process', label: 'Journeys and requests' },
  { key: 'data', label: 'Data' },
  { key: 'content', label: 'Content' },
  { key: 'layout', label: 'Layout' },
  { key: 'profile', label: 'Profile and privacy' },
  { key: 'embed', label: 'Your own content' },
];

/** The widget catalogue: pick one to add it after the selected widget (or into the selected section). */
export function WidgetPalette({ onPick, disabled, widgets = CLIENT_WIDGETS }: { onPick: (type: string) => void; disabled?: boolean; widgets?: ClientWidgetDefinition[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = widgets.filter((w) => !q || `${w.title} ${w.description} ${w.type}`.toLowerCase().includes(q));
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}>
      <PopoverTrigger asChild>
        <Button size="sm" className="w-full" disabled={disabled} data-testid="add-widget"><Plus className="h-4 w-4" />Add widget</Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-[380px] p-0" data-testid="widget-palette">
        <div className="border-b p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus placeholder="Search widgets" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {CATEGORIES.map((category) => {
            const items = matches.filter((w) => w.category === category.key);
            if (!items.length) return null;
            return (
              <div key={category.key} className="mb-2">
                <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{category.label}</p>
                {items.map((w) => (
                  <button
                    key={w.type} type="button" data-testid="palette-item" data-type={w.type}
                    onClick={() => { onPick(w.type); setOpen(false); setQuery(''); }}
                    className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><AppIcon name={w.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{w.title}</span>
                      <span className="block text-xs leading-snug text-muted-foreground">{w.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            );
          })}
          {!matches.length && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No widget matches “{query}”.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
