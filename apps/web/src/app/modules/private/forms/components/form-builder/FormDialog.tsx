'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormBuilder } from '.';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Form, FormConfig } from '@repo/fintivio/schemas';
import { useFormCreateForm, useFormUpdateForm } from '@/lib/services/form.hooks';
import { useQueryClient } from '@tanstack/react-query';

interface FormDialogProps {
  form?: Form | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormDialog({ form, open, onOpenChange }: FormDialogProps) {
  const [name, setName] = useState(form?.name || '');
  const [description, setDescription] = useState(form?.description || '');
  const [config, setConfig] = useState<FormConfig>((form?.config || { components: [] }) as any);
  const [isSaving, setIsSaving] = useState(false);
  const { mutateAsync: createForm } = useFormCreateForm();
  const { mutateAsync: updateForm } = useFormUpdateForm();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      setConfig(form.config);
    } else {
      setName('');
      setDescription('');
      setConfig({ fields: [] } as any);
    }
  }, [form]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      if (form) {
        await updateForm({ id: form.id!, data: { name, description, config } });
        toast('The form has been updated successfully.');
      } else {
        await createForm({ name, description, config });
        toast('The form has been created successfully.');
      }
      await queryClient.invalidateQueries({ queryKey: ['form'] });
      onOpenChange(false);
    } catch (error) {
      toast.error((error as any)?.response?.data?.error ?? 'Failed to save the form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [form, name, description, config, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1400px)] max-h-[94vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{form ? 'Edit Form' : 'Create Form'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="name">Form name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter form name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter form description"
            />
          </div>

          <div className="space-y-2">
            <Label>Form Builder</Label>
            <FormBuilder key={form?.id ?? 'new'} initialConfig={form?.config ?? undefined} onChange={setConfig} embedded />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name}>
            {isSaving ? 'Saving...' : form ? 'Update Form' : 'Create Form'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 