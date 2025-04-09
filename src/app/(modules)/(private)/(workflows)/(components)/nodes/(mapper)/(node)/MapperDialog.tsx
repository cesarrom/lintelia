'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { VariableInput } from '@/components/ui/variable-input';
import { useNodes } from 'reactflow';
import { DialogProps } from '../../types';
import { MapperNodeData } from '../types';
import { useNodeConfig, useNodeData } from '../../../WorkflowContext';

export function MapperDialog({ open, onOpenChange, data }: DialogProps) {
  const [nodeData, setNodeData] = useNodeData();
  const [config, setConfig] = useNodeConfig<MapperNodeData>((data.config || {
    ctx: '',
    propertyPath: '',
  }) as MapperNodeData);

  if (!nodeData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Mapper Configuration</DialogTitle>
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Array Path</Label>
                <VariableInput
                  value={config.propertyPath}
                  onChange={(value) => setConfig(prev => ({ ...prev, propertyPath: value }))}
                  placeholder="Enter path to array (e.g. data.items)"
                />
              </div>
              <div className="space-y-2">
                <Label>Target Object</Label>
                <VariableInput
                  value={(config.ctx || '') as string}
                  onChange={(value) => setConfig(prev => ({ ...prev, ctx: value }))}
                  placeholder="Enter path to array (e.g. data.items)"
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 