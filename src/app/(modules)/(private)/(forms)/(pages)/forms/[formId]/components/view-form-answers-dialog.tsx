'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormInstance } from '@/lib/entities/tenant';
import { FormViewer } from '@/app/(modules)/(private)/(forms)/(components)/form-builder';

interface ViewFormAnswersDialogProps {
  instance: FormInstance | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewFormAnswersDialog({
  instance,
  open,
  onOpenChange,
}: ViewFormAnswersDialogProps) {
  if (!instance) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Form Answers</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <FormViewer
            config={instance.form.config}
            initialValues={instance.answers}
            variables={{
              values: instance.variables,
              definitions: instance.form.config.variables || {},
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
} 