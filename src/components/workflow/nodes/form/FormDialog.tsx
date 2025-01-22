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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { FormBuilder } from '@/components/form-builder/FormBuilder';
import { DialogProps } from '../types';
import { FormConfig } from '@/components/form-builder/types';

// Mock forms data - later this will come from an API
const MOCK_FORMS: FormConfig[] = [
  {
    id: 'contact',
    name: 'Contact Form',
    description: 'Basic contact form with name, email, and message',
    fields: [
      {
        id: 'name',
        type: 'text',
        label: 'name',
        required: true,
      },
      {
        id: 'email',
        type: 'email',
        label: 'email',
        required: true,
      },
      {
        id: 'message',
        type: 'text',
        label: 'Message',
        required: true,
      },
    ],
  },
  {
    id: 'signup',
    name: 'Sign Up Form',
    description: 'User registration form with account details',
    fields: [
      {
        id: 'username',
        type: 'text',
        label: 'Username',
        required: true,
      },
      {
        id: 'email',
        type: 'email',
        label: 'Email',
        required: true,
      },
      {
        id: 'password',
        type: 'password',
        label: 'Password',
        required: true,
      },
    ],
  },
];

interface FormNodeConfig {
  selectedForm?: string;
  config?: FormConfig;
}

export function FormDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const [name, setName] = useState(data.name);
  const [formConfig, setFormConfig] = useState<FormNodeConfig>(() => {
    if (data.config?.form) {
      return data.config.form as FormNodeConfig;
    }
    return {};
  });

  // State for the form builder dialog
  const [builderOpen, setBuilderOpen] = useState(false);
  const [newForm, setNewForm] = useState<FormConfig | null>(null);

  const handleSave = (e: FormConfig) => {
    onSave({
      ...data,
      name,
      config: {
        ...data.config,
        form: e,
      },
    });
    onOpenChange(false);
  };

  return (
    <>
      {/* Main Form Dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Form Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Node Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter node name"
              />
            </div>
            <div className="space-y-2">
              <Label>Select Form</Label>
              <div className="flex gap-2">
                <Select
                  value={formConfig.selectedForm}
                  onValueChange={(value) => setFormConfig({
                    selectedForm: value,
                    config: MOCK_FORMS.find(f => f.id === value),
                  })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a form" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_FORMS.map((form) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setNewForm({
                      id: crypto.randomUUID(),
                      name: 'New Form',
                      fields: [],
                    });
                    setBuilderOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {formConfig.config && (
              <div className="space-y-2">
                <Label>Form Preview</Label>
                <div className="rounded-lg border bg-muted/50 p-4">
                  <div className="text-sm font-medium">{formConfig.config.name}</div>
                  {formConfig.config.description && (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formConfig.config.description}
                    </div>
                  )}
                  <div className="mt-4 space-y-2">
                    {formConfig.config.fields.map((field) => (
                      <div key={field.id} className="text-sm">
                        • {field.label} ({field.type})
                        {field.required && ' *'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => handleSave(formConfig.config!)}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Builder Dialog */}
      <Dialog
        open={builderOpen}
        onOpenChange={open => {
          console.trace('onOpenChange', open);
          if (open) {
            setBuilderOpen(open);
          }
        }}
      >
        <DialogContent className="max-w-7xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Form Builder</DialogTitle>
          </DialogHeader>
          {newForm && (
            <FormBuilder
              initialConfig={newForm}
              className="h-[calc(90vh-8rem)]"
              onSave={(e) => {
                handleSave(e);
              }}
              onCancel={() => {
                setBuilderOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
} 