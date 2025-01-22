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
import { Switch } from '@/components/ui/switch';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { MapperNodeData, FieldMapping } from './types';
import { VariableInput } from '@/components/ui/variable-input';
import { DialogProps } from '../types';
import { useNodes } from 'reactflow';

export function MapperDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const nodes = useNodes();
  const [nodeData, setNodeData] = useState<MapperNodeData>(() => {
    if (data.config?.mapper) {
      return data.config.mapper as MapperNodeData;
    }
    return {
      name: data.name || 'Mapper',
      description: '',
      config: {
        mappings: [],
        includeUnmapped: false,
      },
    };
  });

  const [selectedTab, setSelectedTab] = useState<'mappings' | 'advanced'>('mappings');

  const handleSave = () => {
    onSave({
      ...data,
      name: nodeData.name,
      config: {
        ...data.config,
        mapper: nodeData,
      },
    });
    onOpenChange(false);
  };

  const addMapping = () => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        mappings: [
          ...prev.config.mappings,
          {
            source: '',
            target: '',
          },
        ],
      },
    }));
  };

  const removeMapping = (index: number) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        mappings: prev.config.mappings.filter((_, i) => i !== index),
      },
    }));
  };

  const updateMapping = (index: number, updates: Partial<FieldMapping>) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        mappings: prev.config.mappings.map((mapping, i) => {
          if (i === index) {
            return { ...mapping, ...updates };
          }
          return mapping;
        }),
      },
    }));
  };

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
          </div>

          {/* Mapper Configuration */}
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'mappings' | 'advanced')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mappings">Mappings</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            <TabsContent value="mappings" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Field Mappings</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addMapping}
                    className="h-8"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Mapping
                  </Button>
                </div>
                <div className="space-y-4">
                  {nodeData.config.mappings.map((mapping, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label>Source</Label>
                            <VariableInput
                              value={mapping.source}
                              onChange={(value) => updateMapping(index, { source: value })}
                              nodes={nodes}
                              placeholder="Source field path"
                            />
                          </div>
                          <div className="flex-1">
                            <Label>Target</Label>
                            <Input
                              value={mapping.target}
                              onChange={(e) => updateMapping(index, { target: e.target.value })}
                              placeholder="Target field path"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Transform</Label>
                          <Textarea
                            value={mapping.transform || ''}
                            onChange={(e) => updateMapping(index, { transform: e.target.value })}
                            placeholder="Optional transformation expression"
                            className="font-mono"
                            rows={2}
                          />
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMapping(index)}
                        className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between space-x-2">
                  <Label>Include Unmapped Fields</Label>
                  <Switch
                    checked={nodeData.config.includeUnmapped}
                    onCheckedChange={(checked) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        includeUnmapped: checked,
                      },
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom Expression</Label>
                  <Textarea
                    value={nodeData.config.customExpression || ''}
                    onChange={(e) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        customExpression: e.target.value,
                      },
                    }))}
                    placeholder="Enter a custom JavaScript expression for complex mappings"
                    className="font-mono"
                    rows={5}
                  />
                  <p className="text-xs text-muted-foreground">
                    Example: {'{'} ...input, computed: input.a + input.b {'}'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Output Template</Label>
                  <Textarea
                    value={nodeData.config.outputTemplate || ''}
                    onChange={(e) => setNodeData(prev => ({
                      ...prev,
                      config: {
                        ...prev.config,
                        outputTemplate: e.target.value,
                      },
                    }))}
                    placeholder="Optional JSON template for the output structure"
                    className="font-mono"
                    rows={5}
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