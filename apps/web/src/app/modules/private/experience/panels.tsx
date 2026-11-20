import { Plus, Trash2 } from 'lucide-react';
import { ordered, type JsonSchema } from '@repo/lintelia/schemas';
import { Button } from '@/components/ui/button';
import { AppIcon } from '@/client-app/icons';
import { cn } from '@/lib/utils';
import { ObjectFields, type SchemaFormContext } from '../workflows/components/catalog/SchemaForm';
import { InspectorSection } from './Inspector';
import { CURRENCIES, LOCALES, ThemeTools } from './ThemeTools';
import type { Definition } from './studio-model';

/** Forms of the studio's other tabs, as JSON schemas (rendered by the workflow editor's SchemaForm). */

const JOURNEY: JsonSchema = {
  type: 'object', required: ['workflowId', 'title'],
  properties: {
    workflowId: { type: 'string', title: 'Workflow', description: 'runs the journey; its client.screen steps are the screens', 'x-widget': 'workflowPick' },
    title: { type: 'string', title: 'Title' },
    description: { type: 'string', title: 'Description', 'x-widget': 'textarea' },
    icon: { type: 'string', title: 'Icon', 'x-widget': 'icon' },
    category: { type: 'string', title: 'Category', description: 'groups journeys in the launcher, e.g. Save, Borrow' },
    eligibility: { type: 'string', title: 'Who may start it', description: "JSONata over the client's profile, e.g. 'customer' in segments — checked by the API", 'x-widget': 'textarea' },
    stages: { type: 'array', title: 'Stages shown to the client', description: 'client.screen steps name theirs with stage', items: { type: 'object', properties: { key: { type: 'string', title: 'Key' }, label: { type: 'string', title: 'Label' } } } },
    inputs: { type: 'array', title: 'Inputs a button may pass', description: 'e.g. card (the card to freeze); anything else is dropped', items: { type: 'string' } },
    hidden: { type: 'boolean', title: 'Started by buttons only (not listed in the launcher)' },
    donePage: { type: 'string', title: 'Page shown when it ends', 'x-widget': 'page' },
    presentation: {
      type: 'object', title: 'How it opens', description: 'buttons may choose another way',
      properties: {
        mode: { type: 'string', title: 'Opens', enum: ['page', 'dialog', 'sheet', 'fullscreen'], 'x-enum-labels': ['As a page of the app', 'In a dialog over the page', 'In a sheet (side or bottom)', 'Full screen (scanner, checkout)'] },
        size: { type: 'string', title: 'Size (dialog, sheet)', enum: ['sm', 'md', 'lg'], 'x-enum-labels': ['Small', 'Medium', 'Large'] },
        side: { type: 'string', title: 'Sheet from', enum: ['right', 'bottom'], 'x-enum-labels': ['The right', 'The bottom'] },
        dismissible: { type: 'boolean', title: 'The client may close it and continue later', default: true },
      },
    },
  },
};

const COLLECTION: JsonSchema = {
  type: 'object', required: ['key', 'label'],
  properties: {
    key: { type: 'string', title: 'Key', description: 'records:<key> in widgets; lower-case' },
    label: { type: 'string', title: 'Name' },
    description: { type: 'string', title: 'Description' },
    fields: {
      type: 'array', title: 'Fields', description: 'documentation and pickers; records may hold more',
      items: { type: 'object', properties: { key: { type: 'string', title: 'Key' }, label: { type: 'string', title: 'Label' }, type: { type: 'string', title: 'Type', enum: ['text', 'number', 'money', 'date', 'boolean'] } } },
    },
  },
};

type SettingKey = 'theme' | 'region' | 'profile' | 'registration' | 'identity' | 'embed';
export const SETTINGS: Array<{
  key: SettingKey; title: string; description: string; schema: JsonSchema;
  /** Settings kept at the top of the definition (not under their own key). */
  fields?: string[];
}> = [
  {
    key: 'theme', title: 'Appearance', description: 'Colours follow your brand; the primary colour defaults to the institution’s. Start from a preset, then adjust.',
    schema: {
      type: 'object', properties: {
        primary: { type: 'string', title: 'Primary colour', description: 'buttons, links, highlights', 'x-widget': 'color' },
        accent: { type: 'string', title: 'Accent colour', description: 'floating buttons, “accent” buttons, badges', 'x-widget': 'color' },
        background: { type: 'string', title: 'Background tint', description: 'behind the cards (light mode); empty: neutral', 'x-widget': 'color' },
        font: { type: 'string', title: 'Font', enum: ['system', 'humanist', 'geometric', 'serif', 'rounded', 'mono'], 'x-enum-labels': ['System (default)', 'Humanist (friendly)', 'Geometric (modern)', 'Serif (classic)', 'Rounded (playful)', 'Monospace (technical)'] },
        radius: { type: 'string', title: 'Corners', enum: ['soft', 'default', 'sharp'], 'x-enum-labels': ['Soft', 'Default', 'Sharp'] },
        buttonShape: { type: 'string', title: 'Buttons', enum: ['rounded', 'pill', 'square'], 'x-enum-labels': ['Rounded (default)', 'Pill', 'Square'] },
        colorScheme: { type: 'string', title: 'Light or dark', enum: ['auto', 'light', 'dark'], 'x-enum-labels': ['As the device / the client chooses', 'Always light', 'Always dark'] },
        header: { type: 'string', title: 'Menu', enum: ['light', 'brand'], 'x-enum-labels': ['Light', 'In the brand colour'] },
        logoUrl: { type: 'string', title: 'Logo address (https)' },
      },
    },
  },
  {
    key: 'region', title: 'Region', description: 'How amounts, numbers and dates read in the app. Records in another currency keep theirs.',
    fields: ['currency', 'locale'],
    schema: {
      type: 'object', properties: {
        currency: { type: 'string', title: 'Currency', enum: CURRENCIES.map(([code]) => code), 'x-enum-labels': CURRENCIES.map(([code, name]) => `${code} — ${name}`) },
        locale: { type: 'string', title: 'Language and region', description: 'formats of numbers and dates', enum: LOCALES.map(([code]) => code), 'x-enum-labels': LOCALES.map(([code, name]) => `${name} (${code})`) },
      },
    },
  },
  {
    key: 'profile', title: 'Client profile', description: 'What you know about each client (me.<key> in expressions). Editable fields can be changed by the client.',
    schema: {
      type: 'object', properties: {
        fields: {
          type: 'array', title: 'Fields',
          items: {
            type: 'object', properties: {
              key: { type: 'string', title: 'Key' }, label: { type: 'string', title: 'Label' },
              type: { type: 'string', title: 'Type', enum: ['text', 'email', 'phone', 'date', 'number', 'select', 'textarea'] },
              options: { type: 'array', title: 'Options (select)', items: { type: 'string' } },
              editable: { type: 'boolean', title: 'The client may change it' }, required: { type: 'boolean', title: 'Required' },
            },
          },
        },
      },
    },
  },
  {
    key: 'registration', title: 'Sign-up', description: 'Self-service registration on the app; new clients start the workflows listening to client.registered.',
    schema: {
      type: 'object', properties: {
        enabled: { type: 'boolean', title: 'Anyone can create an account', default: true },
        methods: { type: 'array', title: 'Sign-in methods', description: 'email_code, password', items: { type: 'string' } },
        fields: { type: 'array', title: 'Profile fields asked at sign-up', description: 'keys of profile fields', items: { type: 'string' } },
        consents: {
          type: 'array', title: 'Consents',
          items: { type: 'object', properties: { key: { type: 'string', title: 'Key' }, label: { type: 'string', title: 'Label' }, version: { type: 'string', title: 'Version' }, url: { type: 'string', title: 'Document address' }, required: { type: 'boolean', title: 'Required', default: true } } },
        },
      },
    },
  },
  {
    key: 'identity', title: 'Identity of your clients', description: 'How clients known to your systems are recognised: server-created sessions (POST /client-sessions) and tokens of your identity provider. Each field is a JSONata expression over the input.',
    schema: {
      type: 'object', properties: {
        linkByEmail: { type: 'boolean', title: 'Link to an existing client with the same e-mail address', default: true },
        mapping: {
          type: 'object', title: 'Mapping',
          properties: {
            externalId: { type: 'string', title: 'Your client identifier', description: 'e.g. sub, or customer.id' },
            email: { type: 'string', title: 'E-mail' },
            name: { type: 'string', title: 'Name', description: "e.g. given_name & ' ' & family_name" },
            attributes: { type: 'object', title: 'Profile attributes', 'x-widget': 'keyValue' },
            segments: { type: 'string', title: 'Segments', description: 'an expression giving a list, e.g. roles' },
          },
        },
        tokenExchange: {
          type: 'object', title: 'Token exchange',
          properties: {
            enabled: { type: 'boolean', title: 'Accept tokens of our identity provider' },
            issuer: { type: 'string', title: 'Issuer (iss)' },
            jwksUri: { type: 'string', title: 'JWKS address' },
            audience: { type: 'string', title: 'Audience (aud)' },
          },
        },
      },
    },
  },
  {
    key: 'embed', title: 'Embedding', description: 'Sites that may show the app inside their pages with the SDK (@lintelia/client-sdk).',
    schema: { type: 'object', properties: { allowedOrigins: { type: 'array', title: 'Allowed sites', description: 'origins, e.g. https://www.bank.com', items: { type: 'string' } } } },
  },
];

/** Journeys: left list. */
export function JourneysList({ definition, workflows, selected, onSelect, onAdd, readOnly }: {
  definition: Definition; workflows: Array<{ id: string; name: string; active: boolean }>; selected: string | null; onSelect: (key: string) => void; onAdd: () => void; readOnly: boolean;
}) {
  return (
    <div className="space-y-1" data-testid="studio-journeys">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Journeys</p>
        {!readOnly && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd} data-testid="add-journey"><Plus className="h-3.5 w-3.5" />Journey</Button>}
      </div>
      {ordered(definition.journeys, definition.journeyOrder).map(([key, journey]) => {
        const workflow = workflows.find((w) => w.id === journey.workflowId);
        return (
          <button key={key} type="button" onClick={() => onSelect(key)} data-testid="studio-journey" data-journey={key}
            className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', selected === key ? 'bg-primary-soft' : 'hover:bg-muted')}>
            <AppIcon name={journey.icon} fallback="sparkles" className={cn('mt-0.5 h-4 w-4 shrink-0', selected === key ? 'text-primary' : 'opacity-70')} />
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-sm', selected === key && 'font-medium text-primary')}>{journey.title}</span>
              <span className={cn('block truncate text-[11.5px]', workflow?.active ? 'text-muted-foreground' : 'text-destructive')}>{workflow ? `${workflow.name}${workflow.active ? '' : ' · not published'}` : 'workflow missing'}{journey.hidden ? ' · button only' : ''}</span>
            </span>
          </button>
        );
      })}
      {!Object.keys(definition.journeys).length && <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No journeys yet. A journey is a workflow clients start from the app.</p>}
    </div>
  );
}

export function JourneyInspector({ definition, journeyKey, context, onChange, readOnly }: { definition: Definition; journeyKey: string; context: SchemaFormContext; onChange: (definition: Definition) => void; readOnly: boolean }) {
  const journey = definition.journeys[journeyKey];
  if (!journey) return null;
  const remove = () => {
    const { [journeyKey]: _removed, ...rest } = definition.journeys;
    onChange({ ...definition, journeys: rest, journeyOrder: definition.journeyOrder?.filter((k) => k !== journeyKey) });
  };
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="journey-inspector">
      <InspectorSection title={journey.title || 'Journey'} description={`Key: ${journeyKey} — buttons and quick actions start it by this key.`}>
        <ObjectFields schema={JOURNEY} value={journey} context={context} onChange={(value) => onChange({ ...definition, journeys: { ...definition.journeys, [journeyKey]: value as typeof journey } })} />
      </InspectorSection>
      <InspectorSection title="Removal">
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={remove}><Trash2 className="h-4 w-4" />Remove the journey</Button>
      </InspectorSection>
    </fieldset>
  );
}

/** Data collections: left list. */
export function CollectionsList({ definition, selected, onSelect, onAdd, readOnly }: { definition: Definition; selected: number | null; onSelect: (index: number) => void; onAdd: () => void; readOnly: boolean }) {
  return (
    <div className="space-y-1" data-testid="studio-collections">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Collections</p>
        {!readOnly && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onAdd} data-testid="add-collection"><Plus className="h-3.5 w-3.5" />Collection</Button>}
      </div>
      {definition.collections.map((c, i) => (
        <button key={`${c.key}-${i}`} type="button" onClick={() => onSelect(i)} data-testid="studio-collection"
          className={cn('flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors', selected === i ? 'bg-primary-soft' : 'hover:bg-muted')}>
          <AppIcon name="database" className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{c.label}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">records:{c.key} · {c.fields.length} fields</span>
          </span>
        </button>
      ))}
      <p className="px-1 pt-3 text-xs leading-relaxed text-muted-foreground">
        Records are per client. Your systems write them with the client records API (<span className="font-mono">PUT /clients/:client/records/:collection/:key</span>); workflows with the <span className="font-mono">client.record</span> step.
      </p>
    </div>
  );
}

export function CollectionInspector({ definition, index, context, onChange, readOnly }: { definition: Definition; index: number; context: SchemaFormContext; onChange: (definition: Definition) => void; readOnly: boolean }) {
  const collection = definition.collections[index];
  if (!collection) return null;
  const set = (value: Record<string, unknown>) => onChange({ ...definition, collections: definition.collections.map((c, i) => (i === index ? (value as typeof c) : c)) });
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="collection-inspector">
      <InspectorSection title={collection.label || 'Collection'}>
        <ObjectFields schema={COLLECTION} value={collection} context={context} onChange={set} />
      </InspectorSection>
      <InspectorSection title="Removal">
        <Button type="button" size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => onChange({ ...definition, collections: definition.collections.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" />Remove the collection</Button>
      </InspectorSection>
    </fieldset>
  );
}

export function SettingsList({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <div className="space-y-1" data-testid="studio-settings">
      <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Settings</p>
      {SETTINGS.map((s) => (
        <button key={s.key} type="button" onClick={() => onSelect(s.key)} data-testid="studio-setting" data-setting={s.key}
          className={cn('w-full rounded-lg px-2.5 py-2 text-left text-sm transition-colors', selected === s.key ? 'bg-primary-soft font-medium text-primary' : 'hover:bg-muted')}>
          {s.title}
        </button>
      ))}
    </div>
  );
}

export function SettingsInspector({ definition, section, context, onChange, readOnly, portalUrl }: { definition: Definition; section: string; context: SchemaFormContext; onChange: (definition: Definition) => void; readOnly: boolean; portalUrl?: string }) {
  const setting = SETTINGS.find((s) => s.key === section) ?? SETTINGS[0];
  const all = definition as unknown as Record<string, unknown>;
  const value = setting.fields ? Object.fromEntries(setting.fields.map((f) => [f, all[f]])) : all[setting.key];
  const set = (next: Record<string, unknown>) => onChange((setting.fields ? { ...definition, ...next } : { ...definition, [setting.key]: next }) as Definition);
  return (
    <fieldset disabled={readOnly} className="min-w-0" data-testid="settings-inspector" data-setting={setting.key}>
      {setting.key === 'theme' && <ThemeTools theme={definition.theme ?? {}} onChange={(theme) => onChange({ ...definition, theme })} />}
      <InspectorSection title={setting.title} description={setting.description}>
        <ObjectFields schema={setting.schema} value={value} context={context} onChange={(next) => set(next as Record<string, unknown>)} />
      </InspectorSection>
      {setting.key === 'embed' && (
        <InspectorSection title="Embed it" description="In your site, with a client session your backend creates (POST /client-sessions):">
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">{`import { mount } from '@lintelia/client-sdk';

mount('#banking', {
  baseUrl: '${portalUrl ? new URL(portalUrl).origin : 'https://app.your-bank.com'}',
  fetchClientSecret: () =>
    fetch('/api/lintelia-session', { method: 'POST' })
      .then((r) => r.json()).then((b) => b.clientSecret),
});`}</pre>
          <p className="text-xs text-muted-foreground">Your own address (e.g. app.your-bank.com): Settings → Domains.</p>
        </InspectorSection>
      )}
    </fieldset>
  );
}
