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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ConditionalNodeData, Condition } from './types';
import { VariableInput } from '@/components/ui/variable-input';
import { DialogProps } from '../types';
import { useNodes } from 'reactflow';

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'notEquals', label: 'Not Equals' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'contains', label: 'Contains' },
  { value: 'notContains', label: 'Not Contains' },
  { value: 'startsWith', label: 'Starts With' },
  { value: 'endsWith', label: 'Ends With' },
  { value: 'expression', label: 'Expression' },
] as const;

export function ConditionalDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const nodes = useNodes();
  const [nodeData, setNodeData] = useState<ConditionalNodeData>(() => {
    if (data.config?.conditional) {
      return data.config.conditional as ConditionalNodeData;
    }
    return {
      name: data.name || 'Condition',
      description: '',
      condition: {
        field: '',
        operator: 'equals',
        value: '',
      },
    };
  });

  const [selectedTab, setSelectedTab] = useState<'simple' | 'expression'>('simple');

  const handleSave = () => {
    onSave({
      ...data,
      config: data.config ? {
        ...data.config,
        conditional: nodeData,
      } : {
        conditional: nodeData,
      },
    });
    onOpenChange(false);
  };

  const updateCondition = (updates: Partial<Condition>) => {
    setNodeData(prev => ({
      ...prev,
      condition: {
        ...prev.condition,
        ...updates,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Condition Configuration</DialogTitle>
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

          {/* Condition Configuration */}
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'simple' | 'expression')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="simple">Simple</TabsTrigger>
              <TabsTrigger value="expression">Expression</TabsTrigger>
            </TabsList>
            <TabsContent value="simple" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Field</Label>
                  <VariableInput
                    value={nodeData.condition.field}
                    onChange={(value) => updateCondition({ field: value })}
                    nodes={nodes}
                    placeholder="Enter field name or path"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={nodeData.condition.operator}
                    onValueChange={(value) => updateCondition({ operator: value as Condition['operator'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <VariableInput
                    value={nodeData.condition.value.toString()}
                    onChange={(value) => updateCondition({ value: value })}
                    nodes={nodes}
                    placeholder="Enter comparison value"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="expression" className="space-y-4">
              <div className="space-y-2">
                <Label>JavaScript Expression</Label>
                <Textarea
                  value={nodeData.expression || ''}
                  onChange={(e) => setNodeData(prev => ({ ...prev, expression: e.target.value }))}
                  placeholder="Enter a JavaScript expression that returns true or false"
                  className="font-mono"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground">
                  Example: data.age {'>'} 18 && data.country === &apos;US&apos;
                </p>
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