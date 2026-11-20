import { Home, Trash2 } from 'lucide-react';
import { clientWidgetDefinition, type ClientWidget } from '@repo/lintelia/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AppIcon } from '@/client-app/icons';
import { ObjectFields, type SchemaFormContext } from '../workflows/components/catalog/SchemaForm';
import type { Definition } from './studio-model';

export function InspectorSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-b px-4 py-4 last:border-b-0">
      <div>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function RuleField({ id, label, value, onChange, hint, disabled }: { id: string; label: string; value: string | undefined; onChange: (value: string | undefined) => void; hint: string; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} rows={2} className="font-mono text-xs" value={value ?? ''} disabled={disabled} placeholder="always" onChange={(e) => onChange(e.target.value.trim() ? e.target.value : undefined)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** Properties of the selected widget (its JSON schema as a form), when it shows, its id. */
export function WidgetInspector({ widget, context, onChange, onRemove, readOnly }: { widget: ClientWidget; context: SchemaFormContext; onChange: (widget: ClientWidget) => void; onRemove: () => void; readOnly: boolean }) {
  const definition = clientWidgetDefinition(widget.type);
  return (
    <div data-testid="widget-inspector" data-type={widget.type}>
      <div className="flex items-start gap-3 border-b px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><AppIcon name={definition?.icon} className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{definition?.title ?? widget.type}</p>
          <p className="text-xs leading-snug text-muted-foreground">{definition?.description}</p>
        </div>
        {!readOnly && <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Remove widget" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
      </div>
      <fieldset disabled={readOnly} className="min-w-0">
        {definition && (
          <InspectorSection title="Content">
            <ObjectFields schema={definition.props} value={widget.props} context={context} onChange={(props) => onChange({ ...widget, props })} />
          </InspectorSection>
        )}
        <InspectorSection title="Visibility">
          <RuleField
            id="widget-visible-if" label="Show only when" value={widget.visibleIf} disabled={readOnly}
            onChange={(visibleIf) => onChange({ ...widget, visibleIf })}
            hint={"JSONata over the page data, e.g. 'customer' in me.segments or $count(records.accounts) > 0"}
          />
          <p className="font-mono text-[11px] text-muted-foreground">id: {widget.id}</p>
        </InspectorSection>
      </fieldset>
    </div>
  );
}

/** Page settings: title, description, menu entry, home. */
export function PageInspector({ definition, pageKey, onChange, onDelete, onRename, readOnly }: {
  definition: Definition;
  pageKey: string;
  onChange: (definition: Definition) => void;
  onDelete: () => void;
  onRename: (key: string) => void;
  readOnly: boolean;
}) {
  const page = definition.pages[pageKey];
  const nav = definition.navigation.find((n) => n.page === pageKey);
  const isHome = definition.home === pageKey;
  if (!page) return null;
  const setPage = (change: Partial<typeof page>) => onChange({ ...definition, pages: { ...definition.pages, [pageKey]: { ...page, ...change } } });
  const setNav = (change: Partial<NonNullable<typeof nav>> | null) => {
    if (change === null) return onChange({ ...definition, navigation: definition.navigation.filter((n) => n.page !== pageKey) });
    if (!nav) return onChange({ ...definition, navigation: [...definition.navigation, { page: pageKey, label: page.title, icon: page.icon, ...change }] });
    onChange({ ...definition, navigation: definition.navigation.map((n) => (n.page === pageKey ? { ...n, ...change } : n)) });
  };
  const navIndex = definition.navigation.findIndex((n) => n.page === pageKey);
  const moveNav = (direction: -1 | 1) => {
    const list = [...definition.navigation];
    const target = navIndex + direction;
    if (navIndex < 0 || target < 0 || target >= list.length) return;
    [list[navIndex], list[target]] = [list[target], list[navIndex]];
    onChange({ ...definition, navigation: list });
  };
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="page-inspector">
      <InspectorSection title="Page" description={`Address: /portal${isHome ? '' : `/p/${pageKey}`}`}>
        <div className="space-y-1">
          <Label htmlFor="page-title">Title</Label>
          <Input id="page-title" value={page.title} onChange={(e) => setPage({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="page-description">Description</Label>
          <Textarea id="page-description" rows={2} value={page.description ?? ''} onChange={(e) => setPage({ description: e.target.value || undefined })} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="page-hide-title" checked={!!page.hideTitle} onCheckedChange={(v) => setPage({ hideTitle: v || undefined })} />
          <Label htmlFor="page-hide-title">Hide the title (e.g. a hero says it all)</Label>
        </div>
        <div className="space-y-1">
          <Label htmlFor="page-key">Key</Label>
          <Input id="page-key" defaultValue={pageKey} className="font-mono text-xs" onBlur={(e) => { const key = e.target.value.trim(); if (key && key !== pageKey) onRename(key); }} />
          <p className="text-xs text-muted-foreground">Used in links; renaming updates the menu, buttons and journeys that open it.</p>
        </div>
      </InspectorSection>
      <InspectorSection title="Menu" description="Pages in the menu appear in the sidebar (computer) and the tab bar (phone); the first four are tabs.">
        <div className="flex items-center gap-2">
          <Switch id="page-in-menu" checked={!!nav} onCheckedChange={(v) => setNav(v ? {} : null)} data-testid="page-in-menu" />
          <Label htmlFor="page-in-menu">Show in the menu</Label>
        </div>
        {nav && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="nav-label">Label</Label>
                <Input id="nav-label" value={nav.label} onChange={(e) => setNav({ label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nav-icon">Icon</Label>
                <div className="relative">
                  <Input id="nav-icon" value={nav.icon ?? ''} className="pr-9" onChange={(e) => setNav({ icon: e.target.value || undefined })} />
                  <AppIcon name={nav.icon} fallback="" className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            </div>
            <RuleField id="nav-visible-if" label="Show in the menu only when" value={nav.visibleIf} onChange={(visibleIf) => setNav({ visibleIf })} hint="e.g. 'customer' in me.segments" disabled={readOnly} />
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => moveNav(-1)} disabled={navIndex <= 0}>Earlier in the menu</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => moveNav(1)} disabled={navIndex >= definition.navigation.length - 1}>Later</Button>
            </div>
          </>
        )}
      </InspectorSection>
      <InspectorSection title="Home and removal">
        {isHome ? <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Home className="h-4 w-4" />This is the home page.</p> : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...definition, home: pageKey })}><Home className="h-4 w-4" />Make it the home page</Button>
            <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={onDelete} data-testid="delete-page"><Trash2 className="h-4 w-4" />Delete page</Button>
          </div>
        )}
      </InspectorSection>
    </fieldset>
  );
}
