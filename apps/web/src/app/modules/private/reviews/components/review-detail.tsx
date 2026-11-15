'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Review } from '@/lib/entities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Calendar,
  FileText,
  Upload,
  ArrowLeft
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  approveReview, 
  rejectReview, 
  requestAdditionalData, 
  assignReview 
} from '../../../../(actions)/actions';
import { useAuth } from '@/lib/auth/AuthContext';

interface ReviewDetailProps {
  review: Review;
}

export default function ReviewDetail({ review }: ReviewDetailProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [additionalDataRequest, setAdditionalDataRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [itemComments, setItemComments] = useState<Record<string, string>>({});

  const handleAssign = async () => {
    if (!user?.email) return;
    
    try {
      setIsSubmitting(true);
      await assignReview(review.id, user.email);
      router.refresh();
    } catch (error) {
      console.error('Failed to assign review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    try {
      setIsSubmitting(true);
      
      // Prepare review items with their status and comments
      const updatedItems = review.reviewItems.map(item => ({
        answer_id: item.answer_id,
        status: 'approved' as const,
        comments: itemComments[item.answer_id] || undefined
      }));
      
      await approveReview(review.id, {
        comments,
        reviewItems: updatedItems
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to approve review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason) return;
    
    try {
      setIsSubmitting(true);
      
      // Prepare review items with their status and comments
      const updatedItems = review.reviewItems.map(item => ({
        answer_id: item.answer_id,
        status: 'rejected' as const,
        comments: itemComments[item.answer_id] || undefined
      }));
      
      await rejectReview(review.id, {
        rejectionReason,
        comments,
        reviewItems: updatedItems
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to reject review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestAdditionalData = async () => {
    if (!additionalDataRequest) return;
    
    try {
      setIsSubmitting(true);
      await requestAdditionalData(review.id, {
        additionalDataRequest,
        comments
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to request additional data:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemCommentChange = (answerId: string, comment: string) => {
    setItemComments({
      ...itemComments,
      [answerId]: comment
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="flex items-center gap-1"><AlertCircle className="h-3 w-3" /> In Progress</Badge>;
      case 'approved':
        return <Badge className="bg-green-500 hover:bg-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Rejected</Badge>;
      case 'additional_data_requested':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Data Requested</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const canTakeAction = 
    (review.status === 'pending' || review.status === 'in_progress') && 
    (review.assignedTo === user?.email);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl flex items-center gap-2">
            Status
            <span className="ml-2">{getStatusBadge(review.status)}</span>
          </CardTitle>
          {review.status === 'pending' && !review.assignedTo && user?.email && (
            <Button 
              onClick={handleAssign}
              disabled={isSubmitting}
            >
              Assign to Me
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium mb-2">Assigned To</h3>
              <p className="flex items-center gap-2">
                {review.assignedTo ? (
                  <>
                    <User className="h-4 w-4" />
                    {review.assignedTo}
                  </>
                ) : (
                  <span className="text-muted-foreground">Unassigned</span>
                )}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Created</h3>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(review.createdAt), 'PPP p')}
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Due Date</h3>
              <p className="flex items-center gap-2">
                {review.dueDate ? (
                  <>
                    <Calendar className="h-4 w-4" />
                    {format(new Date(review.dueDate), 'PPP')}
                  </>
                ) : (
                  <span className="text-muted-foreground">No deadline</span>
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="items">Review Items</TabsTrigger>
          <TabsTrigger value="actions" disabled={!canTakeAction}>Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              {review.description && (
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Description</h3>
                  <p className="text-sm whitespace-pre-wrap">{review.description}</p>
                </div>
              )}

              {review.comments && (
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Comments</h3>
                  <p className="text-sm whitespace-pre-wrap">{review.comments}</p>
                </div>
              )}

              {review.rejectionReason && (
                <div className="mb-6">
                  <h3 className="font-medium text-destructive mb-2">Rejection Reason</h3>
                  <p className="text-sm whitespace-pre-wrap">{review.rejectionReason}</p>
                </div>
              )}

              {review.additionalDataRequest && (
                <div className="mb-6">
                  <h3 className="font-medium text-yellow-600 mb-2">Additional Data Request</h3>
                  <p className="text-sm whitespace-pre-wrap">{review.additionalDataRequest}</p>
                </div>
              )}

              {review.completedBy && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <h3 className="font-medium mb-2">Completed By</h3>
                    <p className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {review.completedBy}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-medium mb-2">Completed At</h3>
                    <p className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {review.completedAt ? format(new Date(review.completedAt), 'PPP p') : 'N/A'}
                    </p>
                  </div>
                </div>
              )}

              {review.evidence && review.evidence.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Evidence</h3>
                  <div className="space-y-2">
                    {review.evidence.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                        <FileText className="h-4 w-4" />
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {item.name}
                        </a>
                        {item.description && (
                          <span className="text-sm text-muted-foreground">- {item.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-4 mt-4">
          {review.reviewItems && review.reviewItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {review.reviewItems.map((item, index) => (
                <Card key={index}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-lg">{item.label || item.answer_id}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Answer ID: {item.answer_id}
                      </p>
                    </div>
                    {getStatusBadge(item.status)}
                  </CardHeader>
                  <CardContent>
                    {item.comments && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Comments:</h4>
                        <p className="text-sm whitespace-pre-wrap">{item.comments}</p>
                      </div>
                    )}

                    {canTakeAction && (
                      <div>
                        <Label htmlFor={`item-comment-${index}`}>Add Comment</Label>
                        <Textarea
                          id={`item-comment-${index}`}
                          placeholder="Add a comment about this item"
                          value={itemComments[item.answer_id] || ''}
                          onChange={(e) => handleItemCommentChange(item.answer_id, e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No review items available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="actions" className="space-y-4 mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-6">
                <div>
                  <Label htmlFor="comments">Comments</Label>
                  <Textarea
                    id="comments"
                    placeholder="Add your comments about this review"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="mt-1"
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleApprove}
                      disabled={isSubmitting}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="rejection-reason">Rejection Reason</Label>
                    <Input
                      id="rejection-reason"
                      placeholder="Reason for rejection"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleReject}
                      disabled={isSubmitting || !rejectionReason}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additional-data">Request Additional Data</Label>
                    <Input
                      id="additional-data"
                      placeholder="Specify what data is needed"
                      value={additionalDataRequest}
                      onChange={(e) => setAdditionalDataRequest(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleRequestAdditionalData}
                      disabled={isSubmitting || !additionalDataRequest}
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Request Data
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Evidence (Coming Soon)</Label>
                  <div className="border border-dashed rounded-md p-8 mt-1 text-center text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p>Upload evidence files</p>
                    <p className="text-xs mt-1">This feature is coming soon</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 