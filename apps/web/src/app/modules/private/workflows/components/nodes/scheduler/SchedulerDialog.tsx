'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VariableInput } from '@/components/ui/variable-input';
import { get } from 'lodash';
import { useNodeConfig, useNodeData } from '../../WorkflowContext';
import { DialogProps } from '../types';
import { NodeData, SchedulerNodeConfig, SchedulerTimeUnit } from '@repo/fintivio/schemas';

export function SchedulerDialog({ open, onOpenChange, data: d, onSave }: DialogProps) {
  const [nodeData, setNodeData] = useNodeData();
  const [config, setConfig] = useNodeConfig<SchedulerNodeConfig>((nodeData?.config || {
    type: 'absolute',
    scheduledDate: '',
  }) as SchedulerNodeConfig);
  const [selectedTab, setSelectedTab] = useState('basic');

  const handleSave = () => {
    onSave(nodeData as unknown as NodeData);
    onOpenChange(false);
  };

  const timeUnits: SchedulerTimeUnit[] = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];

  if (!nodeData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Configure Scheduler</DialogTitle>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
          </TabsList>

          <div className="p-4 space-y-4">
            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={nodeData.name}
                  onChange={(e) => setNodeData({ ...nodeData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={nodeData.description || ''}
                  onChange={(e) => setNodeData({ ...nodeData, description: e.target.value })}
                />
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label>Schedule Type</Label>
                <Select
                  value={config.type}
                  onValueChange={(value: 'absolute' | 'relative') => setConfig(value === 'absolute' ?{
                    ...config,
                    type: 'absolute',
                    // Reset the other fields when changing type
                    scheduledDate: String(get(config, 'scheduledDate')),
                  }: {
                    ...config,
                    type: 'relative',
                    // Reset the other fields when changing type
                    amount: Number(get(config, 'amount') || '1'),
                    unit: TimeUnitSchema.parse(get(config, 'unit') || 'hours'),
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absolute">Absolute Date</SelectItem>
                    <SelectItem value="relative">Relative Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.type === 'absolute' && (
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <VariableInput
                    value={config.scheduledDate || ''}
                    onChange={(value) => setConfig({
                      ...config,
                      scheduledDate: value,
                    })}
                    placeholder="Enter a date expression (e.g., 2024-12-31T00:00:00Z)"
                  />
                </div>
              )}

              {config.type === 'relative' && (
                <>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <VariableInput
                      value={String(config.amount || '')}
                      onChange={(value) => setConfig({
                        ...config,
                        amount: Number(value),
                      })}
                      placeholder="Enter a number or expression"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time Unit</Label>
                    <Select
                      value={config.unit}
                      onValueChange={(value: TimeUnit) => setConfig({
                        ...config,
                        unit: value,
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select time unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {timeUnits.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit.charAt(0).toUpperCase() + unit.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 