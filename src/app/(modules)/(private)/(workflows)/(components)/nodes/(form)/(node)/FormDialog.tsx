'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Plus } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { DialogProps } from '../../types';
import { FormBuilder } from '../../../../../(forms)/(components)/form-builder';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VariableInput } from '@/components/ui/variable-input';
import { useNodeConfig, useNodeData } from '../../../WorkflowContext';
import { FormNodeData } from '../types';
import { createForm, listForms, updateForm } from '../../../../../(forms)/(actions)/actions';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Form } from '@/lib/entities';
import { FormConfig } from '../../../../../(forms)/(components)/form-builder/schemas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DialogDescription } from '@radix-ui/react-dialog';

// Query keys
export const formKeys = {
  all: ['forms'] as const,
  lists: () => [...formKeys.all, 'list'] as const,
  list: (filters: any) => [...formKeys.lists(), { filters }] as const,
  details: () => [...formKeys.all, 'detail'] as const,
  detail: (id: string) => [...formKeys.details(), id] as const,
};

// Default empty form config
const defaultFormConfig: FormConfig = {
  id: '', // Will be set when creating a new form
  name: '',
  description: '',
  variables: {},
  components: [],
  // validation: {},
};

// Queries
export const useFormsList = () => {
  return useQuery({
    queryKey: formKeys.lists(),
    queryFn: () => listForms(),
  });
};

// Helper to map Form entity to FormConfig for the builder
const mapFormToConfig = (form: Form): FormConfig => {
  // Ensure config exists and has expected structure, provide defaults if not
  const config = form.config || {};
  return {
    id: form.id, // Use the actual form ID
    name: form.name || '',
    description: form.description || '',
    variables: config.variables || {},
    components: config.components || [],
    // validation: config.validation || {}, // Make sure validation exists
  };
};

// Helper to check if form has unsaved changes
const formHasChanges = (original: FormConfig | null | undefined, current: FormConfig | null | undefined): boolean => {
  if (!original || !current) return false; // Consider new form as having changes if not empty
  // Simple string comparison, could be more robust
  return JSON.stringify(original) !== JSON.stringify(current);
};

// Mutations
export const useCreateForm = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; config: FormConfig }) =>
      createForm({
        name: data.name,
        description: data.description,
        config: {
          id: data.config.id,
          name: data.config.name,
          description: data.config.description,
          variables: data.config.variables,
          components: data.config.components,
          validation: data.config.validation as any,
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
    mutationFn: ({ id, data }: { id: string; data: { name: string; description?: string; config: FormConfig } }) =>
      updateForm(id, {
        name: data.name,
        description: data.description,
        config: {
          id: data.config.id,
          name: data.config.name,
          description: data.config.description,
          variables: data.config.variables,
          components: data.config.components,
          validation: data.config.validation as any,
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

interface FormNodeConfig { // This interface might be redundant now, keeping for reference
  selectedForm?: string;
  config?: FormConfig;
  variables?: Record<string, string>;
}

export function FormDialog({ open, onOpenChange }: DialogProps) {
  const [data, setData] = useNodeData();
  const [config, setConfig] = useNodeConfig<FormNodeData>((data?.config as FormNodeData) || { formId: '', variables: {} });
  const [nodeName, setNodeName] = useState(data?.name || '');

  // State for the form builder
  const [selectedFormId, setSelectedFormId] = useState<string | 'new'>(config.formId || 'new');
  const [currentFormDefinition, setCurrentFormDefinition] = useState<FormConfig | null>(null);
  const [originalFormDefinition, setOriginalFormDefinition] = useState<FormConfig | null>(null);
  const [formBuilderKey, setFormBuilderKey] = useState(uuid()); // Key to force re-render

  // Queries & Mutations
  const { data: forms = [], isLoading: isLoadingForms } = useFormsList();
  const createFormMutation = useCreateForm();
  const updateFormMutation = useUpdateForm();

  // Effect to load form definition when selectedFormId changes or forms data is loaded
  useEffect(() => {
    if (isLoadingForms) return;

    let formToLoad: FormConfig | null = null;

    if (selectedFormId === 'new') {
      formToLoad = { ...defaultFormConfig, id: uuid(), name: 'New Form' }; // Create a fresh default form
    } else {
      const selectedForm = forms.find(f => f.id === selectedFormId);
      if (selectedForm) {
        formToLoad = mapFormToConfig(selectedForm);
      } else if (config.formId && selectedFormId === config.formId) {
        // If the initial formId from config doesn't match any loaded forms (maybe deleted?), fallback to new
        console.warn(`Form with ID ${config.formId} not found, falling back to new form.`);
        setSelectedFormId('new');
        formToLoad = { ...defaultFormConfig, id: uuid(), name: 'New Form' };
      } else if (!selectedFormId) {
        // No form selected yet, default to 'new'
        setSelectedFormId('new');
        formToLoad = { ...defaultFormConfig, id: uuid(), name: 'New Form' };
      }
    }

    if (formToLoad) {
      setCurrentFormDefinition(formToLoad);
      setOriginalFormDefinition(JSON.parse(JSON.stringify(formToLoad))); // Deep copy for change detection
      setFormBuilderKey(uuid()); // Force FormBuilder remount
    }
  }, [selectedFormId, forms, isLoadingForms, config.formId]);

  // Effect to update node config when form definition changes (specifically variables)
  useEffect(() => {
    if (currentFormDefinition && currentFormDefinition.id === config.formId) {
      const currentVariables = Object.keys(config.variables || {});
      const formVariables = Object.keys(currentFormDefinition.variables || {});

      const newVariables = formVariables.reduce((acc, key) => {
        acc[key] = config.variables?.[key] || ''; // Keep existing values, add new ones as empty
        return acc;
      }, {} as Record<string, string>);

      // Only update if variables structure changed
      if (JSON.stringify(newVariables) !== JSON.stringify(config.variables)) {
        setConfig(prev => ({ ...prev, variables: newVariables }));
      }
    }
  }, [currentFormDefinition, config.formId, config.variables, setConfig]);

  const hasUnsavedChanges = formHasChanges(originalFormDefinition, currentFormDefinition);

  const handleSelectChange = (value: string) => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes in the current form. Are you sure you want to switch? Changes will be lost.')) {
        return; // Prevent switching
      }
    }
    setSelectedFormId(value);
    const formConfig = forms?.find(f => f.id === value);
    if (formConfig) {
      setCurrentFormDefinition(formConfig.config);
      setOriginalFormDefinition(JSON.parse(JSON.stringify(formConfig.config)));
    }
  };

  const handleSaveForm = useCallback(async () => {
    if (!currentFormDefinition) {
      toast.error('No form definition to save.');
      return;
    }
    if (!currentFormDefinition.name?.trim()) {
      toast.error('Form name cannot be empty.');
      return;
    }

    const dataToSave = {
      name: currentFormDefinition.name,
      description: currentFormDefinition.description,
      config: currentFormDefinition,
    };

    try {
      let savedForm: Form | undefined;
      if (selectedFormId === 'new' || !forms.find(f => f.id === currentFormDefinition.id)) {
        // It's either explicitly 'new' or the ID doesn't exist in the fetched list (might be a newly generated UUID)
        savedForm = await createFormMutation.mutateAsync(dataToSave);
        if (savedForm) {
          setSelectedFormId(savedForm.id); // Switch from 'new' to the actual ID
          // Update config immediately only if node had no form selected before
          if (!config.formId) {
            setConfig(prev => ({ ...prev, formId: savedForm!.id }));
          }
        }
      } else {
        savedForm = await updateFormMutation.mutateAsync({ id: currentFormDefinition.id, data: dataToSave });
      }

      if (savedForm) {
        // Update original definition after successful save
        setOriginalFormDefinition(JSON.parse(JSON.stringify(currentFormDefinition)));
      }
    } catch (error) {
      // Error handling is done within the mutation hooks
    }
  }, [createFormMutation, updateFormMutation, setConfig, selectedFormId, nodeName]);

  const handleFormDefinitionChange = useCallback((newDefinition: FormConfig) => {
    setCurrentFormDefinition(newDefinition);
    // Update node name only if it's a new form and name hasn't been manually set
    handleSaveForm();
  }, [selectedFormId, nodeName, handleSaveForm]);

  const handleResetForm = () => {
    if (originalFormDefinition) {
      setCurrentFormDefinition(JSON.parse(JSON.stringify(originalFormDefinition))); // Deep copy reset
      setFormBuilderKey(uuid()); // Force re-render
      toast.info('Form reset to last saved state.');
    } else {
      toast.error('Cannot reset form.');
    }
  };

  // Update Node Data when saving the dialog
  const onSave = useCallback(() => {
    if (!currentFormDefinition?.id || selectedFormId === 'new') {
      toast.error('Please select or save a form before saving the node.');
      return;
    }

    const finalFormId = currentFormDefinition.id;

    const events = data?.events.map(evt => {
      if (evt.name === 'form_submitted' && currentFormDefinition) {
        const outputs = Object.entries(generateFormSchema(currentFormDefinition)).map(([key, value]) => ({ // Use generateFormSchema
          name: key,
          type: value.type,
        }));

        return {
          name: 'form_submitted',
          outputs: [
            ...outputs,
            { name: 'form_id', type: 'string' },
            { name: 'instance_id', type: 'string' },
            { name: 'answers_id', type: 'string' },
          ],
        };
      }
      return evt;
    }) as any[];

    // Ensure variables in config match the latest form definition variables
    const formVariables = Object.keys(currentFormDefinition.variables || {}).reduce((acc, key) => {
      acc[key] = config.variables?.[key] || ''; // Keep existing values, add new ones as empty
      return acc;
    }, {} as Record<string, string>);


    setData(d => ({
      ...d,
      name: nodeName,
      config: {
        ...config,
        formId: finalFormId,
        variables: formVariables, // Use updated variables
      },
      events,
    }));
    onOpenChange(false);
  }, [data, nodeName, setData, onOpenChange, currentFormDefinition, config, setConfig, selectedFormId]);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNodeName(event.target.value);
  };

  const generateFormSchema = useCallback((config: FormConfig) => {
    const schema: Record<string, { type: string }> = {};

    config.components.forEach(component => {
      if ('config' in component && 'label' in component.config) {
        const fieldId = component.config.propertyName;
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

  // Prepare variables for the configuration tab
  const formVariables = currentFormDefinition?.variables ? Object.entries(currentFormDefinition.variables) : [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      onOpenChange(isOpen);
    }}>
      <DialogContent className="h-[95vh] w-[95vw] max-w-[95vw] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            <Input
              value={nodeName}
              onChange={handleNameChange}
              className="text-lg font-semibold border-none focus-visible:ring-1 focus-visible:ring-ring p-1 h-auto"
              placeholder="Form Node Name"
            />
          </DialogTitle>
          <DialogDescription>
            Select or create a form, then configure its input variables.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="form" className="flex-grow flex flex-col min-h-0 h-full w-full">
          <TabsList className="shrink-0">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="config" disabled={!currentFormDefinition?.id || selectedFormId === 'new'}>
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* Form Tab: Selection and Builder */}
          <TabsContent value="form" className="flex-grow flex flex-col min-h-0 p-0 pt-4">
            <div className="flex items-center gap-2 mb-4 px-6 shrink-0">
              <Label htmlFor="form-select" className="whitespace-nowrap">Select Form:</Label>
              <Select
                value={selectedFormId}
                onValueChange={handleSelectChange}
                disabled={isLoadingForms}
              >
                <SelectTrigger id="form-select" className="flex-grow">
                  <SelectValue placeholder="Select a form or create new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    <div className="flex items-center">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Form
                    </div>
                  </SelectItem>
                  {forms?.map(form => (<SelectItem key={form.id} value={form.id}>{form.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            {/* Form Builder Area */}
            <ScrollArea className="flex-grow min-h-0 px-6 pb-6">
              {currentFormDefinition ? (
                <FormBuilder
                  key={formBuilderKey} // Use key to force re-render on reset/load
                  initialConfig={currentFormDefinition}
                  onSave={config => {
                    handleFormDefinitionChange(config);
                  }}
                  onCancel={handleResetForm}
                />
              ) : (
                <div className="text-center text-gray-500 py-10">{isLoadingForms ? 'Loading forms...' : 'Select a form or create a new one.'}</div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Configuration Tab: Variable Inputs */}
          <TabsContent value="config" className="flex-grow flex flex-col p-6">
            {currentFormDefinition && selectedFormId !== 'new' ? (
              formVariables.length > 0 ? (
                <>
                  {formVariables.map(([key, variable]) => (
                    <div key={key} className="flex items-center gap-4">
                      <Label htmlFor={key} className="text-right col-span-1">
                        {variable.name || key}
                      </Label>
                      <div className="flex flex-col gap-2">
                        <VariableInput
                          value={config.variables?.[key] || ''}
                          onChange={(value) => setConfig(c => ({
                            ...c,
                            variables: {
                              ...c.variables,
                              [key]: value,
                            },
                          }))}
                        />
                        {variable.description && <p className="text-sm text-muted-foreground mt-1">{variable.description}</p>}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground">This form does not have any input variables defined.</p>
              )
            ) : (
              <p className="text-muted-foreground">Select and save a form to configure its variables.</p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-auto shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={onSave}
            disabled={selectedFormId === 'new' || !currentFormDefinition?.id || createFormMutation.isPending || updateFormMutation.isPending}
          >
            Save Node
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}