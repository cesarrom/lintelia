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
import { IdentityValidationNodeData, ValidationType, ValidationMethod } from './types';
import { DialogProps } from '../types';

const DOCUMENT_TYPES: Array<{ value: ValidationType; label: string }> = [
  { value: 'id_card', label: 'ID Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driver_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID' },
];

const VALIDATION_METHODS: Array<{ value: ValidationMethod; label: string }> = [
  { value: 'ocr', label: 'OCR' },
  { value: 'mrz', label: 'MRZ' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'nfc', label: 'NFC' },
];

const COMMON_FIELDS = [
  'first_name',
  'last_name',
  'date_of_birth',
  'nationality',
  'document_number',
  'expiry_date',
  'address',
  'gender',
];

export function IdentityValidationDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const [nodeData, setNodeData] = useState<IdentityValidationNodeData>(() => {
    if (data.config?.identityValidation) {
      return data.config.identityValidation as IdentityValidationNodeData;
    }
    return {
      name: data.name || 'Identity Validation',
      description: '',
      config: {
        documentType: 'id_card',
        methods: ['ocr'],
        requiredFields: ['first_name', 'last_name', 'date_of_birth'],
        allowExpired: false,
        validateFace: true,
        validateHologram: true,
      },
    };
  });

  const handleSave = () => {
    onSave({
      ...data,
      name: nodeData.name,
      config: {
        ...data.config,
        identityValidation: nodeData,
      },
    });
    onOpenChange(false);
  };

  const toggleMethod = (method: ValidationMethod) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        methods: prev.config.methods.includes(method)
          ? prev.config.methods.filter(m => m !== method)
          : [...prev.config.methods, method],
      },
    }));
  };

  const toggleField = (field: string) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        requiredFields: prev.config.requiredFields.includes(field)
          ? prev.config.requiredFields.filter(f => f !== field)
          : [...prev.config.requiredFields, field],
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Identity Validation Configuration</DialogTitle>
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

          {/* Document Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select
                value={nodeData.config.documentType}
                onValueChange={(value: ValidationType) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    documentType: value,
                  },
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Validation Methods</Label>
              <div className="flex flex-wrap gap-2">
                {VALIDATION_METHODS.map(method => (
                  <Button
                    key={method.value}
                    variant={nodeData.config.methods.includes(method.value) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleMethod(method.value)}
                  >
                    {method.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Required Fields</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_FIELDS.map(field => (
                  <Button
                    key={field}
                    variant={nodeData.config.requiredFields.includes(field) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleField(field)}
                  >
                    {field.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Allow Expired Documents</Label>
              <Switch
                checked={nodeData.config.allowExpired || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    allowExpired: checked,
                  },
                }))}
              />
            </div>

            {nodeData.config.allowExpired && (
              <div className="space-y-2">
                <Label>Max Expiry Days</Label>
                <Input
                  type="number"
                  value={nodeData.config.maxExpiryDays || ''}
                  onChange={(e) => setNodeData(prev => ({
                    ...prev,
                    config: {
                      ...prev.config,
                      maxExpiryDays: e.target.value ? parseInt(e.target.value) : undefined,
                    },
                  }))}
                  placeholder="90"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Validate Face</Label>
              <Switch
                checked={nodeData.config.validateFace || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    validateFace: checked,
                  },
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Validate Hologram</Label>
              <Switch
                checked={nodeData.config.validateHologram || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    validateHologram: checked,
                  },
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Validate UV Features</Label>
              <Switch
                checked={nodeData.config.validateUv || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    validateUv: checked,
                  },
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Validate IR Features</Label>
              <Switch
                checked={nodeData.config.validateIr || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    validateIr: checked,
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