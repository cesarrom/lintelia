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
import {
  DocumentExtractorNodeData,
  DocumentType,
  ExtractionMethod,
  FieldExtraction,
} from './types';
import { NodeData } from '../types';

interface DocumentExtractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: NodeData;
  nodes: NodeData[];
  onSave: (updates: Partial<NodeData>) => void;
}

const DOCUMENT_TYPES: Array<{ value: DocumentType; label: string }> = [
  { value: 'id_card', label: 'ID Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'driver_license', label: "Driver's License" },
  { value: 'national_id', label: 'National ID' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
];

const EXTRACTION_METHODS: Array<{ value: ExtractionMethod; label: string }> = [
  { value: 'ocr', label: 'OCR' },
  { value: 'mrz', label: 'MRZ' },
  { value: 'barcode', label: 'Barcode' },
  { value: 'template_matching', label: 'Template Matching' },
  { value: 'ml_model', label: 'ML Model' },
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'image', label: 'Image' },
];

const PREPROCESSORS = [
  'grayscale',
  'binarization',
  'noise_reduction',
  'deskew',
  'contrast_enhancement',
  'edge_detection',
];

export function DocumentExtractorDialog({ open, onOpenChange, data, onSave }: DocumentExtractorDialogProps) {
  const [nodeData, setNodeData] = useState<DocumentExtractorNodeData>(() => {
    if (data.config?.documentExtractor) {
      return data.config.documentExtractor as DocumentExtractorNodeData;
    }
    return {
      name: data.name || 'Document Extractor',
      description: '',
      config: {
        documentType: 'id_card',
        methods: ['ocr'],
        fields: [],
        validateExtraction: true,
        confidenceThreshold: 0.8,
        outputFormat: 'json',
      },
    };
  });

  const handleSave = () => {
    onSave({
      name: nodeData.name,
      config: {
        documentExtractor: nodeData,
      },
    });
    onOpenChange(false);
  };

  const addField = () => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        fields: [
          ...prev.config.fields,
          {
            name: '',
            label: '',
            type: 'text',
            required: true,
            method: 'ocr',
          },
        ],
      },
    }));
  };

  const removeField = (index: number) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        fields: prev.config.fields.filter((_, i) => i !== index),
      },
    }));
  };

  const updateField = (index: number, updates: Partial<FieldExtraction>) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        fields: prev.config.fields.map((field, i) => {
          if (i === index) {
            return { ...field, ...updates };
          }
          return field;
        }),
      },
    }));
  };

  const toggleMethod = (method: ExtractionMethod) => {
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

  const togglePreprocessor = (preprocessor: string) => {
    setNodeData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        preprocessors: prev.config.preprocessors?.includes(preprocessor)
          ? prev.config.preprocessors.filter(p => p !== preprocessor)
          : [...(prev.config.preprocessors || []), preprocessor],
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Document Extractor Configuration</DialogTitle>
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
                onValueChange={(value: DocumentType) => setNodeData(prev => ({
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
              <Label>Extraction Methods</Label>
              <div className="flex flex-wrap gap-2">
                {EXTRACTION_METHODS.map(method => (
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
              <Label>Preprocessors</Label>
              <div className="flex flex-wrap gap-2">
                {PREPROCESSORS.map(preprocessor => (
                  <Button
                    key={preprocessor}
                    variant={nodeData.config.preprocessors?.includes(preprocessor) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => togglePreprocessor(preprocessor)}
                  >
                    {preprocessor.replace('_', ' ')}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Fields Configuration */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addField}
                className="h-8"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>
            <div className="space-y-4">
              {nodeData.config.fields.map((field, index) => (
                <div key={index} className="flex gap-2 items-start border rounded-lg p-4">
                  <div className="flex-1 space-y-4">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Name</Label>
                        <Input
                          value={field.name}
                          onChange={(e) => updateField(index, { name: e.target.value })}
                          placeholder="Field name"
                        />
                      </div>
                      <div className="flex-1">
                        <Label>Label</Label>
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(index, { label: e.target.value })}
                          placeholder="Display label"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label>Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value: FieldExtraction['type']) =>
                            updateField(index, { type: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1">
                        <Label>Method</Label>
                        <Select
                          value={field.method}
                          onValueChange={(value: ExtractionMethod) =>
                            updateField(index, { method: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EXTRACTION_METHODS.map(method => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {field.method === 'template_matching' && (
                      <div className="space-y-2">
                        <Label>Template Region</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            placeholder="X"
                            value={field.template?.region?.x || ''}
                            onChange={(e) => updateField(index, {
                              template: {
                                ...field.template,
                                region: field.template?.region ? {
                                  ...field.template.region,
                                  x: parseInt(e.target.value),
                                } : {
                                  x: parseInt(e.target.value),
                                  y: 0,
                                  width: 0,
                                  height: 0,
                                },
                              },
                            })}
                          />
                          <Input
                            type="number"
                            placeholder="Y"
                            value={field.template?.region?.y || ''}
                            onChange={(e) => updateField(index, {
                              template: {
                                ...field.template,
                                region: field.template?.region ? {
                                  ...field.template.region,
                                  y: parseInt(e.target.value),
                                } : {
                                  x: 0,
                                  y: parseInt(e.target.value),
                                  width: 0,
                                  height: 0,
                                },
                              },
                            })}
                          />
                          <Input
                            type="number"
                            placeholder="Width"
                            value={field.template?.region?.width || ''}
                            onChange={(e) => updateField(index, {
                              template: {
                                ...field.template,
                                region: field.template?.region ? {
                                  ...field.template.region,
                                  width: parseInt(e.target.value),
                                } : {
                                  x: 0,
                                  y: 0,
                                  width: parseInt(e.target.value),
                                  height: 0,
                                },
                              },
                            })}
                          />
                          <Input
                            type="number"
                            placeholder="Height"
                            value={field.template?.region?.height || ''}
                            onChange={(e) => updateField(index, {
                              template: {
                                ...field.template,
                                region: field.template?.region ? {
                                  ...field.template.region,
                                  height: parseInt(e.target.value),
                                } : {
                                  x: 0,
                                  y: 0,
                                  width: 0,
                                  height: parseInt(e.target.value),
                                },
                              },
                            })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(checked) => updateField(index, { required: checked })}
                        />
                        <Label>Required</Label>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(index)}
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
            <div className="flex items-center justify-between">
              <Label>Validate Extraction</Label>
              <Switch
                checked={nodeData.config.validateExtraction || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    validateExtraction: checked,
                  },
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Confidence Threshold (0-1)</Label>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={nodeData.config.confidenceThreshold || ''}
                onChange={(e) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    confidenceThreshold: e.target.value ? parseFloat(e.target.value) : undefined,
                  },
                }))}
                placeholder="0.8"
              />
            </div>

            <div className="space-y-2">
              <Label>Output Format</Label>
              <Select
                value={nodeData.config.outputFormat || 'json'}
                onValueChange={(value: 'json' | 'xml' | 'csv') => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    outputFormat: value,
                  },
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="xml">XML</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Include Original Image</Label>
              <Switch
                checked={nodeData.config.includeOriginalImage || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    includeOriginalImage: checked,
                  },
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Include Field Images</Label>
              <Switch
                checked={nodeData.config.includeFieldImages || false}
                onCheckedChange={(checked) => setNodeData(prev => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    includeFieldImages: checked,
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