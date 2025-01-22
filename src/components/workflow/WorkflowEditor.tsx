'use client';

import { useCallback, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowInstance,
  Node,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Save, Upload } from 'lucide-react';
import { databaseNode, decisionTableNode, formNode, emailNode, workflowNode, startNode, endNode, conditionalNode, iteratorNode, mapperNode } from '@/components/workflow/nodes';
import { useTheme } from 'next-themes';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NodeData } from './nodes/types';
import { proofOfLifeNode } from './nodes/proof-of-life';
import { identityValidationNode } from './nodes/identity-validation';
import { documentExtractorNode } from './nodes/document-extractor';
import { wizardNode } from './nodes/wizard';
import { schedulerNode } from './nodes/scheduler';



// Available node types and their definitions
const nodeDefinitions = {
  start: startNode,
  end: endNode,
  database: databaseNode,
  'decision-table': decisionTableNode,
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

// Initial start node position
const INITIAL_START_NODE: Node<NodeData> = {
  id: 'start',
  type: 'start',
  position: { x: 100, y: 100 },
  data: {
    id: 'start',
    type: 'start',
    name: 'Start',
    description: 'Workflow entry point',
    inputs: [],
    events: [],
    config: startNode.initialConfig,
  },
};

// Initial end node position
const INITIAL_END_NODE: Node<NodeData> = {
  id: 'end',
  type: 'end',
  position: { x: 600, y: 100 },
  data: {
    id: 'end',
    type: 'end',
    name: 'End',
    description: 'Workflow endpoint',
    inputs: [],
    events: [],
    config: endNode.initialConfig,
  },
};

export default function WorkflowEditor() {
  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([INITIAL_START_NODE, INITIAL_END_NODE]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Validate if two nodes can be connected
  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    // Both nodes must exist
    if (!sourceNode || !targetNode) return false;

    // Start node can only be a source
    if (targetNode.type === 'start') return false;

    // End node can only be a target
    if (sourceNode.type === 'end') return false;

    return true;
  }, [nodes]);

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isValidConnection(connection)) {
        setEdges((eds) => addEdge(connection, eds));
      }
    },
    [isValidConnection, setEdges]
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

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  // Handle node drag and drop
  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const dataString = event.dataTransfer.getData('application/reactflow');

      if (!bounds || !reactFlowInstance || !dataString) return;

      // Get drop position relative to the canvas
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      // Create the node
      const nodeData = JSON.parse(dataString) as NodeData;
      createNode(nodeData, position);
    },
    [reactFlowInstance, createNode]
  );

  // Handle workflow save
  const handleSave = useCallback(() => {
    if (!reactFlowInstance) return;

    const flow = reactFlowInstance.toObject();
    const json = JSON.stringify(flow, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'workflow.json';
    link.click();
  }, [reactFlowInstance]);

  // Handle workflow load
  const handleLoad = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !reactFlowInstance) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const flow = JSON.parse(e.target?.result as string);
        const { x = 0, y = 0, zoom = 1 } = flow.viewport;

        // Ensure the start and end nodes are always present
        const hasStartNode = flow.nodes.some((node: Node<NodeData>) => node.type === 'start');
        const hasEndNode = flow.nodes.some((node: Node<NodeData>) => node.type === 'end');
        let nodesToSet = flow.nodes;

        if (!hasStartNode) {
          nodesToSet = [INITIAL_START_NODE, ...nodesToSet];
        }
        if (!hasEndNode) {
          nodesToSet = [...nodesToSet, INITIAL_END_NODE];
        }

        setNodes(nodesToSet || [INITIAL_START_NODE, INITIAL_END_NODE]);
        setEdges(flow.edges || []);
        reactFlowInstance.setViewport({ x, y, zoom });
      } catch (error) {
        console.error('Error loading workflow:', error);
      }
    };
    reader.readAsText(file);
  }, [reactFlowInstance, setNodes, setEdges]);

  return (
    <div className="h-screen w-full">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
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
          {/* Node Toolbar */}
          <Panel position="top-left" className="flex gap-2">
            <div className="flex flex-col gap-2 bg-background/95 p-4 rounded-lg shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/60">
              {Object.entries(nodeDefinitions)
                .filter(([type]) => !['start', 'end'].includes(type)) // Exclude start and end nodes from toolbar
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

          {/* Save/Load Buttons */}
          <Panel position="top-right" className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleSave}
              title="Save Workflow"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => document.getElementById('load-workflow')?.click()}
              title="Load Workflow"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <input
              id="load-workflow"
              type="file"
              accept=".json"
              onChange={handleLoad}
              className="hidden"
            />
          </Panel>

          {/* ReactFlow UI Components */}
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
} 