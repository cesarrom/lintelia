'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VariableInput } from '@/components/ui/variable-input';
import { DialogProps } from '../../types';
import { useNodeConfig, useNodeData } from '../../../WorkflowContext';
import { FetchUserNodeData } from '../types';

export function FetchUserDialog({ open, onOpenChange }: DialogProps) {
  const [node, setNode] = useNodeData();
  const [nodeData, setNodeData] = useNodeConfig<FetchUserNodeData>();
  const updateCondition = (updates: Partial<FetchUserNodeData>) => {
    setNodeData(prev => ({
      ...prev,
      ...updates,
    }));
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Fetch User Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={node.name}
                onChange={(e) => setNode(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter node name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={node.description || ''}
                onChange={(e) => setNode(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter node description"
              />
            </div>
          </div>

          {/* Fetch User Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={nodeData?.by}
                onValueChange={(value) => updateCondition({ by: value as 'email' | 'id' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="id">ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <VariableInput
                value={nodeData?.value || ''}
                onChange={(value) => updateCondition({ value })}
                placeholder="Enter value"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 