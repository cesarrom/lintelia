'use client';

import { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  Connection,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Save, Zap, FileEdit, Play } from 'lucide-react';
import { databaseNode, decisionTableNode, formNode, emailNode, workflowNode, startNode, endNode, conditionalNode, iteratorNode, mapperNode } from '@/components/workflow/nodes';
import { useTheme } from 'next-themes';
import { NodeData } from './nodes/types';
import { proofOfLifeNode } from './nodes/proof-of-life';
import { identityValidationNode } from './nodes/identity-validation';
import { documentExtractorNode } from './nodes/document-extractor';
import { wizardNode } from './nodes/wizard';
import { schedulerNode } from './nodes/scheduler';
import { TriggersSidebar } from "./triggers/TriggersSidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { WorkflowProvider, useWorkflow } from './WorkflowContext';
import { RunWorkflowDialog } from './RunWorkflowDialog';
import { YamlActions } from './yaml/YamlActions';
import { yamlToWorkflow } from './yaml/converter';

// Available node types and their definitions
const nodeDefinitions = {
  start: startNode,
  end: endNode,
  database: databaseNode,
  'decisionTable': decisionTableNode,
  form: formNode,
  email: emailNode,
  workflow: workflowNode,
  conditional: conditionalNode,
  iterator: iteratorNode,
  mapper: mapperNode,
  proofOfLife: proofOfLifeNode,
  identityValidation: identityValidationNode,
  documentExtractor: documentExtractorNode,
  wizard: wizardNode,
  scheduler: schedulerNode,
} as const;

// Map node types to their React components for ReactFlow
const nodeTypes = Object.fromEntries(
  Object.entries(nodeDefinitions).map(([type, def]) => [type, def.node])
);

function WorkflowEditorContent() {
  const {
    yaml,
    workflow,
    nodes,
    edges,
    triggers,
    isDirty,
    isSaving,
    updateNodes,
    updateEdges,
    updateTriggers,
    saveWorkflow,
    onNodesChange,
    onEdgesChange,
    updateWorkflow,
  } = useWorkflow();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const { theme } = useTheme();
  const [triggersSidebarOpen, setTriggersSidebarOpen] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState('');
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
        const newEdge = { ...connection, id: `${connection.source}-${connection.target}` };
        updateEdges([...edges, newEdge]);
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

  const handleRunWorkflow = useCallback(async (payload: Record<string, unknown>) => {
    try {
      const data = yamlToWorkflow(yaml);
      const response = await fetch(`/api/workflows/${data.workflow.id}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to run workflow');
      }
    } catch (error) {
      console.error('Error running workflow:', error);
      throw error;
    }
  }, [yaml]);

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Main Editor Area */}
      <div className="flex-1">
        <div ref={reactFlowWrapper} className="h-full w-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
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
            nodesDraggable
            nodesConnectable
            elementsSelectable
            proOptions={{ hideAttribution: true }}
          >
            {/* Workflow Header */}
            <Panel position="top-center" className="border-b backdrop-blur">
              <div className="flex items-center justify-between px-4 py-4">
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
                </div>
                <div className="flex items-center gap-2">
                  <YamlActions />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setTriggersSidebarOpen(true)}
                    title="Manage Triggers"
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
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
            </Panel>

            {/* Node Toolbar */}
            <Panel position="top-left" className="flex gap-2">
              <div className="flex flex-col gap-2 bg-background/95 p-4 rounded-lg shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
                {Object.entries(nodeDefinitions)
                  .filter(([type]) => !['start', 'end'].includes(type))
                  .map(([type, def]) => {
                    const Button = def.toolbar;
                    return (
                      <Button
                        key={type}
                      />
                    );
                  })}
              </div>
            </Panel>

            {/* ReactFlow UI Components */}
            <Controls />
            <MiniMap />
            <Background />
          </ReactFlow>
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

      <TriggersSidebar
        open={triggersSidebarOpen}
        onOpenChange={setTriggersSidebarOpen}
        triggers={triggers}
        onTriggersChange={updateTriggers}
      />

      {/* Run Workflow Dialog */}
      <RunWorkflowDialog
        open={isRunDialogOpen}
        onOpenChange={setIsRunDialogOpen}
        workflowId={workflow.id}
        onRun={handleRunWorkflow}
      />
    </div>
  );
}

export type WorkflowEditorProps = {
  initialYaml?: string;
  onSave?: (yaml: string) => Promise<void>;
  onChange?: (yaml: string) => void;
}

export default function WorkflowEditor({
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
      <WorkflowEditorContent />
    </WorkflowProvider>
  );
} 