import { ArrowDown, ArrowUp, Copy, EyeOff, Home, Menu, Plus, Trash2 } from 'lucide-react';
import { clientWidgetDefinition, ordered, type ClientWidget } from '@repo/fintivio/schemas';
import { Button } from '@/components/ui/button';
import { AppIcon } from '@/client-app/icons';
import { cn } from '@/lib/utils';
import { pageLabel, widgetLabel, type Definition } from './studio-model';
import { WidgetPalette } from './Palette';

/** Pages of the app: pick one to edit; home and menu entries are marked. */
export function PagesList({ definition, current, onSelect, onAdd, readOnly }: { definition: Definition; current: string; onSelect: (page: string) => void; onAdd: () => void; readOnly: boolean }) {
  const inMenu = new Set(definition.navigation.map((n) => n.page));
  return (
    <div className="space-y-1" data-testid="studio-pages">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pages</p>
        {!readOnly && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd} data-testid="add-page"><Plus className="h-3.5 w-3.5" />Page</Button>}
      </div>
      {ordered(definition.pages, definition.pageOrder).map(([key, page]) => (
        <button
          key={key} type="button" onClick={() => onSelect(key)} data-testid="studio-page" data-page={key}
          className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors', current === key ? 'bg-primary-soft font-medium text-primary' : 'text-foreground/80 hover:bg-muted')}
        >
          <AppIcon name={definition.navigation.find((n) => n.page === key)?.icon ?? page.icon} fallback="file" className="h-4 w-4 shrink-0 opacity-80" />
          <span className="min-w-0 flex-1 truncate">{pageLabel(definition, key)}</span>
          {definition.home === key && <Home className="h-3.5 w-3.5 shrink-0 opacity-60" aria-label="Home page" />}
          {inMenu.has(key) && definition.home !== key && <Menu className="h-3.5 w-3.5 shrink-0 opacity-40" aria-label="In the menu" />}
        </button>
      ))}
    </div>
  );
}

/** The widgets of the page as a tree: select, move, duplicate, remove; add from the catalogue. */
export function WidgetOutline({ widgets, selected, onSelect, onMove, onDuplicate, onRemove, onAdd, readOnly }: {
  widgets: ClientWidget[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (type: string) => void;
  readOnly: boolean;
}) {
  const row = (widget: ClientWidget, depth: number) => {
    const definition = clientWidgetDefinition(widget.type);
    const active = selected === widget.id;
    return (
      <li key={widget.id}>
        <div
          role="button" tabIndex={0} onClick={() => onSelect(active ? null : widget.id)} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(widget.id); }}
          data-testid="outline-widget" data-widget-id={widget.id} data-type={widget.type}
          className={cn('group flex items-center gap-2 rounded-lg py-1.5 pr-1 text-sm transition-colors', active ? 'bg-primary-soft text-primary' : 'hover:bg-muted')}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <AppIcon name={definition?.icon} fallback="square" className="h-4 w-4 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate">{widgetLabel(widget)}</span>
          {widget.visibleIf && <EyeOff className="h-3.5 w-3.5 shrink-0 opacity-50" aria-label="Shown conditionally" />}
          {!readOnly && (
            <span className={cn('flex shrink-0 items-center', active ? 'flex' : 'hidden group-hover:flex')} onClick={(e) => e.stopPropagation()}>
              <IconButton label="Move up" onClick={() => onMove(widget.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
              <IconButton label="Move down" onClick={() => onMove(widget.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
              <IconButton label="Duplicate" onClick={() => onDuplicate(widget.id)}><Copy className="h-3.5 w-3.5" /></IconButton>
              <IconButton label="Remove" onClick={() => onRemove(widget.id)} danger><Trash2 className="h-3.5 w-3.5" /></IconButton>
            </span>
          )}
        </div>
        {widget.children && widget.children.length > 0 && <ul>{widget.children.map((child) => row(child, depth + 1))}</ul>}
        {widget.children && widget.children.length === 0 && <p className="py-1 text-xs text-muted-foreground" style={{ paddingLeft: 32 + depth * 16 }}>Empty section — select it and add widgets</p>}
      </li>
    );
  };
  return (
    <div className="space-y-2" data-testid="widget-outline">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Widgets on this page</p>
      {widgets.length ? <ul className="space-y-0.5">{widgets.map((w) => row(w, 0))}</ul> : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">This page is empty.</p>}
      {!readOnly && <WidgetPalette onPick={onAdd} />}
    </div>
  );
}

function IconButton({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('rounded-md p-1 text-muted-foreground transition-colors hover:bg-background', danger ? 'hover:text-destructive' : 'hover:text-foreground')}>
      {children}
    </button>
  );
}
