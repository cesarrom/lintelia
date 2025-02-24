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
import { IteratorNodeData } from './types';
import { VariableInput } from '@/components/ui/variable-input';
import { DialogProps } from '../types';
import { useNodes } from 'reactflow';

export function IteratorDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const nodes = useNodes();
  const [nodeData, setNodeData] = useState<IteratorNodeData>(() => {
    if (data.config?.iterator) {
      return data.config.iterator as IteratorNodeData;
    }
    return {
      name: data.name || 'Iterator',
      description: '',
      config: {
        arrayPath: '',
        itemVariable: 'item',
        indexVariable: 'index',
      },
    };
  });

  const [selectedTab, setSelectedTab] = useState<'basic' | 'advanced'>('basic');

  const handleSave = () => {
    onSave({
      ...data,
      name: nodeData.name,
      config: {
        ...data.config,
        iterator: nodeData,
      },
    });
    onOpenChange(false);
  };

  const updateConfig = (updates: Partial<IteratorNodeData['config']>) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        ...updates,
      },
    }));
  };

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
                    value={nodeData.config.arrayPath}
                    onChange={(value) => updateConfig({ arrayPath: value })}
                    nodes={nodes}
                    placeholder="Enter path to array (e.g. data.items)"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Item Variable Name</Label>
                  <Input
                    value={nodeData.config.itemVariable}
                    onChange={(e) => updateConfig({ itemVariable: e.target.value })}
                    placeholder="Variable name for current item"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Index Variable Name</Label>
                  <Input
                    value={nodeData.config.indexVariable}
                    onChange={(e) => updateConfig({ indexVariable: e.target.value })}
                    placeholder="Variable name for current index"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={nodeData.config.batchSize || ''}
                    onChange={(e) => updateConfig({ batchSize: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="Number of items to process at once"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional: Process items in batches
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Filter Expression</Label>
                  <Textarea
                    value={nodeData.config.filterExpression || ''}
                    onChange={(e) => updateConfig({ filterExpression: e.target.value })}
                    placeholder="Enter a JavaScript expression that returns true/false"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: item.status === &apos;active&apos; && item.price &gt; 100
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Sort Expression</Label>
                  <Textarea
                    value={nodeData.config.sortExpression || ''}
                    onChange={(e) => updateConfig({ sortExpression: e.target.value })}
                    placeholder="Enter a JavaScript expression for sorting"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: (a, b) =&gt; a.price - b.price
                  </p>
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