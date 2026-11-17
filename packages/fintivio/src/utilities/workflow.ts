import type { Node, Edge } from 'reactflow';
import type { WorkflowSchema as Workflow, NodeData, WorkflowYaml, StepExportYaml, WorkflowTriggerSchema as WorkflowTrigger } from '../schemas/workflows.schema';
import yaml from 'yaml';
import { v4 as uuid } from 'uuid';
// Helper to find all steps that can be reached from a given step
function findReachableSteps(
  stepId: string,
  steps: WorkflowYaml['steps'],
  visited = new Set<string>()
): Set<string> {
  if (visited.has(stepId)) return visited;
  visited.add(stepId);

  const step = steps.find(s => s.id === stepId);
  if (!step) return visited;

  for (const event of step.events) {
    for (const nextId of event.next || []) {
      findReachableSteps(nextId, steps, visited);
    }
  }

  return visited;
}

// Helper to validate that exports only reference reachable steps
function validateExports(
  stepId: string,
  exports: StepExportYaml[],
  steps: WorkflowYaml['steps']
): boolean {
  const reachableSteps = findReachableSteps(stepId, steps);

  for (const exp of exports) {
    for (const output of exp.outputs) {
      if ('interpolation' in output) {
        // Parse the value to get the step ID (format: stepId.outputs.outputName)
        const stepId = String(output.value).split('.')[0];
        if (!reachableSteps.has(stepId)) {
          return false;
        }
      }
    }
  }

  return true;
}

export const INITIAL_START_NODE: Node<NodeData> = {
  id: 'start',
  type: 'start',
  position: { x: 100, y: 100 },
  data: {
    id: 'start',
    type: 'start',
    name: 'Start',
    description: 'Workflow entry point',
    events: [{
      name: 'started',
      outputs: [],
    }],
    config: {},
  },
};

// Helper to ensure start node exists
export function ensureStartNode(nodes: Node<NodeData>[]): Node<NodeData>[] {
  const hasStartNode = nodes.some(node => node.type === 'start');
  if (!hasStartNode) {
    return [INITIAL_START_NODE, ...nodes];
  }
  return nodes;
}

export function workflowToYaml(workflow: Workflow, nodes: Node<NodeData>[], edges: Edge[], triggers: WorkflowTrigger[]): string {
  const schema: WorkflowYaml = {
    id: workflow.id || uuid(),
    schemaVersion: '1.0',
    name: workflow.name,
    description: workflow.description,
    version: workflow.version,
    allowedRoles: workflow.allowedRoles,
    allowedUsers: workflow.allowedUsers,
    inputs: workflow.inputs || [],
    ...(workflow.startOn?.length ? { startOn: workflow.startOn } : {}),
    ...(workflow.caseTitle ? { caseTitle: workflow.caseTitle } : {}),
    ...(workflow.clientVisibility ? { clientVisibility: workflow.clientVisibility } : {}),
    ...(workflow.stages?.length ? { stages: workflow.stages } : {}),
    ...(workflow.function ? { function: true } : {}),
    ...(workflow.outputs && Object.keys(workflow.outputs).length ? { outputs: workflow.outputs } : {}),

    // Convert triggers
    triggers: triggers,

    // Convert nodes to steps
    steps: nodes.map(node => {
      const nodeData = node.data;

      return {
        id: nodeData.id,
        name: nodeData.name,
        type: nodeData.type,
        description: nodeData.description,
        config: nodeData.config,
        // Event targets come from the edges leaving this event's handle (`<step>-<event>`); node data is the fallback.
        events: nodeData.events.map(e => {
          const fromEdges = edges.filter(edge => edge.source === nodeData.id && edge.sourceHandle === `${nodeData.id}-${e.name}`).map(edge => edge.target);
          return { ...e, next: fromEdges.length || !e.next ? fromEdges : e.next };
        }),
        isTerminal: nodeData.isTerminal,
        exports: nodeData.exports,
        // Editor layout (ignored by the engine).
        ui: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      };
    }),
  };

  return yaml.stringify(schema);
}

/**
 * recursively organize children of a node relative to itself, it will place the children to the right of itself, one children above the other
 * @param startNode 
 * @param edges 
 */
function autoOrganizeNodes(startNode: Node<NodeData>, nodes: Node<NodeData>[], edges: Edge[], visited: Set<string> = new Set()) {
  if (visited.has(startNode.id)) return;
  visited.add(startNode.id);
  const Offset = 80;
  const SquareWidth = 320;
  const SquareHeight = 190;
  const children = edges.filter(edge => edge.source === startNode.id).map(edge => edge.target);
  const childrenXCoord = startNode.position.x + SquareWidth + Offset;
  const startingChildrenYCoord = startNode.position.y;

  children.forEach((childId, index) => {
    const child = nodes.find(node => node.id === childId);
    if (!child) return;

    child.position = {
      x: childrenXCoord,
      y: startingChildrenYCoord + (index * SquareHeight) + (index === 0 ? 0 : Offset)
    };

    autoOrganizeNodes(child, nodes, edges, visited);
  });
}

const positionOf = (step: unknown, index: number) => {
  const ui = (step as { ui?: { x?: number; y?: number } }).ui;
  return ui && typeof ui.x === 'number' && typeof ui.y === 'number' ? { x: ui.x, y: ui.y } : { x: 0, y: index * 160 };
};

export function yamlToWorkflow(yamlContent: string, options: { id?: string } = {}): {
  workflow: Workflow;
  nodes: Node<NodeData>[];
  edges: Edge[];
  triggers: WorkflowTrigger[];
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
} {

  const schema = yaml.parse(yamlContent) as WorkflowYaml;

  // Convert to workflow
  const workflow: Workflow = {
    id: options.id || schema.id || uuid(), // This should be generated or preserved
    name: schema.name,
    description: schema.description,
    version: schema.version,
    allowedRoles: schema.allowedRoles,
    allowedUsers: schema.allowedUsers,
    inputs: schema.inputs || [],
    startOn: schema.startOn,
    caseTitle: schema.caseTitle,
    clientVisibility: schema.clientVisibility,
    stages: schema.stages,
    function: schema.function,
    outputs: schema.outputs,
  };

  // Convert to triggers
  const triggers: WorkflowTrigger[] = schema.triggers ?? [];

  // Convert steps to nodes and edges
  const nodes: Node<NodeData>[] = ensureStartNode(schema.steps.map((step, index) => {
    // Special handling for start node to sync with workflow inputs
    if (step.type === 'start') {
      return {
        id: step.id,
        type: step.type,
        position: positionOf(step, index),
        data: {
          id: step.id,
          type: step.type,
          name: step.name,
          description: step.description || '',
          inputs: [],
          events: [{
            // Keep the step's own event name (templates use `finished`), so edges keep matching their handle.
            name: step.events[0]?.name ?? 'finished',
            outputs: (schema.inputs ?? []).map(input => ({
              name: input.name,
              type: input.type,
              description: input.description,
            })),
            next: step.events[0]?.next || [],
          }],
          config: step.config,
        },
      };
    }

    // Regular node handling
    return {
      id: step.id,
      type: step.type,
      position: positionOf(step, index),
      data: {
        id: step.id,
        type: step.type,
        name: step.name,
        description: step.description || '',
        inputs: [],
        events: step.events,
        config: step.config,
        isTerminal: step.isTerminal,
        exports: step.exports,
      },
    };
  }));

  // Create edges from event connections
  const edges: Edge[] = schema.steps.flatMap(step =>
    (step.events ?? []).flatMap(event =>
      (event.next || []).map(targetId => ({
        id: `${step.id}-${event.name}-${targetId}`,
        source: step.id,
        target: targetId,
        sourceHandle: `${step.id}-${event.name}`,
        targetHandle: 'input',
      }))
    )
  );

  // Saved positions win; workflows without them (templates, hand-written YAML) are laid out automatically.
  const startNode = nodes.find(node => node.type === 'start');
  const hasLayout = schema.steps.some((step) => (step as { ui?: unknown }).ui);
  if (!hasLayout && startNode) autoOrganizeNodes(startNode, nodes, edges);

  return {
    workflow,
    nodes,
    edges,
    triggers,
    isDirty: false,
    isSaving: false,
    isLoading: false,
  };
}

// Helper function to validate a YAML string against our schema
export function validateWorkflowYaml(yamlContent: string): boolean {
  try {

    const schema = yaml.parse(yamlContent) as WorkflowYaml;

    // Basic validation
    // `version` is legacy (versions are numbered at publication): optional.
    if (!schema.name || !Array.isArray(schema.steps)) {
      return false;
    }

    // Validate inputs
    if (schema.inputs !== undefined && !Array.isArray(schema.inputs)) {
      return false;
    }

    for (const input of schema.inputs ?? []) {
      if (!input.id || !input.name || !input.type) {
        return false;
      }
    }

    // Validate steps
    for (const step of schema.steps) {
      if (!step.id || !step.name || !step.type) {
        return false;
      }

      // Validate events reference existing steps
      for (const event of step.events ?? []) {
        if (!Array.isArray(event.next)) {
          return false;
        }
        // Check that all referenced next steps exist
        for (const nextId of event.next) {
          if (!schema.steps.find(s => s.id === nextId)) {
            return false;
          }
        }
      }

      // Validate exports for terminal nodes
      if (step.isTerminal && step.exports) {
        // Validate that exports only reference reachable steps
        if (!validateExports(step.id, step.exports, schema.steps)) {
          return false;
        }

        // Validate that all events referenced in exports exist in the step
        for (const exp of step.exports) {
          const event = step.events.find(e => e.name === exp.event);
          if (!event) {
            return false;
          }

          // Validate that output names and types match the event's outputs
          for (const output of exp.outputs) {
            const eventOutput = event.outputs.find(o => o.name === output.name);
            if (!eventOutput || eventOutput.type !== output.type) {
              return false;
            }
          }
        }
      }
    }

    return true;
  } catch {
    return false;
  }
} 