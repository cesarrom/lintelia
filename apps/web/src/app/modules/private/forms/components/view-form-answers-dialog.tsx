'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList } from 'lucide-react';
import CreateReviewDialog from './create-review-dialog';
import { FormViewer } from './form-builder';
import type { FormInstance } from '@repo/lintelia/schemas';
import { useFormGetFormById } from '@/lib/services/form.hooks';

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
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | undefined>();
  const [isCreateReviewOpen, setIsCreateReviewOpen] = useState(false);
  const { data: form, isLoading } = useFormGetFormById({ id: instance?.formId || '', enabled: !!instance })

  if (!instance) return null;

  const handleCreateReview = (answerId: string) => {
    setSelectedAnswerId(answerId);
    setIsCreateReviewOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Form Answers</DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            {Object.entries(instance.answers || {}).map(([answerId, answer]) => (
              <div key={answerId} className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Answer {answerId}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCreateReview(answerId)}
                  >
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Create Review
                  </Button>
                </div>
                <FormViewer
                  config={form.config}
                  initialValues={answer}
                  readOnly
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <CreateReviewDialog
        instance={instance}
        answerId={selectedAnswerId}
        open={isCreateReviewOpen}
        onOpenChange={setIsCreateReviewOpen}
      />
    </>
  );
} 