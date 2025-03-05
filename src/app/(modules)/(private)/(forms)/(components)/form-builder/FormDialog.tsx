'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/lib/entities/tenant';
import { FormBuilder } from '.';
import { FormConfig } from './schemas';
import { createForm, updateForm } from '../../(actions)/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
    
interface FormDialogProps {
  form?: Form | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FormDialog({ form, open, onOpenChange }: FormDialogProps) {
  const [name, setName] = useState(form?.name || '');
  const [description, setDescription] = useState(form?.description || '');
  const [config, setConfig] = useState<FormConfig>(form?.config || { fields: [] });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (form) {
      setName(form.name);
      setDescription(form.description || '');
      setConfig(form.config);
    } else {
      setName('');
      setDescription('');
      setConfig({ fields: [] });
    }
  }, [form]);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      if (form) {
        await updateForm(form.id, { name, description, config });
        toast({
          title: 'Form updated',
          description: 'The form has been updated successfully.',
        });
      } else {
        await createForm({ name, description, config });
        toast({
          title: 'Form created',
          description: 'The form has been created successfully.',
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save the form. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [form, name, description, config, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{form ? 'Edit Form' : 'Create Form'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
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
            <FormBuilder config={config} onChange={setConfig} />
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