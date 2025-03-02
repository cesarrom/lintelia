'use client';

import { useState } from 'react';
import { Review } from '@/lib/entities/tenant/review.entity';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  User,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { assignReview } from '../../../(actions)/actions';
import { useAuth } from '@/lib/auth/AuthContext';
import ViewReviewDialog from './view-review-dialog';

interface ReviewsTableProps {
  reviews: Review[];
}

export default function ReviewsTable({ reviews }: ReviewsTableProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const handleAssign = async (id: string) => {
    if (!user?.userId) return;
    
    if (confirm('Are you sure you want to assign this review to yourself?')) {
      await assignReview(id, user.userId);
      router.refresh();
    }
  };

  const handleView = (review: Review) => {
    setSelectedReview(review);
    setIsViewDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> In Progress</Badge>;
      case 'approved':
        return <Badge variant="success" className="bg-green-500 hover:bg-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      case 'additional_data_requested':
        return <Badge variant="warning" className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Data Requested</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => (
            <TableRow key={review.id}>
              <TableCell className="font-medium">{review.title}</TableCell>
              <TableCell>{getStatusBadge(review.status)}</TableCell>
              <TableCell>
                {review.assignedTo ? (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{review.assignedTo}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </TableCell>
              <TableCell>{format(new Date(review.createdAt), 'MMM d, yyyy')}</TableCell>
              <TableCell>
                {review.dueDate ? (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(review.dueDate), 'MMM d, yyyy')}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">No deadline</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleView(review)}
                  >
                    <Eye className="h-4 w-4" />
                    <span className="sr-only">View</span>
                  </Button>
                  {review.status === 'pending' && !review.assignedTo && user?.userId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssign(review.id)}
                    >
                      Assign to me
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {reviews.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-6">
                No reviews found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ViewReviewDialog
        review={selectedReview}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </>
  );
} 