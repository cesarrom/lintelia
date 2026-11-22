import { clientWidgetDefinition, type ClientAppDefinition, type ClientPage, type ClientWidget, type ClientWidgetDefinition } from '@repo/lintelia/schemas';

/**
 * Edits of the client app's draft (pure functions over the definition). Widgets are addressed by id (unique per page);
 * sections hold children one level deep.
 */
export type Definition = ClientAppDefinition;

const shortId = () => Math.random().toString(36).slice(2, 7);

export const newWidget = (type: string, definitionOf: (type: string) => ClientWidgetDefinition | undefined = clientWidgetDefinition): ClientWidget => {
  const definition = definitionOf(type);
  return { id: `${type}-${shortId()}`, type, props: structuredClone(definition?.defaults ?? {}), ...(definition?.container ? { children: [] } : {}) };
};

/** A copy of a widget (and its children) with fresh ids. */
export const cloneWidget = (widget: ClientWidget): ClientWidget => ({
  ...structuredClone(widget), id: `${widget.type}-${shortId()}`, children: widget.children?.map(cloneWidget),
});

/** Where a widget sits: the list holding it and its index. */
export function locate(widgets: ClientWidget[], id: string): { list: ClientWidget[]; index: number; parent: ClientWidget | null } | null {
  const index = widgets.findIndex((w) => w.id === id);
  if (index >= 0) return { list: widgets, index, parent: null };
  for (const widget of widgets) {
    if (!widget.children) continue;
    const found = locate(widget.children, id);
    if (found) return { ...found, parent: found.parent ?? widget };
  }
  return null;
}

export const findWidget = (page: ClientPage | undefined, id: string | null) => {
  if (!page || !id) return null;
  const found = locate(page.widgets, id);
  return found ? found.list[found.index] : null;
};

/** Apply an edit to a copy of one page's widgets. */
function editPage(definition: Definition, pageKey: string, edit: (widgets: ClientWidget[]) => void): Definition {
  const next = structuredClone(definition);
  const page = next.pages[pageKey];
  if (!page) return definition;
  edit(page.widgets);
  return next;
}

// --- edits of a list of widgets, in place (the client app's pages, the back office's pages and dashboard additions) ---

/** Insert: into the selected section, after the selected widget, or at the end of the list. */
export function insertIn(widgets: ClientWidget[], widget: ClientWidget, selectedId: string | null) {
  const found = selectedId ? locate(widgets, selectedId) : null;
  if (!found) return void widgets.push(widget);
  const selected = found.list[found.index];
  if (clientWidgetDefinition(selected.type)?.container && !clientWidgetDefinition(widget.type)?.container) {
    selected.children = [...(selected.children ?? []), widget];
    return;
  }
  // Sections are not nested: a section added next to a child goes after its parent section.
  if (found.parent && clientWidgetDefinition(widget.type)?.container) {
    const outer = locate(widgets, found.parent.id)!;
    outer.list.splice(outer.index + 1, 0, widget);
    return;
  }
  found.list.splice(found.index + 1, 0, widget);
}

export function updateIn(widgets: ClientWidget[], id: string, change: (widget: ClientWidget) => ClientWidget) {
  const found = locate(widgets, id);
  if (found) found.list[found.index] = change(found.list[found.index]);
}

export function removeIn(widgets: ClientWidget[], id: string) {
  const found = locate(widgets, id);
  if (found) found.list.splice(found.index, 1);
}

/** Duplicate in place; the copy's id. */
export function duplicateIn(widgets: ClientWidget[], id: string): string | null {
  const found = locate(widgets, id);
  if (!found) return null;
  const copy = cloneWidget(found.list[found.index]);
  found.list.splice(found.index + 1, 0, copy);
  return copy.id;
}

/** Move up/down among its siblings; at the edge of a section, out of it. Into a section right above/below when moving onto one. */
export function moveIn(widgets: ClientWidget[], id: string, direction: -1 | 1) {
  const found = locate(widgets, id);
  if (!found) return;
  const { list, index, parent } = found;
  const widget = list[index];
  const target = index + direction;
  if (target < 0 || target >= list.length) {
    if (!parent) return;
    // Leave the section: before or after it.
    list.splice(index, 1);
    const outer = locate(widgets, parent.id)!;
    outer.list.splice(direction < 0 ? outer.index : outer.index + 1, 0, widget);
    return;
  }
  const neighbour = list[target];
  if (!parent && clientWidgetDefinition(neighbour.type)?.container && !clientWidgetDefinition(widget.type)?.container) {
    // Enter the section: at its end when coming from above… at its start when coming from below.
    list.splice(index, 1);
    neighbour.children = neighbour.children ?? [];
    if (direction > 0) neighbour.children.unshift(widget);
    else neighbour.children.push(widget);
    return;
  }
  list.splice(index, 1);
  list.splice(target, 0, widget);
}

export const insertWidget = (definition: Definition, pageKey: string, widget: ClientWidget, selectedId: string | null): Definition =>
  editPage(definition, pageKey, (widgets) => insertIn(widgets, widget, selectedId));

export const updateWidget = (definition: Definition, pageKey: string, id: string, change: (widget: ClientWidget) => ClientWidget): Definition =>
  editPage(definition, pageKey, (widgets) => updateIn(widgets, id, change));

export const removeWidget = (definition: Definition, pageKey: string, id: string): Definition =>
  editPage(definition, pageKey, (widgets) => removeIn(widgets, id));

export function duplicateWidget(definition: Definition, pageKey: string, id: string): { definition: Definition; id: string | null } {
  let copyId: string | null = null;
  const next = editPage(definition, pageKey, (widgets) => { copyId = duplicateIn(widgets, id); });
  return { definition: next, id: copyId };
}

export const moveWidget = (definition: Definition, pageKey: string, id: string, direction: -1 | 1): Definition =>
  editPage(definition, pageKey, (widgets) => moveIn(widgets, id, direction));

/** `Open & apply` → `open-apply`; unique among existing keys. */
export function keyFrom(title: string, existing: string[], fallback = 'page') {
  const base = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;
  const start = /^[a-z]/.test(base) ? base : `${fallback}-${base}`;
  let key = start;
  for (let i = 2; existing.includes(key); i++) key = `${start}-${i}`;
  return key;
}

export const journeyKeyFrom = (title: string, existing: string[]) => keyFrom(title, existing, 'journey').replace(/-/g, '_');

/** Title shown for a widget in the outline. */
export function widgetLabel(widget: ClientWidget) {
  const props = widget.props as Record<string, unknown>;
  const text = [props.title, props.label, props.text, props.eyebrow].find((v) => typeof v === 'string' && v.trim() && !v.trim().startsWith('='));
  return typeof text === 'string' ? text.replace(/\{\{[^}]+\}\}/g, '…').slice(0, 48) : clientWidgetDefinition(widget.type)?.title ?? widget.type;
}

/** Rename a page everywhere it is referenced (navigation, links, journeys' done pages, home). */
export function renamePageKey(definition: Definition, from: string, to: string): Definition {
  const text = JSON.stringify(definition, (key, value) => {
    if ((key === 'page' || key === 'donePage' || key === 'home') && value === from) return to;
    return value;
  });
  const next = JSON.parse(text) as Definition;
  next.pages = Object.fromEntries(Object.entries(next.pages).map(([k, v]) => [k === from ? to : k, v]));
  if (next.pageOrder) next.pageOrder = next.pageOrder.map((k) => (k === from ? to : k));
  return next;
}

/** A page's name in the studio: its title, or (when the title is an expression) its menu label or key. */
export function pageLabel(definition: Definition, key: string) {
  const page = definition.pages[key];
  if (page && !page.title.trim().startsWith('=') && !page.title.includes('{{')) return page.title;
  return definition.navigation.find((n) => n.page === key)?.label ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ');
}
