'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { TestFormDialog } from './form-builder/components/test-form-dialog';
import type { Form, FormConfig } from '@repo/fintivio/schemas';

interface CreateInstanceButtonProps {
  form: Form;
}

export default function CreateInstanceButton({ form }: CreateInstanceButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Instance
      </Button>

      <TestFormDialog
        open={open}
        onOpenChange={setOpen}
        formId={form.id!}
        formConfig={form.config as unknown as FormConfig}
        mode="create"
      />
    </>
  );
} 