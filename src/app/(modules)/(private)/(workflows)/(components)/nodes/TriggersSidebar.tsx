import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Trash2, Pencil, Zap } from "lucide-react";
import { useState } from "react";
import { AddTriggerDialog } from "./AddTriggerDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkflow } from "../WorkflowContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { v4 as uuid } from 'uuid';
import { TriggerProvider, useTrigger } from './TriggerContext';

// Import trigger types from their respective files
import { schedulerTrigger } from "./(scheduler)/(trigger)";
import { formsTrigger } from "./(form)/(trigger)";
import { databaseTrigger } from "./(database)/(trigger)";
import { apiTrigger } from "./(api)/(trigger)";
import { usersTrigger } from "./(auth)/(trigger)";
import { WorkflowInputYaml, WorkflowTrigger } from '../yaml/types';

// Define available trigger types
const triggerTypes = {
  scheduler: schedulerTrigger,
  forms: formsTrigger,
  database: databaseTrigger,
  api: apiTrigger,
  users: usersTrigger,
} as const;

const INPUT_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
] as const;

interface TriggersSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggers: WorkflowTrigger[];
  onTriggersChange: (triggers: WorkflowTrigger[]) => void;
}

// Helper to convert input type to Port type
const inputToPort = (input: WorkflowInputYaml) => ({
  name: input.name,
  type: input.type,
  description: input.description,
});

export function TriggersSidebar({ open, onOpenChange, triggers, onTriggersChange }: TriggersSidebarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<WorkflowTrigger | null>(null);
  const { nodes, updateNodes, workflow, updateWorkflow } = useWorkflow();
  const [activeTab, setActiveTab] = useState('triggers');

  // Find start node to sync its outputs with workflow inputs
  const startNode = nodes.find(node => node.type === 'start');
  const inputs = workflow.inputs || [];

  const handleAddTrigger = (trigger: WorkflowTrigger) => {
    onTriggersChange([...triggers, trigger]);
  };

  const handleEditTrigger = (trigger: WorkflowTrigger) => {
    setEditingTrigger(trigger);
  };

  const handleSaveEdit = (updatedTrigger: WorkflowTrigger) => {
    onTriggersChange(
      triggers.map(t => t.id === updatedTrigger.id ? updatedTrigger : t)
    );
    setEditingTrigger(null);
  };

  const handleCancelEdit = () => {
    setEditingTrigger(null);
  };

  const handleRemoveTrigger = (triggerId: string) => {
    onTriggersChange(triggers.filter(t => t.id !== triggerId));
  };

  const handleAddInput = () => {
    const newInput: WorkflowInputYaml = {
      id: uuid(),
      name: '',
      type: 'string',
      required: false,
      description: '',
    };

    updateWorkflow(w => ({
      ...w,
      inputs: [...(w.inputs || []), newInput],
    }));

    // Sync start node outputs with workflow inputs
    if (startNode) {
      updateNodes(nodes.map(node => {
        if (node.type === 'start') {
          return {
            ...node,
            data: {
              ...node.data,
              events: [{
                name: 'started',
                outputs: [...inputs, newInput].map(i => inputToPort(i as WorkflowInputYaml)),
                next: [],
              }],
            },
          };
        }
        return node;
      }));
    }
  };

  const handleRemoveInput = (inputId: string) => {
    updateWorkflow(w => ({
      ...w,
      inputs: (w.inputs || []).filter(input => input.id !== inputId),
    }));

    // Sync start node outputs with workflow inputs
    if (startNode) {
      updateNodes(nodes.map(node => {
        if (node.type === 'start') {
          return {
            ...node,
            data: {
              ...node.data,
              events: [{
                name: 'started',
                outputs: inputs.filter(input => input.id !== inputId).map(inputToPort),
                next: [],
              }],
            },
          };
        }
        return node;
      }));
    }
  };

  const handleUpdateInput = (inputId: string, updates: Partial<WorkflowInputYaml>) => {
    updateWorkflow(w => ({
      ...w,
      inputs: (w.inputs || []).map(input => {
        if (input.id === inputId) {
          return { ...input, ...updates };
        }
        return input;
      }),
    }));

    // Sync start node outputs with workflow inputs
    if (startNode) {
      updateNodes(nodes.map(node => {
        if (node.type === 'start') {
          return {
            ...node,
            data: {
              ...node.data,
              events: [{
                name: 'started',
                outputs: inputs.map(input => {
                  if (input.id === inputId) {
                    return {
                      name: updates.name || input.name,
                      type: updates.type || input.type,
                      description: updates.description !== undefined ? updates.description : input.description,
                    };
                  }
                  return inputToPort(input);
                }),
                next: [],
              }],
            },
          };
        }
        return node;
      }));
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Workflow Configuration</SheetTitle>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="triggers">Triggers</TabsTrigger>
              <TabsTrigger value="inputs">Inputs</TabsTrigger>
            </TabsList>

            <TabsContent value="triggers">
              <div className="flex justify-end mb-4">
                <Button onClick={() => setAddDialogOpen(true)} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Trigger
                </Button>
              </div>

              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="space-y-4 pr-4">
                  {triggers.map((trigger) => (
                    <TriggerProvider defaultTrigger={trigger} key={trigger.id} type={trigger.type}>
                      <TriggerListItem trigger={trigger} onRemove={handleRemoveTrigger}>
                        {React.createElement(triggerTypes[trigger.type as keyof typeof triggerTypes].configComponent)}
                      </TriggerListItem>
                    </TriggerProvider>
                  ))}

                  {triggers.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No triggers configured. Click &quot;Add Trigger&quot; to create one.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="inputs">
              <div className="flex justify-end mb-4">
                <Button onClick={handleAddInput} size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Input
                </Button>
              </div>

              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="space-y-4 pr-4">
                  {inputs.map((input) => (
                    <Card key={input.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <Input
                              value={input.name}
                              onChange={(e) => handleUpdateInput(input.id, { name: e.target.value })}
                              placeholder="Parameter name"
                            />
                            <div className="flex gap-2">
                              <Select
                                value={input.type as string}
                                onValueChange={(value) => handleUpdateInput(input.id, { type: value as any })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {INPUT_TYPES.map(type => (
                                    <SelectItem key={type.value} value={type.value}>
                                      {type.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`required-${input.id}`}
                                  checked={input.required}
                                  onCheckedChange={(checked) => handleUpdateInput(input.id, { required: !!checked })}
                                />
                                <Label htmlFor={`required-${input.id}`} className="text-sm">Required</Label>
                              </div>
                            </div>
                            <Textarea
                              value={input.description || ''}
                              onChange={(e) => handleUpdateInput(input.id, { description: e.target.value })}
                              placeholder="Parameter description"
                              className="h-20"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive ml-2"
                            onClick={() => handleRemoveInput(input.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}

                  {inputs.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      No inputs configured. Click &quot;Add Input&quot; to create one.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <AddTriggerDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddTrigger}
      />
    </>
  );
}

export function TriggerListItem({ children, trigger, onRemove }: { children: React.ReactNode, trigger: WorkflowTrigger, onRemove: (id: string) => void }) {
  const { editing, setEditing } = useTrigger();
  return (
    <Card key={trigger.id}>
      {editing ? children : (
        <>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{trigger.name}</CardTitle>
                <CardDescription>{trigger.type}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onRemove(trigger.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {trigger.description}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  )
}

export function TriggerSidebarButton({ triggers, updateTriggers }: { triggers: WorkflowTrigger[], updateTriggers: (triggers: WorkflowTrigger[]) => void }) {
  const [triggersSidebarOpen, setTriggersSidebarOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setTriggersSidebarOpen(true)}
        title="Manage Triggers"
      >
        <Zap className="h-4 w-4" />
      </Button>
      <TriggersSidebar
        open={triggersSidebarOpen}
        onOpenChange={setTriggersSidebarOpen}
        triggers={triggers}
        onTriggersChange={updateTriggers}
      />
    </>
  );
}