'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WizardNodeData, WizardStep } from './types';
import { VariableInput } from '@/components/ui/variable-input';
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { DialogProps, NodeData } from '../types';
import { useNodes } from 'reactflow';
import { v4 as uuid } from 'uuid';

export function WizardDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const nodes = useNodes();
  const [nodeData, setNodeData] = useState(data as unknown as Omit<NodeData, 'config'> & { config: WizardNodeData });
  const [selectedTab, setSelectedTab] = useState('basic');

  const handleSave = () => {
    onSave(nodeData as unknown as NodeData);
    onOpenChange(false);
  };

  const addStep = () => {
    const newStep: WizardStep = {
      id: uuid(),
      name: `Step ${nodeData.config.steps.length + 1}`,
      nodeId: '',
    };
    setNodeData({
      ...nodeData,
      config: {
        ...nodeData.config,
        steps: [...nodeData.config.steps, newStep],
      },
    });
  };

  const removeStep = (index: number) => {
    const steps = [...nodeData.config.steps];
    steps.splice(index, 1);
    setNodeData({
      ...nodeData,
      config: {
        ...nodeData.config,
        steps,
      },
    });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const steps = [...nodeData.config.steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < steps.length) {
      [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
      setNodeData({
        ...nodeData,
        config: {
          ...nodeData.config,
          steps,
        },
      });
    }
  };

  const updateStep = (index: number, updates: Partial<WizardStep>) => {
    const steps = [...nodeData.config.steps];
    steps[index] = { ...steps[index], ...updates };
    setNodeData({
      ...nodeData,
      config: {
        ...nodeData.config,
        steps,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Configure Wizard</DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 h-[60vh]">
            <div className="p-4 space-y-4">
              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={nodeData.name}
                    onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={nodeData.description || ''}
                    onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="steps" className="mt-0">
                <div className="space-y-4">
                  {nodeData.config.steps.map((step, index) => (
                    <div key={step.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium">Step {index + 1}</h4>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                          >
                            <MoveUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === nodeData.config.steps.length - 1}
                          >
                            <MoveDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeStep(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            value={step.name}
                            onChange={(e) => updateStep(index, { name: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea
                            value={step.description || ''}
                            onChange={(e) => updateStep(index, { description: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Skip Condition</Label>
                          <VariableInput
                            value={step.config?.skipCondition || ''}
                            onChange={(value) => updateStep(index, {
                              config: { ...step.config, skipCondition: value }
                            })}
                            nodes={nodes}
                            placeholder="Enter a condition to skip this step"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Timeout (seconds)</Label>
                          <Input
                            type="number"
                            value={step.config?.timeoutSeconds || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, timeoutSeconds: parseInt(e.target.value) || undefined }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Retry Count</Label>
                          <Input
                            type="number"
                            value={step.config?.retryCount || ''}
                            onChange={(e) => updateStep(index, {
                              config: { ...step.config, retryCount: parseInt(e.target.value) || undefined }
                            })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <Button onClick={addStep} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Step
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <Label>Allow Step Navigation</Label>
                  <Switch
                    checked={nodeData.config.settings?.allowStepNavigation || false}
                    onCheckedChange={(checked) => setNodeData({
                      ...nodeData,
                      config: {
                        ...nodeData.config,
                        settings: {
                          ...nodeData.config.settings,
                          allowStepNavigation: checked,
                        },
                      },
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Save Progress</Label>
                  <Switch
                    checked={nodeData.config.settings?.saveProgress || false}
                    onCheckedChange={(checked) => setNodeData({
                      ...nodeData,
                      config: {
                        ...nodeData.config,
                        settings: {
                          ...nodeData.config.settings,
                          saveProgress: checked,
                        },
                      },
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expiry Hours</Label>
                  <Input
                    type="number"
                    value={nodeData.config.settings?.expiryHours || ''}
                    onChange={(e) => setNodeData({
                      ...nodeData,
                      config: {
                        ...nodeData.config,
                        settings: {
                          ...nodeData.config.settings,
                          expiryHours: parseInt(e.target.value) || undefined,
                        },
                      },
                    })}
                  />
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 