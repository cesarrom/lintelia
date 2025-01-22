'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VariableInput } from '@/components/ui/variable-input';
import { SchedulerNodeData, TimeUnit, ScheduleType } from './types';
import { DialogProps, NodeData } from '../types';
import { useNodes } from 'reactflow';

export function SchedulerDialog({ open, onOpenChange, data: d, onSave }: DialogProps) {
  const nodes = useNodes();
  const data = d as unknown as Omit<NodeData, 'config'> & { config: SchedulerNodeData };
  const [nodeData, setNodeData] = useState(data);
  const [selectedTab, setSelectedTab] = useState('basic');

  const handleSave = () => {
    onSave(nodeData as unknown as NodeData);
    onOpenChange(false);
  };

  const timeUnits: TimeUnit[] = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];

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
            <TabsTrigger value="settings">Settings</TabsTrigger>
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
                  value={nodeData.config.type}
                  onValueChange={(value: ScheduleType) => setNodeData({
                    ...nodeData,
                    config: {
                      ...nodeData.config,
                      type: value,
                      // Reset the other fields when changing type
                      scheduledDate: value === 'absolute' ? nodeData.config.scheduledDate : undefined,
                      amount: value === 'relative' ? nodeData.config.amount : undefined,
                      unit: value === 'relative' ? nodeData.config.unit : undefined,
                    },
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

              {nodeData.config.type === 'absolute' && (
                <div className="space-y-2">
                  <Label>Scheduled Date</Label>
                  <VariableInput
                    value={nodeData.config.scheduledDate || ''}
                    onChange={(value) => setNodeData({
                      ...nodeData,
                      config: {
                        ...nodeData.config,
                        scheduledDate: value,
                      },
                    })}
                    nodes={nodes}
                    placeholder="Enter a date expression (e.g., 2024-12-31T00:00:00Z)"
                  />
                </div>
              )}

              {nodeData.config.type === 'relative' && (
                <>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <VariableInput
                      value={nodeData.config.amount || ''}
                      onChange={(value) => setNodeData({
                        ...nodeData,
                        config: {
                          ...nodeData.config,
                          amount: value,
                        },
                      })}
                      nodes={nodes}
                      placeholder="Enter a number or expression"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time Unit</Label>
                    <Select
                      value={nodeData.config.unit}
                      onValueChange={(value: TimeUnit) => setNodeData({
                        ...nodeData,
                        config: {
                          ...nodeData.config,
                          unit: value,
                        },
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

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div className="flex items-center justify-between">
                <Label>Retry on Failure</Label>
                <Switch
                  checked={nodeData.config.settings?.retryOnFailure || false}
                  onCheckedChange={(checked) => setNodeData({
                    ...nodeData,
                    config: {
                      ...nodeData.config,
                      settings: {
                        ...nodeData.config.settings,
                        retryOnFailure: checked,
                      },
                    },
                  })}
                />
              </div>

              {nodeData.config.settings?.retryOnFailure && (
                <>
                  <div className="space-y-2">
                    <Label>Max Retries</Label>
                    <Input
                      type="number"
                      value={nodeData.config.settings.maxRetries || ''}
                      onChange={(e) => setNodeData({
                        ...nodeData,
                        config: {
                          ...nodeData.config,
                          settings: {
                            ...nodeData.config.settings,
                            maxRetries: parseInt(e.target.value) || undefined,
                          },
                        },
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retry Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={nodeData.config.settings.retryDelay || ''}
                      onChange={(e) => setNodeData({
                        ...nodeData,
                        config: {
                          ...nodeData.config,
                          settings: {
                            ...nodeData.config.settings,
                            retryDelay: parseInt(e.target.value) || undefined,
                          },
                        },
                      })}
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Input
                  value={nodeData.config.settings?.timezone || ''}
                  onChange={(e) => setNodeData({
                    ...nodeData,
                    config: {
                      ...nodeData.config,
                      settings: {
                        ...nodeData.config.settings,
                        timezone: e.target.value,
                      },
                    },
                  })}
                  placeholder="e.g., America/New_York"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end">
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 