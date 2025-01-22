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
import { EndNodeData } from './types';
import { NodeData } from '../types';

interface EndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NodeData;
  onSave: (updates: Partial<NodeData>) => void;
}

const OUTPUT_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

export function EndDialog({ open, onOpenChange, data, onSave }: EndDialogProps) {
  const [nodeData, setNodeData] = useState<EndNodeData>(() => {
    if (data.config?.end) {
      return data.config.end as EndNodeData;
    }
    return {
      name: data.name || 'End',
      description: '',
      outputs: [],
    };
  });

  const handleSave = () => {
    onSave({
      name: nodeData.name,
      config: {
        end: nodeData,
      },
    });
    onOpenChange(false);
  };

  const addOutput = () => {
    setNodeData(prev => ({
      ...prev,
      outputs: [
        ...prev.outputs,
        {
          id: crypto.randomUUID(),
          name: '',
          type: 'string',
          description: '',
        },
      ],
    }));
  };

  const removeOutput = (id: string) => {
    setNodeData(prev => ({
      ...prev,
      outputs: prev.outputs.filter(output => output.id !== id),
    }));
  };

  const updateOutput = (id: string, updates: Partial<EndNodeData['outputs'][0]>) => {
    setNodeData(prev => ({
      ...prev,
      outputs: prev.outputs.map(output => {
        if (output.id === id) {
          return { ...output, ...updates };
        }
        return output;
      }),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>End Node Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={nodeData.name}
                onChange={(e) => setNodeData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter node name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={nodeData.description || ''}
                onChange={(e) => setNodeData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter node description"
              />
            </div>
          </div>

          {/* Output Parameters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Output Parameters</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addOutput}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Output
              </Button>
            </div>
            <div className="space-y-4">
              {nodeData.outputs.map((output) => (
                <div key={output.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={output.name}
                      onChange={(e) => updateOutput(output.id, { name: e.target.value })}
                      placeholder="Parameter name"
                    />
                    <div className="flex gap-2">
                      <Select
                        value={output.type}
                        onValueChange={(value) => updateOutput(output.id, { type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTPUT_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      value={output.description || ''}
                      onChange={(e) => updateOutput(output.id, { description: e.target.value })}
                      placeholder="Parameter description"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOutput(output.id)}
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