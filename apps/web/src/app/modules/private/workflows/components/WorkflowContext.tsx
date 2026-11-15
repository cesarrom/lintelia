import { createContext, useContext, useState, useCallback, ReactNode, useRef, useMemo } from 'react';
import { Node, Edge, useNodesState, useEdgesState, useNodeId, NodeProps } from 'reactflow';
import { NodeData, TriggerDefinition, WorkflowYaml as Workflow, WorkflowSchema } from '@repo/fintivio/schemas';
import React from 'react';
import { ensureStartNode, validateWorkflowYaml, workflowToYaml, yamlToWorkflow } from '@repo/fintivio/utilities';

// Initial start node position
export interface WorkflowState {
  yaml: string;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  workflow: Workflow;
  // Internal state (derived from yaml)
  nodes: Node<NodeData>[];
  edges: Edge[];
  triggers: TriggerDefinition[];
  toolbarComponents: ToolbarComponent[];
  nodeComponents: NodeComponent[];
  workflowComponents: Record<string, WorkflowComponentType>;
}

export type ToolbarComponent = React.ReactElement;
export type NodeComponent = React.ComponentType<NodeProps<NodeData>>;
export type WorkflowComponentType = Omit<NodeData, 'execute' | 'config' | 'isTerminal' | 'exports'>

interface WorkflowContextType extends WorkflowState {
  registerComponent: (component: WorkflowComponentType) => void;
  registerToolbar: (component: ToolbarComponent) => void;
  registerNode: (component: NodeComponent) => void;
  // Node and edge methods (internal)
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  updateNodes: (nodes: Node<NodeData>[]) => void;
  updateEdges: (edges: Edge[]) => void;
  updateTriggers: (triggers: TriggerDefinition[]) => void;
  updateWorkflow: (workflow: Workflow | ((workflow: Workflow) => Workflow)) => void;

  // YAML methods (public API)
  setYaml: (yaml: string) => void;
  validateYaml: (yaml: string) => boolean;

  // State management methods
  markAsClean: () => void;
  markAsDirty: () => void;

  // Save and load methods
  saveWorkflow: () => Promise<void>;
  loadWorkflow: (yaml: string) => void;
  beforeSave: (callback: () => Promise<void> | void) => () => void;
  afterSave: (callback: () => Promise<void> | void) => () => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

interface WorkflowProviderProps {
  children: ReactNode;
  initialYaml?: string;
  onSave?: (yaml: string) => Promise<void>;
  onChange?: (yaml: string) => void;
}

export function WorkflowProvider({
  children,
  initialYaml = '',
  onSave,
  onChange,
}: WorkflowProviderProps) {
  // Parse initial YAML to get internal state
  const initialState = initialYaml ? yamlToWorkflow(initialYaml) : {
    workflow: { id: '', name: 'Untitled Workflow', description: '', version: 1, inputs: [], schemaVersion: '1.0', triggers: [], steps: [] } as Workflow,
    nodes: [],
    edges: [],
    triggers: [],
    isDirty: false,
    isSaving: false,
    isLoading: false,
  };

  // Ensure start node exists in initial state
  initialState.nodes = ensureStartNode(initialState.nodes);

  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(initialState.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges);
  const [state, setState] = useState({
    yaml: initialYaml,
    workflow: initialState.workflow,
    triggers: initialState.triggers,
    isDirty: false,
    isSaving: false,
    isLoading: false,
    toolbarComponents: [] as ToolbarComponent[],
    nodeComponents: [] as NodeComponent[],
    workflowComponents: {} as Record<string, WorkflowComponentType>,
  });

  const registerToolbar = (component: ToolbarComponent) => {
    setState(prev => ({ ...prev, toolbarComponents: [...prev.toolbarComponents, component] }));
  };

  const registerNode = (component: NodeComponent) => {
    setState(prev => ({ ...prev, nodeComponents: [...prev.nodeComponents, component] }));
  };

  const registerComponent = (component: WorkflowComponentType) => {
    setState(prev => ({ ...prev, workflowComponents: { ...prev.workflowComponents, [component.id]: component } }));
  };

  const beforeSaveCallbacks = useRef<(() => Promise<void> | void)[]>([]);
  const afterSaveCallbacks = useRef<(() => Promise<void> | void)[]>([]);

  // Notify parent component of changes
  const notifyChange = useCallback((yaml: string) => {
    onChange?.(yaml);
  }, [onChange]);

  const setYaml = useCallback((yaml: string) => {
    if (!validateWorkflowYaml(yaml)) {
      throw new Error('Invalid YAML');
    }

    const { nodes: newNodes, edges: newEdges, triggers: newTriggers, workflow: newWorkflow } = yamlToWorkflow(yaml);

    // Ensure start node exists when loading new YAML
    const nodesWithStart = ensureStartNode(newNodes);

    setNodes(nodesWithStart);
    setEdges(newEdges);
    setState(prev => {
      // If we added a start node, we need to regenerate the YAML
      const finalYaml = nodesWithStart.length !== newNodes.length
        ? workflowToYaml(newWorkflow, nodesWithStart, newEdges, newTriggers)
        : yaml;

      const newState = {
        ...prev,
        yaml: finalYaml,
        workflow: newWorkflow,
        triggers: newTriggers,
        isDirty: true
      };
      notifyChange(finalYaml);
      return newState;
    });
  }, [setNodes, setEdges, notifyChange]);

  // Node and edge methods
  const updateNodes = useCallback((newNodes: Node<NodeData>[]) => {
    // Ensure start node exists when updating nodes
    const nodesWithStart = ensureStartNode(newNodes);
    setNodes(nodesWithStart);
    setState(prev => {
      const newYaml = workflowToYaml(prev.workflow as WorkflowSchema, nodesWithStart, edges, prev.triggers);
      notifyChange(newYaml);
      return { ...prev, yaml: newYaml, isDirty: true };
    });
  }, [setNodes, edges, notifyChange]);

  const updateWorkflow = useCallback((newWorkflow: Workflow | ((workflow: Workflow) => Workflow)) => {
    setState(prev => {
      const nw = typeof newWorkflow === 'function' ? (newWorkflow as (w: Workflow) => Workflow)(prev.workflow as Workflow) : newWorkflow;
      const newYaml = workflowToYaml(nw as WorkflowSchema, nodes, edges, prev.triggers);
      notifyChange(newYaml);
      return { ...prev, yaml: newYaml, isDirty: true, workflow: nw };
    });
  }, [nodes, edges, notifyChange]);

  const updateEdges = useCallback((newEdges: Edge[]) => {
    const newNodes = nodes.map(node => {
      const newNode = node;

      newNode.data.events = node.data.events.map(event => {
        return {
          ...event,
          next: newEdges.filter(edge => edge.source === node.id && edge.sourceHandle?.includes('-' + event.name)).map(edge => edge.target)
        }
      });

      return newNode;
    });
    setEdges(newEdges);
    setState(prev => {
      const newYaml = workflowToYaml(prev.workflow as WorkflowSchema, newNodes, newEdges, prev.triggers);
      notifyChange(newYaml);
      return { ...prev, yaml: newYaml, isDirty: true };
    });
    updateNodes(newNodes);
  }, [setEdges, nodes, notifyChange, updateNodes]);

  const updateTriggers = useCallback((newTriggers: TriggerDefinition[]) => {
    setState(prev => {
      const newYaml = workflowToYaml(yamlToWorkflow(prev.yaml).workflow, nodes, edges, newTriggers);
      notifyChange(newYaml);
      return { ...prev, yaml: newYaml, triggers: newTriggers, isDirty: true };
    });
  }, [nodes, edges, notifyChange]);

  // State management methods
  const markAsClean = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: false }));
  }, []);

  const markAsDirty = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: true }));
  }, []);

  // Save and load methods
  const saveWorkflow = useCallback(async () => {
    setState(prev => ({ ...prev, isSaving: true }));
    try {
      // Execute all beforeSave callbacks
      await Promise.all(beforeSaveCallbacks.current.map(cb => cb()));

      await onSave?.(state.yaml);

      // Execute all afterSave callbacks
      await Promise.all(afterSaveCallbacks.current.map(cb => cb()));

      setState(prev => ({ ...prev, isDirty: false }));
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [state.yaml, onSave]);

  const loadWorkflow = useCallback((yaml: string) => {
    if (!validateWorkflowYaml(yaml)) {
      throw new Error('Invalid YAML');
    }

    const { nodes: newNodes, edges: newEdges, triggers: newTriggers } = yamlToWorkflow(yaml);
    setNodes(newNodes);
    setEdges(newEdges);
    setState(prev => ({ ...prev, yaml, triggers: newTriggers, isDirty: false }));
  }, [setNodes, setEdges]);

  const beforeSave = useCallback((callback: () => Promise<void> | void) => {
    beforeSaveCallbacks.current.push(callback);
    return () => {
      beforeSaveCallbacks.current = beforeSaveCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const afterSave = useCallback((callback: () => Promise<void> | void) => {
    afterSaveCallbacks.current.push(callback);
    return () => {
      afterSaveCallbacks.current = afterSaveCallbacks.current.filter(cb => cb !== callback);
    };
  }, []);

  const validateYaml = useCallback((yaml: string) => {
    return validateWorkflowYaml(yaml);
  }, []);


  const value: WorkflowContextType = {
    ...state,
    nodes,
    edges,
    registerComponent,
    registerToolbar,
    registerNode,
    updateWorkflow,
    onNodesChange,
    onEdgesChange,
    updateNodes,
    updateEdges,
    updateTriggers,
    setYaml,
    validateYaml,
    markAsClean,
    markAsDirty,
    saveWorkflow,
    loadWorkflow,
    beforeSave,
    afterSave,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider');
  }
  return context;
}

export function useNode<T extends NodeData>() {
  const nodeId = useNodeId();
  const { nodes, updateNodes } = useWorkflow();

  const node = nodes.find(n => n.id === nodeId) as Node<T> | undefined;

  const setNode = useCallback((newNode: Node<T> | ((node: Node<T>) => Node<T>)) => {
    updateNodes(nodes.map(n => {
      if (n.id === nodeId) {
        const nn = typeof newNode === 'function' ? (newNode as (n: Node<T>) => Node<T>)(n as Node<T>) : newNode;
        return nn;
      }
      return n;
    }));
  }, [updateNodes, nodeId, nodes]);

  return [node, setNode] as const;
}

export function useNodeData<T extends NodeData>() {
  const [node, setNode] = useNode<T>();

  const setData = useCallback((newData: Partial<T> | ((data: T) => T)) => {
    setNode(n => {
      const nd = typeof newData === 'function' ? newData(n.data as T) : newData;

      return {
        ...n,
        data: {
          ...n.data,
          ...nd
        }
      };
    })
  }, [setNode]);

  return [node?.data as T | undefined, setData] as const;
}

export function useNodeConfig<T>(initialConfig?: T | (() => T)) {
  const [data, setData] = useNodeData();

  const setConfig = useCallback((newConfig: T | ((c: T) => T)) => {
    setData(d => {
      const nc = typeof newConfig === 'function' ? (newConfig as (c: T) => T)(d.config as T) : newConfig;
      return { ...d, config: nc as unknown as Record<string, unknown> };
    });
  }, [setData]);

  const ic = useMemo(() => {
    if (initialConfig && typeof initialConfig === 'function') {
      const callable = initialConfig as () => T;
      return callable();
    }
    return (initialConfig as T) || data?.config as T || {} as T;
  }, [initialConfig, data?.config]);

  return [
    ic,
    setConfig
  ] as const;
}

export const useToolbarComponents = () => {
  const context = useWorkflow();
  return context.toolbarComponents;
};

export const useNodeComponents = () => {
  const context = useWorkflow();
  return context.nodeComponents;
};

export const useWorkflowComponents = () => {
  const context = useWorkflow();
  return context.workflowComponents;
};

type WorkflowComponentContextType = WorkflowComponentType;

const WorkflowComponentContext = createContext<WorkflowComponentContextType | null>(null);

export const WorkflowComponent: React.FC<React.PropsWithChildren<WorkflowComponentContextType>> = ({ children, ...props }) => {
  const context = useWorkflow();
  const { id, type, name, description, events } = props;

  React.useEffect(() => {
    if (context) {
      context.registerComponent(props);
    }
  }, [context, id, type, name, description, events]);

  return <WorkflowComponentContext.Provider value={props}>
    {children}
  </WorkflowComponentContext.Provider>;
};

export const useWorkflowComponent = () => {
  const context = useContext(WorkflowComponentContext);
  if (context === null) {
    throw new Error('useWorkflowComponent must be used within a WorkflowComponent');
  }
  return context;
}

export const WorkflowToolbar: React.FC<React.PropsWithChildren> = ({ children }) => {
  const context = useWorkflow();

  React.useEffect(() => {
    if (context) {
      context.registerToolbar(<>{children}</>);
    }
  }, [context, children]);

  return null;
};

export const WorkflowNode: React.FC<{ render: React.ComponentType<NodeProps<NodeData>> }> = ({ render }) => {
  const context = useWorkflow();

  React.useEffect(() => {
    if (context) {
      context.registerNode(render);
    }
  }, [context, render]);

  return null;
};