'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { FormDialog } from '../../../(components)/form-builder/FormDialog';

export default function CreateFormButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Create Form
      </Button>

      <FormDialog
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
} 