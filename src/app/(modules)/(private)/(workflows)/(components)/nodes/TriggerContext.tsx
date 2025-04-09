import * as React from 'react';
import { TriggerBuilder, TriggerDefinition } from '@/lib/triggers-utils';
import { useWorkflow } from '../WorkflowContext';
import { useRef, useState } from 'react';
import { WorkflowTrigger } from '../yaml/types';
import { uniqueId } from 'lodash';


interface TriggerContextValue {
  // State
  currentTrigger: TriggerDefinition;
  isNewTrigger: boolean;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  // Actions
  save: (trigger: TriggerDefinition) => void;
}

const TriggerContext = React.createContext<TriggerContextValue | null>(null);

interface TriggerProviderProps {
  children: React.ReactNode;
  defaultTrigger?: TriggerDefinition | null;
  onEditChange?: (trigger: TriggerDefinition, editing: boolean) => void;
  type?: string;
}

export function TriggerProvider({ children, defaultTrigger = null, onEditChange, type = 'trigger' }: TriggerProviderProps) {
  const [editing, setEditing] = useState(false);
  const { updateTriggers, triggers = [] } = useWorkflow();
  const receivedTrigger = useRef<WorkflowTrigger>(defaultTrigger || new TriggerBuilder(type + '-' + uniqueId()).type(type).build());
  const trigger = React.useMemo(() => {
    return receivedTrigger.current;
  }, [receivedTrigger.current]);
  const isNewTrigger = React.useMemo(() => {
    return !triggers.find(t => t.id === trigger?.id);
  }, [trigger, triggers]);

  const save = React.useCallback((trigger: TriggerDefinition) => {
    const triggerExists = triggers.find(t => t.id === trigger?.id);
    if (triggerExists) {
      updateTriggers(triggers.map(t => t.id === trigger?.id ? trigger : t));
    } else if (trigger) {
      updateTriggers([...triggers, trigger]);
    }
  }, [trigger, updateTriggers, triggers]);

  const value = React.useMemo(() => ({
    // State
    currentTrigger: trigger,
    isNewTrigger,
    editing,
    setEditing,
    // Actions
    save,
  }), [
    trigger,
    isNewTrigger,
    editing,
    setEditing,
    save,
  ]);

  React.useEffect(() => {
    onEditChange?.(trigger, editing);
  }, [editing]);

  return (
    <TriggerContext.Provider value={value}>
      {children}
    </TriggerContext.Provider>
  );
}

export function useTrigger() {
  const context = React.useContext(TriggerContext);
  if (!context) {
    throw new Error('useTrigger must be used within a TriggerProvider');
  }
  return context;
} 