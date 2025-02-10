'use client';

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
import { NodeData, Port } from '../types';
import { useNodeData } from '../../WorkflowContext';
import { useCallback } from 'react';

interface EndDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NodeData;
}

const OUTPUT_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
];

export function EndDialog({ open, onOpenChange }: EndDialogProps) {
  const [nodeData, setNodeData] = useNodeData();

  const handleSave = () => {
    onOpenChange(false);
  };

  const returnData = useCallback((data: NodeData, outputs: Port[]) => {
    if (!data.events || !data.events.length) {
      data.events = [{
        name: 'ended',
        outputs: [],
      }];
    }

    const [event] = data.events;
    event.outputs = outputs;

    return { ...data, events: [event] };
  }, []);

  const addOutput = useCallback(() => {
    setNodeData(data => {
      const currentOutputs = data.events?.[0]?.outputs || [];
      const newOutputs = [
        ...currentOutputs,
        {
          name: '',
          type: 'string',
        },
      ];

      return returnData(data, newOutputs);
    });
  }, [returnData, setNodeData]);

  const removeOutput = useCallback((index: number) => {
    setNodeData(data => {
      const currentOutputs = [...(data.events?.[0]?.outputs || [])];
      currentOutputs.splice(index, 1);
      return returnData(data, currentOutputs);
    });
  }, [returnData, setNodeData]);

  const updateOutput = (index: number, updates: Partial<Port>) => {
    setNodeData(data => {
      const currentOutputs = [...(data.events?.[0]?.outputs || [])];
      currentOutputs[index] = { ...currentOutputs[index], ...updates };
      return returnData(data, currentOutputs);
    });
  };

  const outputs = nodeData?.events?.[0]?.outputs || [];

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
                value={nodeData?.name}
                onChange={(e) => setNodeData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter node name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={nodeData?.description || ''}
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
              {outputs.map((output, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={output.name}
                      onChange={(e) => updateOutput(index, { name: e.target.value })}
                      placeholder="Parameter name"
                    />
                    <div className="flex gap-2">
                      <Select
                        value={output.type}
                        onValueChange={(value) => updateOutput(index, { type: value })}
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
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOutput(index)}
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