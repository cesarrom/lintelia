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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { VariableInput } from '@/components/ui/variable-input';
import { useNodes } from 'reactflow';
import { IteratorNodeConfig } from '@repo/fintivio/schemas';
import { useNodeConfig, useNodeData } from '../../WorkflowContext';
import { DialogProps } from '../types';

export function IteratorDialog({ open, onOpenChange, data }: DialogProps) {
  const nodes = useNodes();
  const [nodeData, setNodeData] = useNodeData();

  const [nodeConfig, setNodeConfig] = useNodeConfig<IteratorNodeConfig>(() => {
    if (data.config) {
      return data.config as IteratorNodeConfig;
    }
    return {
      pathToArrayInContext: '',
      ctx: '',
    };
  });

  const [selectedTab, setSelectedTab] = useState<'basic' | 'advanced'>('basic');

  const handleSave = () => {
    console.log('saved');
  };

  const updateConfig = (updates: Partial<IteratorNodeConfig>) => {
    setNodeConfig(prev => ({
      ...prev,
      ...updates
    }));
  };

  if (!nodeData) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Iterator Configuration</DialogTitle>
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

          {/* Iterator Configuration */}
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'basic' | 'advanced')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="basic" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Array Path</Label>
                  <VariableInput
                    value={nodeConfig.pathToArrayInContext}
                    onChange={(value) => updateConfig({ pathToArrayInContext: value })}
                    placeholder="Enter path to array (e.g. data.items)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Object</Label>
                  <VariableInput
                    value={(nodeConfig.ctx || '') as string}
                    onChange={(value) => updateConfig({ ctx: value })}
                    placeholder="Enter path to array (e.g. data.items)"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 