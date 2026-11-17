'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  Connection,
  ReactFlowInstance,
  Edge,
  applyEdgeChanges,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Save, FileEdit, Play, LayoutGrid, ShieldCheck, Rocket, Settings2, SquareFunction } from 'lucide-react';
import { toast } from 'sonner';
import { CatalogContext, useComponentCatalog } from './catalog/catalog';
import { ComponentNode, UnknownNode } from './catalog/ComponentNode';
import { Palette } from './catalog/Palette';
import { autoLayout } from './catalog/layout';
import { apiErrorDetails, apiErrorMessage, useApiMutation } from '@/lib/services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WorkflowProvider, useWorkflow } from './WorkflowContext';
import { RunWorkflowDialog } from './RunWorkflowDialog';
import { YamlActions } from './yaml/YamlActions';
import { WorkflowSettingsDialog } from './WorkflowSettingsDialog';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { NodeData } from '@repo/fintivio/schemas';


function WorkflowEditorContent({ workflowId }: { workflowId?: string }) {
  const {
    yaml,
    workflow,
    nodes,
    edges,
    isDirty,
    isSaving,
    updateNodes,
    updateEdges,
    saveWorkflow,
    onNodesChange,
    onEdgesChange,
    updateWorkflow,
  } = useWorkflow();

  const { data: catalogList = [] } = useComponentCatalog();
  const catalog = useMemo(() => new Map(catalogList.map((c) => [c.type, c])), [catalogList]);
  const catalogKey = catalogList.map((c) => c.type).join('|');
  // React Flow wants a stable nodeTypes object: rebuild only when the set of component types changes.
  const nodeTypes = useMemo(() => ({
    ...Object.fromEntries(catalogList.map((c) => [c.type, ComponentNode])),
    unknown: UnknownNode,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [catalogKey]);
  const displayedNodes = useMemo(() => (catalogList.length
    ? nodes.map((n) => (n.type && n.type in nodeTypes ? n : { ...n, type: 'unknown' }))
    : []), [nodes, nodeTypes, catalogList.length]);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const validate = useApiMutation<void, { errors: string[] }>(({ axios, url }) => axios.get(url(`/workflows/${workflowId}/validation`)));
  const publish = useApiMutation<void, { version: number }>(({ axios, url }) => axios.post(url(`/workflows/${workflowId}/publish`)), [['workflows']]);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fitted = useRef(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  // Opened from the experience map on a step (`?step=`): show it.
  const stepParam = new URLSearchParams(window.location.search).get('step');
  useEffect(() => {
    if (!reactFlowInstance || !stepParam) return;
    const node = reactFlowInstance.getNode(stepParam);
    if (node) setTimeout(() => reactFlowInstance.setCenter(node.position.x + (node.width ?? 280) / 2, node.position.y + (node.height ?? 140) / 2, { zoom: 1, duration: 400 }), 200);
  }, [reactFlowInstance, stepParam]);
  const { theme } = useTheme();
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);

  // Validate if two nodes can be connected
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode) return false;
    if (targetNode.type === 'start') return false;

    return true;
  }, [nodes]);

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isValidConnection(connection)) {
        const newEdge = { ...connection, id: `${connection.sourceHandle ?? connection.source}-${connection.target}` };
        updateEdges([...edges, newEdge as Edge]);
      }
    },
    [isValidConnection, edges, updateEdges]
  );

  // Create a new node from drag and drop
  const createNode = useCallback(
    (nodeData: NodeData, position: { x: number; y: number }) => {
      const newNode = {
        id: nodeData.id,
        type: nodeData.type,
        position,
        data: nodeData,
      };

      updateNodes([...nodes, newNode]);
    },
    [nodes, updateNodes]
  );

  // Handle node drag and drop
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const dataString = event.dataTransfer.getData('application/reactflow');

      if (!bounds || !reactFlowInstance || !dataString) return;

      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const nodeData = JSON.parse(dataString) as NodeData;
      createNode(nodeData, position);
    },
    [reactFlowInstance, createNode]
  );

  // Fit the graph once the catalogue (and so the nodes) are rendered.
  void useEffect; void fitted;

  /** Add a step next to the selected step (or below the last one), from the palette. */
  const addStep = useCallback((data: NodeData) => {
    const anchor = nodes.find((n) => n.selected) ?? nodes[nodes.length - 1];
    const position = anchor ? { x: anchor.position.x + 380, y: anchor.position.y } : { x: 100, y: 100 };
    createNode(data, position);
  }, [nodes, createNode]);

  /** Deletions and finished drags change the YAML (steps removed, positions saved). */
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    const structural = changes.some((c) => c.type === 'remove' || (c.type === 'position' && c.dragging === false));
    if (!structural) return;
    const next = applyNodeChanges(changes, nodes);
    const removed = new Set(changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id));
    if (removed.size) updateEdges(edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)));
    updateNodes(next);
  }, [onNodesChange, nodes, edges, updateNodes, updateEdges]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some((c) => c.type === 'remove')) updateEdges(applyEdgeChanges(changes, edges));
    else onEdgesChange(changes);
  }, [onEdgesChange, updateEdges, edges]);

  const tidyUp = useCallback(async () => {
    updateNodes(await autoLayout(nodes, edges));
    setTimeout(() => reactFlowInstance?.fitView({ padding: 0.2 }), 50);
  }, [nodes, edges, updateNodes, reactFlowInstance]);

  const runValidation = useCallback(async () => {
    if (isDirty) await saveWorkflow();
    try {
      setValidationErrors((await validate.mutateAsync()).errors);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }, [isDirty, saveWorkflow, validate]);

  const runPublish = useCallback(async () => {
    try {
      const result = await publish.mutateAsync();
      setValidationErrors(null);
      toast.success(`Published as version ${result.version}`);
    } catch (error) {
      const details = apiErrorDetails(error);
      if (details.length) setValidationErrors(details);
      else toast.error(apiErrorMessage(error));
    }
  }, [publish]);

  // Handle workflow save
  const handleSave = useCallback(async () => {
    if (!reactFlowInstance) return;
    await saveWorkflow();
  }, [reactFlowInstance, saveWorkflow]);

  const handleDescriptionSave = useCallback(() => {
    // Update description in YAML
    updateWorkflow(w => ({ ...w, description: tempDescription }));
    setIsEditingDescription(false);
  }, [updateWorkflow, tempDescription]);

  // "Run": start a case on the published version with the given inputs (the case engine; drafts cannot run).
  const startCase = useApiMutation<Record<string, unknown>, { caseId: string; reference: string }>(({ axios, url }, inputs) => axios.post(url(`/workflows/${workflowId ?? workflow.id}/executions`), { inputs }));
  const handleRunWorkflow = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const started = await startCase.mutateAsync((payload.inputs ?? payload.variables ?? payload) as Record<string, unknown>);
      toast.success(`Case ${started.reference} started`);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  }, [startCase]);

  return (
    <CatalogContext.Provider value={catalog}>
    <div className="flex h-full w-full">
      {/* Component palette (catalogue) */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r bg-canvas/70 p-3">
        <Palette components={catalogList} onAdd={addStep} />
      </aside>
      {/* Main Editor Area */}
      <div className="flex-1 min-w-0 flex flex-col">
            {/* Workflow Header */}
            <div className="border-b bg-background">
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Input
                      value={workflow.name}
                      onChange={(e) => {
                        updateWorkflow(w => ({ ...w, name: e.target.value }));
                      }}
                      className="text-lg font-semibold h-9 w-[300px]"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTempDescription(workflow.description);
                        setIsEditingDescription(true);
                      }}
                      className="gap-2"
                    >
                      <FileEdit className="h-4 w-4" />
                      Edit Description
                    </Button>
                  </div>
                  {workflow.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {workflow.description}
                    </p>
                  )}
                  {(workflow.function || !!workflow.stages?.length) && (
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="wf-summary">
                      {workflow.function && <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 font-medium text-teal-700 dark:text-teal-300"><SquareFunction className="h-3 w-3" />Function</span>}
                      {!!workflow.stages?.length && <span>Stages: {workflow.stages.map((s) => s.label).join(' → ')}</span>}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" title="Workflow settings" aria-label="Workflow settings" onClick={() => setIsSettingsOpen(true)} data-testid="wf-settings">
                    <Settings2 className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" title="Tidy up the layout" aria-label="Tidy up the layout" onClick={tidyUp}>
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  {workflowId && (
                    <Button variant="outline" size="sm" onClick={runValidation} disabled={validate.isPending}>
                      <ShieldCheck className="mr-1 h-4 w-4" />Validate
                    </Button>
                  )}
                  {workflowId && (
                    <Button size="sm" onClick={runPublish} disabled={publish.isPending || isDirty}
                      title={isDirty ? 'Save first' : 'Publish the saved draft as a new version'}>
                      <Rocket className="mr-1 h-4 w-4" />Publish
                    </Button>
                  )}
                  <YamlActions />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsRunDialogOpen(true)}
                    title="Run Workflow"
                    disabled={!workflow.id}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleSave}
                    title="Save Workflow"
                    disabled={!isDirty || isSaving}
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

        <div ref={reactFlowWrapper} className="flex-1 min-h-0 w-full">
          {!catalogList.length ? <div className="p-6 text-sm text-muted-foreground">Loading components…</div> : (
          <ReactFlow
            nodes={displayedNodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onInit={setReactFlowInstance}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            nodeTypes={nodeTypes}
            className={theme === 'dark' ? 'react-flow-dark' : ''}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            minZoom={0.2}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            {/* Validation results */}
            {validationErrors && (
              <Panel position="bottom-center" className="max-w-2xl">
                <div className={`rounded-xl border p-3.5 text-sm shadow-overlay ${validationErrors.length ? 'border-destructive/30 bg-card text-destructive' : 'border-success/30 bg-card text-success'}`} data-testid="validation-result">
                  <div className="flex items-center justify-between gap-4">
                    <strong>{validationErrors.length ? `${validationErrors.length} problem(s) prevent publishing` : 'Ready to publish: no problems found'}</strong>
                    <button className="text-xs underline" onClick={() => setValidationErrors(null)}>close</button>
                  </div>
                  {validationErrors.length > 0 && <ul className="mt-2 list-disc pl-5">{validationErrors.map((e) => <li key={e}>{e}</li>)}</ul>}
                </div>
              </Panel>
            )}

            {/* ReactFlow UI Components */}
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="!rounded-xl !border !bg-card !shadow-raised" maskColor={theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(16,24,40,0.05)'} nodeColor={theme === 'dark' ? '#4b3fa8' : '#cfc8ff'} nodeBorderRadius={6} />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color={theme === 'dark' ? '#2c3149' : '#c5cadb'} />
          </ReactFlow>
          )}
        </div>
      </div>

      {/* Description Edit Dialog */}
      <Dialog open={isEditingDescription} onOpenChange={setIsEditingDescription}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workflow Description</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={tempDescription}
                onChange={(e) => setTempDescription(e.target.value)}
                placeholder="Enter a description for your workflow..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingDescription(false)}>
              Cancel
            </Button>
            <Button onClick={handleDescriptionSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkflowSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} workflow={workflow}
        onSave={(settings) => updateWorkflow((w) => ({ ...w, ...settings }))} />

      {/* Run Workflow Dialog */}
      {workflow.id && yaml && <RunWorkflowDialog
        open={isRunDialogOpen}
        onOpenChange={setIsRunDialogOpen}
        workflowId={workflow.id}
        onRun={handleRunWorkflow}
        yaml={yaml}
      />}
    </div>
    </CatalogContext.Provider>
  );
}

export type WorkflowEditorProps = {
  workflowId?: string;
  initialYaml?: string;
  onSave?: (yaml: string) => Promise<void>;
  onChange?: (yaml: string) => void;
}

export default function WorkflowEditor({
  workflowId,
  initialYaml,
  onSave,
  onChange,
}: WorkflowEditorProps) {
  return (
    <WorkflowProvider
      initialYaml={initialYaml}
      onSave={onSave}
      onChange={onChange}
    >
      <WorkflowEditorContent workflowId={workflowId} />
    </WorkflowProvider>
  );
} 