import { useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { JsonSchema } from '@repo/fintivio/schemas';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * A small JSON Schema form renderer for component configuration (docs/plans/01). Supports objects, strings (enums,
 * textarea, expressions, durations, role pickers), numbers, booleans, arrays of strings and of objects, and
 * key → expression maps (`x-widget: keyValue`).
 */
export interface SchemaFormContext {
  roles: string[];
  /** Options for `x-widget: connection` fields and dynamic `x-options` fields, by field path. */
  options?: Record<string, Array<{ value: string; label: string }>>;
  /** Published workflows, for `x-widget: workflow` fields (sub-workflows, for each). */
  workflows?: Array<{ value: string; label: string }>;
  /** Forms of the institution, for `x-widget: form` fields. */
  forms?: Array<{ value: string; label: string }>;
  /** Options of other `x-widget` pickers, by widget name (client app studio: `source`, `page`, `journey`). */
  choices?: Record<string, Array<{ value: string; label: string }>>;
  /** Suggestions for `x-widget: icon` fields. */
  icons?: string[];
}

interface FieldProps {
  schema: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  path: string;
  required?: boolean;
  context: SchemaFormContext;
}

const isExpression = (value: unknown) => typeof value === 'string' && (value.trim().startsWith('=') || value.includes('{{'));

function Hint({ schema }: { schema: JsonSchema }) {
  const parts = [schema.description, schema['x-expression'] ? 'accepts =JSONata or {{templates}}' : undefined].filter(Boolean);
  return parts.length ? <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p> : null;
}

function StringField({ schema, value, onChange, label, path, required, context }: FieldProps) {
  const id = useId();
  const widget = schema['x-widget'];
  const current = (value ?? '') as string;
  const options = schema.enum
    ? schema.enum.map((v, i) => ({ value: String(v), label: schema['x-enum-labels']?.[i] ?? String(v) }))
    : widget === 'role' ? context.roles.map((r) => ({ value: r, label: r }))
      : widget === 'workflow' ? context.workflows
        : widget === 'form' ? context.forms
        : (widget && context.choices?.[widget]) || context.options?.[path];

  let control: React.ReactNode;
  if (options && !(schema['x-expression'] && isExpression(current)) && widget !== 'role') {
    control = (
      <select id={id} aria-label={label} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={current} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (widget === 'textarea' || widget === 'expression') {
    control = <Textarea id={id} aria-label={label} rows={widget === 'expression' ? 2 : 4} className={cn(widget === 'expression' && 'font-mono text-xs')}
      value={current} onChange={(e) => onChange(e.target.value)} />;
  } else if (widget === 'color') {
    // A colour: the browser's picker next to the hex value (both editable).
    const valid = /^#[0-9a-fA-F]{6}$/.test(current);
    control = (
      <div className="flex items-center gap-2">
        <input type="color" aria-label={`${label} picker`} value={valid ? current : '#000000'} onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1" data-testid={`color-${path}`} />
        <Input id={id} aria-label={label} value={current} placeholder="#RRGGBB" className="font-mono text-xs" onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} />
      </div>
    );
  } else {
    control = (
      <>
        <Input id={id} aria-label={label} value={current} list={widget === 'role' ? `${id}-roles` : widget === 'icon' && context.icons ? `${id}-icons` : undefined}
          placeholder={widget === 'duration' ? 'e.g. PT24H, P3D' : undefined}
          className={cn(isExpression(current) && 'font-mono text-xs')}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)} />
        {widget === 'role' && <datalist id={`${id}-roles`}>{context.roles.map((r) => <option key={r} value={r} />)}</datalist>}
        {widget === 'icon' && context.icons && <datalist id={`${id}-icons`}>{context.icons.map((r) => <option key={r} value={r} />)}</datalist>}
      </>
    );
  }
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required && ' *'}</Label>
      {control}
      <Hint schema={schema} />
    </div>
  );
}

function NumberField({ schema, value, onChange, label, required }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}{required && ' *'}</Label>
      <Input id={id} type={schema['x-expression'] ? 'text' : 'number'} value={(value ?? '') as string}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          onChange(isExpression(raw) || Number.isNaN(Number(raw)) ? raw : Number(raw));
        }} />
      <Hint schema={schema} />
    </div>
  );
}

function BooleanField({ schema, value, onChange, label }: FieldProps) {
  const id = useId();
  const checked = value === undefined ? schema.default === true : value === true;
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={(v) => onChange(v)} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function StringListField({ schema, value, onChange, label }: FieldProps) {
  const id = useId();
  const list = Array.isArray(value) ? value.map(String) : [];
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={list.join(', ')} placeholder="comma separated"
        onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      <Hint schema={schema} />
    </div>
  );
}

function ObjectListField({ schema, value, onChange, label, path, context }: FieldProps) {
  const list = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const item = schema.items ?? { type: 'object', properties: {} };
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Hint schema={schema} />
      {list.map((entry, index) => (
        <div key={index} className="relative rounded-md border bg-muted/30 p-3 pr-10" data-testid={`${path}-item`}>
          <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-7 w-7" aria-label={`Remove ${label} ${index + 1}`}
            onClick={() => onChange(list.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
          <ObjectFields schema={item} value={entry} onChange={(next) => onChange(list.map((e, i) => (i === index ? next : e)))} path={`${path}[${index}]`} context={context} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, {}])}><Plus className="mr-1 h-3 w-3" />Add</Button>
    </fieldset>
  );
}

function KeyValueField({ schema, value, onChange, label }: FieldProps) {
  const entries = Object.entries((value ?? {}) as Record<string, string>);
  const update = (next: Array<[string, string]>) => onChange(Object.fromEntries(next.filter(([k]) => k !== '' || true)));
  return (
    <fieldset className="space-y-2 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Hint schema={schema} />
      {entries.map(([key, expression], index) => (
        <div key={index} className="grid grid-cols-[1fr_2fr_auto] gap-2">
          <Input aria-label={`${label} name ${index + 1}`} value={key} onChange={(e) => update(entries.map((en, i) => (i === index ? [e.target.value, en[1]] : en)))} />
          <Input aria-label={`${label} expression ${index + 1}`} className="font-mono text-xs" value={String(expression ?? '')}
            onChange={(e) => update(entries.map((en, i) => (i === index ? [en[0], e.target.value] : en)))} />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${key}`} onClick={() => update(entries.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => update([...entries, [`value${entries.length + 1}`, '']])}><Plus className="mr-1 h-3 w-3" />Add</Button>
    </fieldset>
  );
}

/** Any JSON value as text (`x-widget: json`), e.g. the configuration of the step a `poll` calls. */
function JsonField({ schema, value, onChange, label }: FieldProps) {
  const id = useId();
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} aria-label={label} rows={5} className="font-mono text-xs" value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(e.target.value.trim() ? JSON.parse(e.target.value) : undefined);
            setError(null);
          } catch (err) {
            setError((err as Error).message);
          }
        }} />
      {error ? <p className="text-xs text-destructive">Not valid JSON: {error}</p> : <Hint schema={schema} />}
    </div>
  );
}

function Field(props: FieldProps) {
  const { schema } = props;
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (schema['x-widget'] === 'keyValue') return <KeyValueField {...props} />;
  if (schema['x-widget'] === 'json') return <JsonField {...props} />;
  if (type === 'object') {
    return (
      <fieldset className="space-y-3 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">{props.label}</legend>
        <ObjectFields schema={schema} value={props.value} onChange={props.onChange} path={props.path} context={props.context} />
      </fieldset>
    );
  }
  if (type === 'array') return schema.items?.type === 'object' ? <ObjectListField {...props} /> : <StringListField {...props} />;
  if (type === 'boolean') return <BooleanField {...props} />;
  if (type === 'number' || type === 'integer') return <NumberField {...props} />;
  return <StringField {...props} />;
}

export function ObjectFields({ schema, value, onChange, path = '', context }: { schema: JsonSchema; value: unknown; onChange: (value: Record<string, unknown>) => void; path?: string; context: SchemaFormContext }) {
  const current = (value ?? {}) as Record<string, unknown>;
  const required = new Set(schema.required ?? []);
  // `x-show-if`: properties that only make sense for some values of a sibling (e.g. a field's type).
  const shown = (property: JsonSchema) => Object.entries(property['x-show-if'] ?? {}).every(([sibling, values]) => {
    const given = current[sibling] ?? schema.properties?.[sibling]?.default;
    return values.includes(given);
  });
  return (
    <div className="space-y-3">
      {Object.entries(schema.properties ?? {}).filter(([, property]) => shown(property)).map(([key, property]) => (
        <Field key={key} schema={property} value={current[key]} label={property.title ?? key} required={required.has(key)}
          path={path ? `${path}.${key}` : key} context={context}
          onChange={(next) => {
            const copy = { ...current };
            if (next === undefined) delete copy[key];
            else copy[key] = next;
            onChange(copy);
          }} />
      ))}
    </div>
  );
}
