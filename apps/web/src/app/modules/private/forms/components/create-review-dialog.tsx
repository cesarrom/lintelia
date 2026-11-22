import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FormInstance } from '@repo/lintelia/schemas';
import { useReviewsCreateReviewMutation } from '@/lib/services/reviews.hook';

interface CreateReviewDialogProps {
  instance: FormInstance | null;
  answerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateReviewDialog({
  instance,
  answerId,
  open,
  onOpenChange,
}: CreateReviewDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutateAsync: createReview } = useReviewsCreateReviewMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instance) return;

    try {
      setIsSubmitting(true);
      
      // If answerId is provided, we're creating a review for a specific answer
      // Otherwise, we'll create a review for all answers in the instance
      const reviewItems = answerId 
        ? [{ answer_id: answerId }]
        : Object.keys(instance.answers || {}).map(answer_id => ({ answer_id }));

      await createReview({
        title,
        description,
        reviewItems,
      });

      toast('The review has been created successfully.');
      
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create review:', error);
      toast('Failed to create review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Review</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter review title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter review description"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create Review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 