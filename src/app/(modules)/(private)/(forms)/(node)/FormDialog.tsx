'use client';

import { useCallback, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, ChevronDown, Pencil } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { FormConfig as DBFormConfig } from '@/types/form';
import { DialogProps } from '../../(workflows)/(components)/nodes/types';
import { FormBuilder } from '../(components)/form-builder';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { VariableInput } from '@/components/ui/variable-input';
import { useNodeConfig, useNodeData } from '../../(workflows)/(components)/WorkflowContext';
import { FormNodeData } from '../types';
import { createForm, listForms, updateForm } from '../(actions)/actions';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Form } from '@/lib/entities/tenant/form.entity';

// UI Form Config type (different from database FormConfig)
interface UIFormConfig {
  id: string;
  name: string;
  description?: string;
  variables: Record<string, {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
    required?: boolean;
    defaultValue?: unknown;
  }>;
  components: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
  }>;
  validation?: Record<string, any>;
}

// Query keys
export const formKeys = {
  all: ['forms'] as const,
  lists: () => [...formKeys.all, 'list'] as const,
  list: (filters: any) => [...formKeys.lists(), { filters }] as const,
  details: () => [...formKeys.all, 'detail'] as const,
  detail: (id: string) => [...formKeys.details(), id] as const,
};

// Queries
export const useFormsList = () => {
  return useQuery({
    queryKey: formKeys.lists(),
    queryFn: () => listForms(),
  });
};

// Mutations
export const useCreateForm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; config: UIFormConfig }) =>
      createForm({
        name: data.name,
        description: data.description,
        config: {
          id: data.config.id,
          name: data.config.name,
          description: data.config.description,
          variables: data.config.variables,
          components: data.config.components,
          validation: data.config.validation,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.lists() });
      toast.success('Form saved successfully');
    },
    onError: (error) => {
      console.error('Failed to save form:', error);
      toast.error('Failed to save form');
    },
  });
};

export const useUpdateForm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; description?: string; config: UIFormConfig } }) =>
      updateForm(id, {
        name: data.name,
        description: data.description,
        config: {
          id: data.config.id,
          name: data.config.name,
          description: data.config.description,
          variables: data.config.variables,
          components: data.config.components,
          validation: data.config.validation,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.lists() });
      toast.success('Form updated successfully');
    },
    onError: (error) => {
      console.error('Failed to update form:', error);
      toast.error('Failed to update form');
    },
  });
};

interface FormNodeConfig {
  selectedForm?: string;
  config?: UIFormConfig;
  variables?: Record<string, string>;
}

const mapFormToConfig = (form: Form): UIFormConfig => {
  return {
    id: form.id,
    name: form.name,
    description: form.description,
    variables: form.config.variables || {},
    components: form.config.components || [],
    validation: form.config.validation,
  };
};

export function FormDialog({ open, onOpenChange }: DialogProps) {
  const [data, setData] = useNodeData();
  const [config, setConfig] = useNodeConfig<FormNodeData>((data?.config as FormNodeData) || { formId: '', variables: {} });
  const [name, setName] = useState(data?.name || '');
  const [loading, setLoading] = useState(false);

  const [formConfig, setFormConfig] = useState<FormNodeConfig>(() => {
    return {
      selectedForm: config.formId || undefined,
      config: {
        id: uuid(),
        name: '',
        description: '',
        variables: {},
        components: []
      },
    };
  });

  const [builderOpen, setBuilderOpen] = useState(false);
  const [newForm, setNewForm] = useState<UIFormConfig | null>(null);

  // Queries
  const { data: forms = [] } = useFormsList();
  const createFormMutation = useCreateForm();
  const updateFormMutation = useUpdateForm();

  const updateState = useCallback((e: UIFormConfig) => {
    const events = data?.events.map(evt => {
      if (evt.name === 'form_submitted') {
        return {
          name: 'form_submitted',
          outputs: Object.entries(generateFormSchema(e)).map(([key, value]) => ({
            name: key,
            type: value.type,
          })),
        };
      }

      return evt;
    }) as any[];

    const variables = Object.entries(e.variables || {}).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: '',
    }), {});

    setData(d => ({
      ...d,
      config: {
        formId: e.id,
        variables,
      },
      name,
      events,
    }));
  }, [setData, name, data?.events]);

  const getCurrentConfig = useCallback(() => {
    if (formConfig.selectedForm) {
      const selectedForm = forms.find(f => f.id === formConfig.selectedForm);
      return selectedForm ? mapFormToConfig(selectedForm) : formConfig.config;
    }
    return formConfig.config;
  }, [formConfig, forms]);

  const generateFormSchema = useCallback((config: UIFormConfig) => {
    const schema: Record<string, { type: string }> = {};

    config.components.forEach(component => {
      if ('config' in component && 'label' in component.config) {
        const fieldId = component.id;
        let fieldType = 'string';

        switch (component.type) {
          case 'number':
          case 'range':
            fieldType = 'number';
            break;
          case 'checkbox':
            fieldType = 'boolean';
            break;
          case 'multiselect':
            fieldType = 'array';
            break;
          case 'date':
            fieldType = 'date';
            break;
        }

        schema[fieldId] = { type: fieldType };
      }
    });

    return schema;
  }, []);

  const handleSaveForm = async (form: UIFormConfig) => {
    try {
      setLoading(true);
      let result;
      
      // If we're editing an existing form, use its ID
      if (formConfig.selectedForm && form.id === formConfig.selectedForm) {
        result = await updateFormMutation.mutateAsync({
          id: form.id,
          data: {
            name: form.name,
            description: form.description,
            config: form
          }
        });
      } else {
        // For new forms, generate a new ID
        const newForm = {
          ...form,
          id: uuid(),
        };
        result = await createFormMutation.mutateAsync({
          name: newForm.name,
          description: newForm.description,
          config: newForm
        });
      }
      
      // Update the form selection with the saved form
      setFormConfig(prev => ({
        ...prev,
        selectedForm: result.id,
        config: mapFormToConfig(result),
      }));
      
      // Update the node config with the new form
      updateState(mapFormToConfig(result));
      
      setBuilderOpen(false);
    } catch (error) {
      // Error is handled by the mutation
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Form Configuration</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[calc(100vh-20rem)]">
            <div className="grid grid-cols-1 gap-4 h-full">
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
                      onValueChange={(value) => {
                        const selectedForm = forms.find(f => f.id === value);
                        const cnf = selectedForm ? mapFormToConfig(selectedForm) : formConfig.config;
                        setFormConfig(c => ({
                          ...c,
                          selectedForm: value,
                          config: cnf,
                        }));

                        updateState(cnf!);
                      }}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select a form" />
                      </SelectTrigger>
                      <SelectContent>
                        {forms.map((form) => (
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
                          id: uuid(),
                          name: 'New Form',
                          description: '',
                          variables: {},
                          components: []
                        });
                        setBuilderOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {formConfig.selectedForm && (
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          const selectedForm = forms.find(f => f.id === formConfig.selectedForm);
                          if (selectedForm) {
                            setNewForm(mapFormToConfig(selectedForm));
                            setBuilderOpen(true);
                          }
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {formConfig.config && (
                  <>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="form-details">
                        <AccordionTrigger className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4" />
                          <Label>Form Details</Label>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="rounded-lg border bg-muted/50 p-4 mt-2">
                            <div className="text-sm font-medium">{formConfig.config.name}</div>
                            {formConfig.config.description && (
                              <div className="mt-1 text-sm text-muted-foreground">
                                {formConfig.config.description}
                              </div>
                            )}
                            <div className="mt-4 space-y-2">
                              {formConfig.config.components.map((component) => {
                                const config = component.config as { label: string; required?: boolean };
                                return (
                                  <div key={component.id} className="text-sm">
                                    • {config.label} ({component.type})
                                    {config.required && ' *'}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                    {Object.entries(formConfig.config?.variables || {}).length > 0 && (
                      <div className="space-y-2">
                        <Label>Form Variables</Label>
                        <div className="space-y-4">
                          {Object.entries(formConfig?.config?.variables || {}).map(([key, variable]) => (
                            <div key={key}>
                              <Label className="text-sm">{variable.name}</Label>
                              <VariableInput
                                value={config.variables?.[key] || ''}
                                onChange={(value) => {
                                  setConfig(prev => ({
                                    ...prev,
                                    variables: {
                                      ...prev.variables,
                                      [key]: value
                                    }
                                  }));
                                }}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {variable.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateState(getCurrentConfig()!)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog 
        open={builderOpen} 
        onOpenChange={(open) => {
          // Prevent dialog from closing when clicking outside
          if (open === false) return;
          setBuilderOpen(open);
        }}
      >
        <DialogContent className="max-w-7xl max-h-[95vh] p-0">
          <DialogHeader className="px-6 py-4">
            <DialogTitle>Form Builder</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
          {newForm && (
            <FormBuilder
              initialConfig={newForm}
                onSave={handleSaveForm}
              onCancel={() => setBuilderOpen(false)}
            />
          )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}