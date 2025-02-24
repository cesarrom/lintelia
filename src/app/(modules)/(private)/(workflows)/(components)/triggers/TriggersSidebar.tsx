import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";
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
import { TypeDefinitionType } from "../nodes/types";

const INPUT_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

export type WorkflowTrigger = {
  id: string;
  type: string;
  name: string;
  description?: string;
  eventName: string;
  config: Record<string, unknown>;
};

export type WorkflowInput = {
  id: string;
  name: string;
  type: TypeDefinitionType;
  required: boolean;
  description?: string;
};

interface TriggersSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggers: WorkflowTrigger[];
  onTriggersChange: (triggers: WorkflowTrigger[]) => void;
}

// Helper to convert input type to Port type
const inputToPort = (input: WorkflowInput) => ({
  name: input.name,
  type: input.type,
  description: input.description,
});

export function TriggersSidebar({ open, onOpenChange, triggers, onTriggersChange }: TriggersSidebarProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { nodes, updateNodes, workflow, updateWorkflow } = useWorkflow();
  const [activeTab, setActiveTab] = useState('triggers');

  // Find start node to sync its outputs with workflow inputs
  const startNode = nodes.find(node => node.type === 'start');
  const inputs = workflow.inputs || [];

  const handleAddTrigger = (trigger: WorkflowTrigger) => {
    onTriggersChange([...triggers, trigger]);
  };

  const handleRemoveTrigger = (triggerId: string) => {
    onTriggersChange(triggers.filter(t => t.id !== triggerId));
  };

  const handleAddInput = () => {
    const newInput: WorkflowInput = {
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
                outputs: [...inputs, newInput].map(inputToPort),
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

  const handleUpdateInput = (inputId: string, updates: Partial<WorkflowInput>) => {
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
                    <Card key={trigger.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{trigger.name}</CardTitle>
                            <CardDescription>{trigger.type}</CardDescription>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleRemoveTrigger(trigger.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {trigger.description}
                        </div>
                      </CardContent>
                    </Card>
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
                                onValueChange={(value) => handleUpdateInput(input.id, { type: value as TypeDefinitionType })}
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