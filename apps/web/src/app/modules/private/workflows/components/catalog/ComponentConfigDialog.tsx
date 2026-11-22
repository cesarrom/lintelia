import { useState } from 'react';
import { componentEvents, type ComponentDefinition, type NodeData } from '@repo/lintelia/schemas';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApiQuery } from '@/lib/services/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useAxios } from '@/lib/services/axios';
import { useWorkflow } from '../WorkflowContext';
import { ObjectFields } from './SchemaForm';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

function useConnectorOptions(connectionId: string | null, fields: Array<{ key: string; name: string }>) {
  const { axios, ready } = useAxios();
  return useQuery({
    queryKey: ['integrations', connectionId, 'options', fields.map((f) => f.name).join(',')],
    enabled: ready && !!connectionId && fields.length > 0,
    queryFn: async () => {
      const entries = await Promise.all(fields.map(async (f) => {
        const { data } = await axios.post(`${API_BASE_URL}/integrations/${connectionId}/options/${f.name}`).catch(() => ({ data: { options: [] } }));
        return [f.key, (data.options ?? []) as Array<{ value: string; label: string }>] as const;
      }));
      return Object.fromEntries(entries);
    },
  });
}

/** Configure a step from its component's JSON schema; events (and dangling edges) follow the new configuration. */
export function ComponentConfigDialog({ nodeId, definition, open, onOpenChange }: {
  nodeId: string; definition: ComponentDefinition; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const { nodes, edges, updateNodes, updateEdges } = useWorkflow();
  const node = nodes.find((n) => n.id === nodeId);
  const [name, setName] = useState(node?.data.name ?? '');
  const [description, setDescription] = useState(node?.data.description ?? '');
  const [config, setConfig] = useState<Record<string, unknown>>((node?.data.config as Record<string, unknown>) ?? {});
  const { data: roles = [] } = useApiQuery<Array<{ id: string }>>(['roles', 'getRoles'], '/roles');
  const { data: connections = [] } = useApiQuery<Array<{ id: string; displayName: string; connectorId: string; status: string }>>(
    ['integrations', 'list'], '/integrations', { enabled: definition.source.kind === 'connector' },
  );

  const { data: workflows = [] } = useApiQuery<Array<{ id: string; name: string; status: string }>>(['workflows', 'list'], '/workflows');
  const { data: forms = [] } = useApiQuery<Array<{ id: string; name: string }>>(['forms', 'list'], '/forms');
  // Webhook subscriptions (live.publish to a webhook): for those who may see them; others type the id.
  const { hasPermission } = useAuth();
  const { data: subscriptions = [] } = useApiQuery<Array<{ id: string; url: string; description: string | null }>>(['webhooks'], hasPermission('webhooks:manage') ? '/webhooks' : null);
  // Dynamic options asked from the connector for the chosen connection (e.g. Didit workflows, Documenso templates).
  const dynamicFields = Object.entries(definition.configSchema.properties ?? {}).filter(([, field]) => typeof (field as Record<string, unknown>)['x-options'] === 'string')
    .map(([key, field]) => ({ key, name: String((field as Record<string, unknown>)['x-options']) }));
  const connectionId = typeof config.connection === 'string' ? config.connection : null;
  const { data: dynamicOptions = {} } = useConnectorOptions(connectionId, dynamicFields);

  if (!node) return null;

  const connectionOptions = definition.source.kind === 'connector'
    ? connections.filter((c) => c.connectorId === (definition.source as { connectorId: string }).connectorId && c.status === 'active').map((c) => ({ value: c.id, label: c.displayName }))
    : [];

  const save = () => {
    const eventNames = componentEvents(definition, config);
    const events = eventNames.map((event) => node.data.events.find((e) => e.name === event) ?? { name: event, outputs: [], next: [] });
    const data: NodeData = { ...node.data, name: name.trim() || node.data.name, description, config, events };
    const valid = new Set(eventNames.map((e) => `${nodeId}-${e}`));
    const keptEdges = edges.filter((e) => e.source !== nodeId || (e.sourceHandle && valid.has(e.sourceHandle)));
    updateNodes(nodes.map((n) => (n.id === nodeId ? { ...n, data } : n)));
    if (keptEdges.length !== edges.length) updateEdges(keptEdges);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" onDoubleClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{definition.title}</DialogTitle>
          <DialogDescription>{definition.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="step-name">Step name</Label>
              <Input id="step-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="step-id">Step id</Label>
              <Input id="step-id" value={nodeId} disabled />
              <p className="text-xs text-muted-foreground">outputs: steps.{nodeId}.…</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="step-description">Notes</Label>
            <Textarea id="step-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <ObjectFields schema={definition.configSchema} value={config} onChange={setConfig}
            context={{
              roles: roles.map((r) => r.id),
              options: { connection: connectionOptions, ...dynamicOptions },
              workflows: workflows.filter((w) => w.status === 'active').map((w) => ({ value: w.id, label: w.name })),
              forms: (Array.isArray(forms) ? forms : []).map((f) => ({ value: f.id, label: f.name })),
              choices: Array.isArray(subscriptions) && subscriptions.length ? { webhook: subscriptions.map((w) => ({ value: w.id, label: w.description ? `${w.description} (${w.url})` : w.url })) } : undefined,
            }} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
