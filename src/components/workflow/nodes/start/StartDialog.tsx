'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { StartNodeData, TriggerType } from './types';
import { cn } from '@/lib/utils';
import { NodeData } from '../types';

interface StartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NodeData;
  onSave: (updates: Partial<NodeData>) => void;
}

const TRIGGER_TYPES: Array<{ value: TriggerType; label: string }> = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'event', label: 'Event' },
];

const INPUT_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

export function StartDialog({ open, onOpenChange, data, onSave }: StartDialogProps) {
  const [nodeData, setNodeData] = useState<StartNodeData>(() => {
    if (data.config?.start) {
      return data.config.start as StartNodeData;
    }
    return {
      name: data.name || 'Start',
      description: '',
      inputs: [],
      trigger: {
        type: 'webhook',
        config: {},
      },
    };
  });

  const handleSave = () => {
    onSave({
      name: nodeData.name,
      config: {
        start: nodeData,
      },
    });
    onOpenChange(false);
  };

  const addInput = () => {
    setNodeData(prev => ({
      ...prev,
      inputs: [
        ...prev.inputs,
        {
          id: crypto.randomUUID(),
          name: '',
          type: 'string',
          required: false,
          description: '',
        },
      ],
    }));
  };

  const removeInput = (id: string) => {
    setNodeData(prev => ({
      ...prev,
      inputs: prev.inputs.filter(input => input.id !== id),
    }));
  };

  const updateInput = (id: string, updates: Partial<StartNodeData['inputs'][0]>) => {
    setNodeData(prev => ({
      ...prev,
      inputs: prev.inputs.map(input => {
        if (input.id === id) {
          return { ...input, ...updates };
        }
        return input;
      }),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Start Node Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={nodeData.name}
                onChange={(e) => setNodeData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter workflow name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={nodeData.description || ''}
                onChange={(e) => setNodeData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter workflow description"
              />
            </div>
          </div>

          {/* Trigger Configuration */}
          <div className="space-y-4">
            <Label>Trigger Type</Label>
            <Select
              value={nodeData.trigger.type}
              onValueChange={(value: TriggerType) =>
                setNodeData(prev => ({
                  ...prev,
                  trigger: {
                    type: value,
                    config: {},
                  },
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a trigger type" />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Input Parameters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Input Parameters</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addInput}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Input
              </Button>
            </div>
            <div className="space-y-4">
              {nodeData.inputs.map((input) => (
                <div key={input.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={input.name}
                      onChange={(e) => updateInput(input.id, { name: e.target.value })}
                      placeholder="Parameter name"
                    />
                    <div className="flex gap-2">
                      <Select
                        value={input.type}
                        onValueChange={(value) => updateInput(input.id, { type: value })}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => updateInput(input.id, { required: !input.required })}
                        className={cn(
                          'h-10 px-3',
                          input.required && 'bg-primary/10 text-primary'
                        )}
                      >
                        Required
                      </Button>
                    </div>
                    <Input
                      value={input.description || ''}
                      onChange={(e) => updateInput(input.id, { description: e.target.value })}
                      placeholder="Parameter description"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeInput(input.id)}
                    className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 