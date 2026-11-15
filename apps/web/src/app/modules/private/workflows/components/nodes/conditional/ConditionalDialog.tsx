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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VariableInput } from '@/components/ui/variable-input';
import { Card, CardContent } from '@/components/ui/card';
import { DialogProps } from '../types';
import { useNodeConfig, useNodeData } from '../../WorkflowContext';
import { ConditionalNodeData } from '../types';

const OPERATORS = [
  { value: 'equals', label: 'Equals', bothOperandsRequired: true },
  { value: 'notEquals', label: 'Not Equals', bothOperandsRequired: true },
  { value: 'greaterThan', label: 'Greater Than', bothOperandsRequired: true },
  { value: 'greaterThanOrEqual', label: 'Greater Than or Equal', bothOperandsRequired: true },
  { value: 'lessThan', label: 'Less Than', bothOperandsRequired: true },
  { value: 'lessThanOrEqual', label: 'Less Than or Equal', bothOperandsRequired: true },
  { value: 'contains', label: 'Contains', bothOperandsRequired: true },
  { value: 'notContains', label: 'Does Not Contain', bothOperandsRequired: true },
  { value: 'startsWith', label: 'Starts With', bothOperandsRequired: true },
  { value: 'endsWith', label: 'Ends With', bothOperandsRequired: true },
  { value: 'matches', label: 'Matches (Regex)', bothOperandsRequired: true },
  { value: 'isNull', label: 'Is Null', bothOperandsRequired: false },
  { value: 'isNotNull', label: 'Is Not Null', bothOperandsRequired: false },
  { value: 'isEmpty', label: 'Is Empty', bothOperandsRequired: false },
  { value: 'isNotEmpty', label: 'Is Not Empty', bothOperandsRequired: false },
  { value: 'isTrue', label: 'Is True', bothOperandsRequired: false },
  { value: 'isFalse', label: 'Is False', bothOperandsRequired: false }
] as const;

export function ConditionalDialog({ open, onOpenChange }: DialogProps) {
  const [node, setNode] = useNodeData();
  const [nodeData, setNodeData] = useNodeConfig<ConditionalNodeData>();
  const operator = OPERATORS.find(op => op.value === nodeData?.operator);
  const updateCondition = (updates: Partial<ConditionalNodeData>) => {
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
          <DialogTitle>Condition Configuration</DialogTitle>
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
              <Textarea
                value={node.description || ''}
                onChange={(e) => setNode(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter node description"
              />
            </div>
          </div>

          {/* Condition Configuration */}
          <Card>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Left Value</Label>
                  <VariableInput
                    value={nodeData?.leftValue?.toString() || ''}
                    onChange={(value) => updateCondition({ leftValue: value })}
                    placeholder="Enter field name or path"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={nodeData?.operator}
                    onValueChange={(value) => updateCondition({ operator: value as ConditionalNodeData['operator'] })}
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
                {operator?.bothOperandsRequired ? (
                  <div className="space-y-2">
                    <Label>Right Value</Label>
                    <VariableInput
                      value={nodeData?.rightValue?.toString() || ''}
                      onChange={(value) => updateCondition({ rightValue: value })}
                      placeholder="Enter comparison value"
                    />
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
} 