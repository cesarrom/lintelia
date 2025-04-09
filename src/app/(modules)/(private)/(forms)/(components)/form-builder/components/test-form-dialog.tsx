'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { JsonEditor } from '@/components/ui/json-editor';
import { createTestFormInstance } from '../../../(actions)/actions';
import { toast } from 'sonner';
import { FormConfig } from '../schemas';
import { useRouter } from 'next/navigation';

interface TestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formId: string;
  formConfig: FormConfig;
  mode?: 'test' | 'create';
}

export function TestFormDialog({ 
  open, 
  onOpenChange, 
  formId, 
  formConfig,
  mode = 'test' 
}: TestFormDialogProps) {
  const router = useRouter();
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const hasVariables = formConfig.variables && Object.keys(formConfig.variables).length > 0;

  const validateJsonInput = (value: string, type: string): string | null => {
    if (type === 'object' || type === 'array') {
      try {
        JSON.parse(value);
        return null;
      } catch (e) {
        return 'Invalid JSON format';
      }
    }
    return null;
  };

  const handleVariableChange = (variableId: string, value: string) => {
    setVariableValues(prev => ({
      ...prev,
      [variableId]: value
    }));

    const type = formConfig.variables[variableId].type;
    const error = validateJsonInput(value, type);
    
    setValidationErrors(prev => ({
      ...prev,
      [variableId]: error || ''
    }));
  };

  const parseVariableValue = (value: string, type: string) => {
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true';
      case 'object':
      case 'array':
        try {
          return JSON.parse(value);
        } catch (e) {
          return value;
        }
      default:
        return value;
    }
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);

      // Validate required variables and JSON format
      if (hasVariables) {
        const errors: Record<string, string> = {};
        let hasErrors = false;

        Object.entries(formConfig.variables).forEach(([id, config]) => {
          if (config.required && !variableValues[id]) {
            errors[id] = 'This field is required';
            hasErrors = true;
          }
          
          if ((config.type === 'object' || config.type === 'array') && variableValues[id]) {
            try {
              JSON.parse(variableValues[id]);
            } catch (e) {
              errors[id] = 'Invalid JSON format';
              hasErrors = true;
            }
          }
        });

        if (hasErrors) {
          setValidationErrors(errors);
          toast.error('Please fix the validation errors');
          return;
        }
      }

      // Parse all values at submission time
      const parsedValues = Object.entries(variableValues).reduce((acc, [id, value]) => ({
        ...acc,
        [id]: parseVariableValue(value, formConfig.variables[id].type)
      }), {});

      const instance = await createTestFormInstance(formId, parsedValues);

      if (mode === 'test') {
        // Open the form in a new tab for test mode
        const url = `${window.location.origin}/forms/${formId}/instances/${instance.id}/answers/new`;
        window.open(url, '_blank');
      } else {
        // Just show success message for create mode
        toast.success('Form instance created successfully');
      }

      router.refresh();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Failed to create form instance: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'test' ? 'Test Form' : 'Create Form Instance'}</DialogTitle>
        </DialogHeader>

        {hasVariables ? (
          <div className="space-y-4">
            {Object.entries(formConfig.variables).map(([variableId, config]) => (
              <div key={variableId} className="space-y-2">
                <Label>
                  {config.name}
                  {config.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {config.description && (
                  <p className="text-sm text-muted-foreground">{config.description}</p>
                )}
                {config.type === 'object' || config.type === 'array' ? (
                  <JsonEditor
                    value={variableValues[variableId] || ''}
                    onChange={(value) => handleVariableChange(variableId, value)}
                    placeholder={`Enter ${config.name.toLowerCase()}`}
                    error={validationErrors[variableId]}
                  />
                ) : (
                  <Input
                    value={variableValues[variableId] || ''}
                    onChange={(e) => handleVariableChange(variableId, e.target.value)}
                    placeholder={`Enter ${config.name.toLowerCase()}`}
                    required={config.required}
                  />
                )}
                {validationErrors[variableId] && config.type !== 'object' && config.type !== 'array' && (
                  <p className="text-sm text-red-500">{validationErrors[variableId]}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This form doesn't require any variables.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Creating...' : mode === 'test' ? 'Test Form' : 'Create Instance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}