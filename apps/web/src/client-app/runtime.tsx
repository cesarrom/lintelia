import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { CLIENT_WIDGETS, pageSources, type ClientPage, type ClientWidget } from '@repo/fintivio/schemas';
import { accentStyle, brandProps, hexToHsl } from '@/lib/brand';
import { setFormatDefaults } from './format';
import { cn } from '@/lib/utils';
import { evaluate, resolveValue, useResolved, type Scope } from './expressions';
import type { AppData, AppDefinition, Institution } from './types';
import { WIDGETS } from './widgets';

/**
 * The client app runtime (docs/plans/11): renders the pages of an app definition with the data the API resolved for
 * the signed-in client. The same renderer draws the live app (portal, embedded mode) and the studio canvas (preview
 * data, actions simulated).
 */

export interface StartOptions {
  /** How the journey opens, overriding the journey's own setting ('' or undefined: the journey's). */
  presentation?: '' | 'page' | 'dialog' | 'sheet' | 'fullscreen';
}

export interface AppRuntime {
  definition: AppDefinition;
  institution: Institution;
  mode: 'live' | 'preview';
  /** Open a page of the app (with parameters, e.g. `{ key: 'cur-1' }`). */
  openPage: (page: string, params?: Record<string, string>) => void;
  /**
   * Start a journey (the API checks eligibility) and show its first screen: on a page, or over the page as the journey
   * (or the button, `options.presentation`) says (docs/plans/14).
   */
  startJourney: (journey: string, input?: Record<string, unknown>, options?: StartOptions) => Promise<void>;
  /** Continue a journey / application (`journey`: its key when known, so it opens the way the journey says). */
  openCase: (caseId: string, journey?: string | null) => void;
  /** Journey being started (buttons show a spinner). */
  starting: string | null;
  /** Profile, consents, notifications: live only. */
  updateProfile?: (fields: Record<string, unknown>) => Promise<void>;
  signOut?: () => void;
  /** Reports what happens to the host when embedded (journey started / completed…). */
  emit?: (name: 'journey.started' | 'journey.completed', detail: Record<string, unknown>) => void;
}

const RuntimeContext = createContext<AppRuntime | null>(null);

export function RuntimeProvider({ runtime, children }: { runtime: AppRuntime; children: ReactNode }) {
  // Amounts, numbers and dates in the app's currency and locale.
  setFormatDefaults({ currency: runtime.definition.currency, locale: runtime.definition.locale });
  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

/** The runtime, or null outside a client app (e.g. an app page opened while the institution has none). */
export const useMaybeRuntime = () => useContext(RuntimeContext);

export function useRuntime() {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error('RuntimeProvider is missing');
  return runtime;
}

/** Studio: wraps each widget (selection outline, drop targets). */
type WidgetFrame = (widget: ClientWidget, path: string, element: ReactNode) => ReactNode;
const FrameContext = createContext<WidgetFrame | null>(null);
export const WidgetFrameProvider = FrameContext.Provider;

/** Theme of the app (props of its root element): brand colour for light and dark, corner radius. */
/** Font stacks the devices already have (no web font download): modernfontstacks.com. */
export const FONT_STACKS: Record<string, string> = {
  system: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  humanist: 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif',
  geometric: 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif',
  serif: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, serif',
  rounded: 'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
};

/**
 * Theme of the app (props of its root element): brand colour for light and dark, accent colour, corner radius, button
 * shape, background tint, font (docs/plans/14).
 */
export function appThemeProps(definition: Pick<AppDefinition, 'theme'> | undefined, institution: Institution | undefined) {
  const theme = definition?.theme;
  const radius = theme?.radius === 'soft' ? '0.95rem' : theme?.radius === 'sharp' ? '0.3rem' : '0.7rem';
  const extra: Record<string, string> = { '--radius': radius, ...(accentStyle(theme?.accent) as Record<string, string>) };
  const canvas = hexToHsl(theme?.background);
  if (canvas) extra['--app-canvas'] = `${canvas[0]} ${canvas[1]}% ${canvas[2]}%`;
  if (theme?.font && FONT_STACKS[theme.font]) extra.fontFamily = FONT_STACKS[theme.font];
  const props = brandProps(theme?.primary || institution?.pallette?.primary, extra as CSSProperties);
  return {
    ...props,
    ...(hexToHsl(theme?.accent) ? { 'data-accent': '' } : {}),
    ...(canvas ? { 'data-canvas': '' } : {}),
    ...(theme?.buttonShape && theme.buttonShape !== 'rounded' ? { 'data-buttons': theme.buttonShape } : {}),
  };
}

/** The sources a page needs (`me` always). */
export const sourcesOf = (page: ClientPage | undefined) => (page ? pageSources(page).sort() : ['me']);

/** Scope of a page's expressions. */
export const pageScope = (data: AppData | undefined, params: Record<string, string>): Scope => ({ ...(data ?? {}), records: data?.records ?? {}, params });

/** True when the (optional) `visibleIf` rule holds; hidden until evaluated. */
export function useVisible(rule: string | undefined, scope: Scope) {
  const visible = useResolved(async () => (rule?.trim() ? Boolean(await evaluate(rule, scope, scope)) : true), [rule, scope]);
  return rule?.trim() ? visible === true : true;
}

const GRID: Record<string, string> = {
  stack: 'grid gap-5',
  'grid-2': 'grid gap-5 md:grid-cols-2',
  'grid-3': 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
  'grid-4': 'grid gap-4 grid-cols-2 lg:grid-cols-4',
};

export function WidgetList({ widgets, scope, path = '', layout = 'stack' }: { widgets: ClientWidget[]; scope: Scope; path?: string; layout?: string }) {
  return (
    <div className={cn(GRID[layout] ?? GRID.stack, 'items-start')}>
      {widgets.map((widget, index) => <WidgetView key={widget.id} widget={widget} scope={scope} path={`${path}${path ? '.' : ''}${index}`} />)}
    </div>
  );
}

function WidgetView({ widget, scope, path }: { widget: ClientWidget; scope: Scope; path: string }) {
  const frame = useContext(FrameContext);
  const runtime = useRuntime();
  const visible = useVisible(widget.visibleIf, scope);
  // The studio shows hidden widgets faded (they are hidden for this client only).
  if (!visible && !frame) return null;
  let element: ReactNode;
  if (widget.type === 'section') {
    element = <SectionWidget widget={widget} scope={scope} path={path} />;
  } else {
    const Component = WIDGETS[widget.type];
    element = Component
      ? <Component widget={widget} props={widget.props ?? {}} scope={scope} />
      : runtime.mode === 'preview' ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Unknown widget “{widget.type}”</p> : null;
  }
  const wrapped = <div data-widget={widget.type} data-widget-id={widget.id} className={cn('min-w-0', !visible && 'opacity-40')}>{element}</div>;
  return <>{frame ? frame(widget, path, wrapped) : wrapped}</>;
}

function SectionWidget({ widget, scope, path }: { widget: ClientWidget; scope: Scope; path: string }) {
  const props = widget.props as { title?: string; description?: string; layout?: string; card?: boolean };
  const children = widget.children ?? [];
  const frame = useContext(FrameContext);
  const body = children.length || !frame
    ? <WidgetList widgets={children} scope={scope} path={path} layout={props.layout} />
    : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Drop widgets in this section</p>;
  return (
    <section className={cn('space-y-3', props.card && 'rounded-2xl border bg-card p-5 shadow-card')}>
      {(props.title || props.description) && (
        <div>
          {props.title && <h2 className="text-[15px] font-semibold tracking-tight">{props.title}</h2>}
          {props.description && <p className="mt-0.5 text-sm text-muted-foreground">{props.description}</p>}
        </div>
      )}
      {body}
    </section>
  );
}

/** A page: title (unless hidden) and its widgets. The title and description may be templates or expressions. */
export function AppPageView({ page, scope, actions }: { page: ClientPage; scope: Scope; actions?: ReactNode }) {
  const text = useResolved(async () => ({ title: await resolveValue(page.title, scope), description: await resolveValue(page.description, scope) }), [page.title, page.description, scope]);
  const title = text ? String(text.title ?? '') : page.title.trim().startsWith('=') ? '' : page.title;
  const description = text ? (text.description ? String(text.description) : '') : page.description;
  return (
    <div className="space-y-6" data-testid="app-page">
      {!page.hideTitle && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="min-h-8 text-[26px] font-semibold leading-tight tracking-[-0.02em]" data-testid="app-page-title">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <WidgetList widgets={page.widgets} scope={scope} />
    </div>
  );
}

export const widgetCatalogue = CLIENT_WIDGETS;
