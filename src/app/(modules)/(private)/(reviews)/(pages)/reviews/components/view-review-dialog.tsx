'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Calendar, 
  FileText,
  Upload
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  approveReview, 
  rejectReview, 
  assignReview,
  requestAdditionalData
} from '../../../(actions)/actions';
import { Review } from '@/lib/entities/tenant/review.entity';
import { useAuth } from '@/lib/auth/AuthContext';

interface ViewReviewDialogProps {
  review: Review | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewReviewDialog({ 
  review, 
  open, 
  onOpenChange 
}: ViewReviewDialogProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [additionalDataRequest, setAdditionalDataRequest] = useState('');
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('details');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  
  if (!review) return null;
  
  const handleAssign = async () => {
    if (!user?.email) return;
    
    try {
      setIsSubmitting(true);
      await assignReview(review.id, user.email);
      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to assign review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleApprove = async () => {
    if (!review) return;
    
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
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to approve review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleReject = async () => {
    if (!review || !rejectionReason) return;
    
    try {
      setIsSubmitting(true);
      
      // Prepare review items with their status and comments
      const updatedItems = review.reviewItems.map(item => ({
        answer_id: item.answer_id,
        status: 'rejected' as const,
        comments: itemComments[item.answer_id] || undefined
      }));
      
      // TODO: Handle evidence files upload
      const evidence = evidenceFiles.length > 0 
        ? evidenceFiles.map(file => ({
            type: 'file',
            url: URL.createObjectURL(file),
            name: file.name,
            description: ''
          }))
        : undefined;
      
      await rejectReview(review.id, {
        rejectionReason,
        comments,
        reviewItems: updatedItems,
        evidence
      });
      
      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to reject review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleRequestAdditionalData = async () => {
    if (!review || !additionalDataRequest) return;
    
    try {
      setIsSubmitting(true);
      await requestAdditionalData(review.id, {
        additionalDataRequest,
        comments
      });
      router.refresh();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to request additional data:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleItemCommentChange = (answerId: string, comment: string) => {
    setItemComments(prev => ({
      ...prev,
      [answerId]: comment
    }));
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
  
  const canAssign = review.status === 'pending' && user?.email;
  const canApprove = review.status === 'in_progress' && review.assignedTo === user?.email;
  const canReject = review.status === 'in_progress' && review.assignedTo === user?.email;
  const canRequestData = review.status === 'in_progress' && review.assignedTo === user?.email;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{review.title}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">Review Items</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {getStatusBadge(review.status)}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Assigned To</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{review.assignedTo || 'Unassigned'}</span>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Created</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(new Date(review.createdAt), 'PPP')}</span>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Due Date</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{review.dueDate ? format(new Date(review.dueDate), 'PPP') : 'No due date'}</span>
                </CardContent>
              </Card>
            </div>
            
            {review.description && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Description</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{review.description}</p>
                </CardContent>
              </Card>
            )}
            
            {review.comments && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{review.comments}</p>
                </CardContent>
              </Card>
            )}
            
            {review.rejectionReason && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Rejection Reason</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{review.rejectionReason}</p>
                </CardContent>
              </Card>
            )}
            
            {review.additionalDataRequest && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Additional Data Request</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{review.additionalDataRequest}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="items" className="space-y-4 mt-4">
            {review.reviewItems.length === 0 ? (
              <p className="text-muted-foreground">No review items to display.</p>
            ) : (
              <div className="space-y-4">
                {review.reviewItems.map((item, index) => (
                  <Card key={index}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-medium">{item.label || item.answer_id}</CardTitle>
                      </div>
                      {getStatusBadge(item.status)}
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-xs font-medium mb-1">Answer ID:</h4>
                        <code className="text-xs bg-muted p-1 rounded">{item.answer_id}</code>
                      </div>
                      
                      {item.comments && (
                        <div>
                          <h4 className="text-xs font-medium mb-1">Comments:</h4>
                          <p className="text-xs">{item.comments}</p>
                        </div>
                      )}
                      
                      {canApprove && (
                        <div>
                          <Label htmlFor={`item-comment-${index}`} className="text-xs">Add Comment</Label>
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
            )}
          </TabsContent>
          
          <TabsContent value="actions" className="space-y-4 mt-4">
            {canAssign && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Assign to Me</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-4">Assign this review to yourself to start the review process.</p>
                  <Button 
                    onClick={handleAssign} 
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    Assign to Me
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {canApprove && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Approve Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="approve-comments">Comments (Optional)</Label>
                    <Textarea
                      id="approve-comments"
                      placeholder="Add any comments about this approval"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleApprove} 
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    Approve Review
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {canReject && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reject Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejection-reason">Rejection Reason</Label>
                    <Textarea
                      id="rejection-reason"
                      placeholder="Explain why this review is being rejected"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reject-comments">Additional Comments (Optional)</Label>
                    <Textarea
                      id="reject-comments"
                      placeholder="Add any additional comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="evidence">Evidence (Optional)</Label>
                    <Input
                      id="evidence"
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          setEvidenceFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleReject} 
                    disabled={isSubmitting || !rejectionReason}
                    className="w-full"
                    variant="destructive"
                  >
                    Reject Review
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {canRequestData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Request Additional Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="additional-data-request">Data Request</Label>
                    <Textarea
                      id="additional-data-request"
                      placeholder="Specify what additional data is needed"
                      value={additionalDataRequest}
                      onChange={(e) => setAdditionalDataRequest(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="data-request-comments">Additional Comments (Optional)</Label>
                    <Textarea
                      id="data-request-comments"
                      placeholder="Add any additional comments"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleRequestAdditionalData} 
                    disabled={isSubmitting || !additionalDataRequest}
                    className="w-full"
                    variant="outline"
                  >
                    Request Additional Data
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 