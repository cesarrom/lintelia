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
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { ProofOfLifeNodeData, VerificationStep, VerificationType } from './types';
import { DialogProps } from '../types';

const VERIFICATION_TYPES: Array<{ value: VerificationType; label: string }> = [
  { value: 'selfie', label: 'Selfie' },
  { value: 'video', label: 'Video' },
  { value: 'gesture', label: 'Gesture' },
  { value: 'voice', label: 'Voice' },
];

const COMMON_GESTURES = [
  'smile',
  'blink',
  'turn_left',
  'turn_right',
  'nod',
  'shake_head',
];

export function ProofOfLifeDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const [nodeData, setNodeData] = useState<ProofOfLifeNodeData>(() => {
    if (data.config?.proofOfLife) {
      return data.config.proofOfLife as ProofOfLifeNodeData;
    }
    return {
      name: data.name || 'Proof of Life',
      description: '',
      config: {
        verificationSteps: [],
        minConfidenceScore: 0.9,
        maxAttempts: 3,
        timeoutDuration: 30,
        requireLocation: false,
        requireDeviceInfo: false,
      },
    };
  });

  const addVerificationStep = () => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        verificationSteps: [
          ...prev.config.verificationSteps,
          {
            type: 'selfie',
            instructions: '',
            timeLimit: 30,
          },
        ],
      },
    }));
  };

  const removeVerificationStep = (index: number) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        verificationSteps: prev.config.verificationSteps.filter((_, i) => i !== index),
      },
    }));
  };

  const updateVerificationStep = (index: number, updates: Partial<VerificationStep>) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        verificationSteps: prev.config.verificationSteps.map((step, i) => {
          if (i === index) {
            return { ...step, ...updates };
          }
          return step;
        }),
      },
    }));
  };

  const handleSave = () => {
    onSave({
      ...data,
      name: nodeData.name,
      config: {
        ...data.config,
        proofOfLife: nodeData,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Proof of Life Configuration</DialogTitle>
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

          {/* Verification Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Verification Steps</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addVerificationStep}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Step
              </Button>
            </div>
            <div className="space-y-4">
              {nodeData.config.verificationSteps.map((step, index) => (
                <div key={index} className="flex gap-2 items-start border rounded-lg p-4">
                  <div className="flex-1 space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Type</Label>
                        <Select
                          value={step.type}
                          onValueChange={(value: VerificationType) => 
                            updateVerificationStep(index, { type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VERIFICATION_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label>Time Limit (seconds)</Label>
                        <Input
                          type="number"
                          value={step.timeLimit || ''}
                          onChange={(e) => updateVerificationStep(index, { 
                            timeLimit: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          placeholder="30"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Instructions</Label>
                      <Textarea
                        value={step.instructions || ''}
                        onChange={(e) => updateVerificationStep(index, { 
                          instructions: e.target.value 
                        })}
                        placeholder="Enter instructions for the user"
                      />
                    </div>
                    {step.type === 'gesture' && (
                      <div className="space-y-2">
                        <Label>Required Gestures</Label>
                        <Select
                          value={step.requiredGestures?.[0] || ''}
                          onValueChange={(value) => updateVerificationStep(index, { 
                            requiredGestures: [value] 
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a gesture" />
                          </SelectTrigger>
                          <SelectContent>
                            {COMMON_GESTURES.map(gesture => (
                              <SelectItem key={gesture} value={gesture}>
                                {gesture.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {step.type === 'voice' && (
                      <div className="space-y-2">
                        <Label>Required Phrase</Label>
                        <Input
                          value={step.requiredPhrase || ''}
                          onChange={(e) => updateVerificationStep(index, { 
                            requiredPhrase: e.target.value 
                          })}
                          placeholder="Enter the phrase to be spoken"
                        />
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVerificationStep(index)}
                    className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Confidence Score (0-1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={nodeData.config.minConfidenceScore || ''}
                onChange={(e) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    minConfidenceScore: e.target.value ? parseFloat(e.target.value) : undefined,
                  },
                }))}
                placeholder="0.9"
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum Attempts</Label>
              <Input
                type="number"
                value={nodeData.config.maxAttempts || ''}
                onChange={(e) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    maxAttempts: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                }))}
                placeholder="3"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Require Location</Label>
              <Switch
                checked={nodeData.config.requireLocation || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    requireLocation: checked,
                  },
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Require Device Info</Label>
              <Switch
                checked={nodeData.config.requireDeviceInfo || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    requireDeviceInfo: checked,
                  },
                }))}
              />
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