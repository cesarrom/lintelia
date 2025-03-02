'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Calendar,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { getAssignedReviews } from '../../../(actions)/actions';
import { useAuth } from '@/lib/auth/AuthContext';
import ViewReviewDialog from '../reviews/components/view-review-dialog';
import { Review } from '@/lib/entities/tenant/review.entity';

export default function MyReviewsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user?.userId) return;
      
      try {
        const assignedReviews = await getAssignedReviews(user.userId);
        setReviews(assignedReviews);
      } catch (error) {
        console.error('Failed to fetch assigned reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [user]);

  const handleView = (review: Review) => {
    setSelectedReview(review);
    setIsViewDialogOpen(true);
  };

  const handleViewDetails = (id: string) => {
    router.push(`/reviews/${id}`);
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
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Reviews</h1>
        <p className="text-muted-foreground mt-2">
          Reviews assigned to you that require your attention
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading your reviews...</div>
      ) : reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <Card key={review.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{review.title}</CardTitle>
                  {getStatusBadge(review.status)}
                </div>
                {review.description && (
                  <CardDescription className="line-clamp-2">
                    {review.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <Calendar className="h-4 w-4 mr-2" />
                    Created: {format(new Date(review.createdAt), 'MMM d, yyyy')}
                  </div>
                  {review.dueDate && (
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-amber-500" />
                      Due: {format(new Date(review.dueDate), 'MMM d, yyyy')}
                    </div>
                  )}
                  <div className="text-sm">
                    Items: {review.reviewItems.length}
                  </div>
                </div>
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleView(review)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Quick View
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => handleViewDetails(review.id)}
                  >
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">You don't have any reviews assigned to you.</p>
            <Button onClick={() => router.push('/reviews')}>
              View All Reviews
            </Button>
          </CardContent>
        </Card>
      )}

      <ViewReviewDialog
        review={selectedReview}
        open={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
      />
    </div>
  );
} 