import { Metadata } from 'next';
import { getReviews } from '../../(actions)/actions';
import ReviewsTable from './components/reviews-table';
import ReviewsFilter from './components/reviews-filter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const metadata: Metadata = {
  title: 'Reviews',
  description: 'Manage and process review requests',
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams?: {
    status?: string;
    assignedTo?: string;
    fromDate?: string;
    toDate?: string;
    view?: string;
  };
}) {
  const filter = searchParams ? {
    status: searchParams.status as any,
    assignedTo: searchParams.assignedTo,
    fromDate: searchParams.fromDate ? new Date(searchParams.fromDate) : undefined,
    toDate: searchParams.toDate ? new Date(searchParams.toDate) : undefined,
  } : undefined;

  const reviews = await getReviews(filter);
  const activeView = searchParams?.view || 'all';

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground mt-2">
          Manage and process review requests
        </p>
      </div>

      <Tabs defaultValue={activeView} className="space-y-4">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="all" asChild>
              <a href={`/reviews?view=all${searchParams ? `&${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(searchParams).filter(([key]) => key !== 'view' && key !== 'status')
                )
              }).toString()}` : ''}`}>
                All Reviews
              </a>
            </TabsTrigger>
            <TabsTrigger value="pending" asChild>
              <a href={`/reviews?view=pending&status=pending${searchParams ? `&${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(searchParams).filter(([key]) => key !== 'view' && key !== 'status')
                )
              }).toString()}` : ''}`}>
                Pending
              </a>
            </TabsTrigger>
            <TabsTrigger value="in_progress" asChild>
              <a href={`/reviews?view=in_progress&status=in_progress${searchParams ? `&${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(searchParams).filter(([key]) => key !== 'view' && key !== 'status')
                )
              }).toString()}` : ''}`}>
                In Progress
              </a>
            </TabsTrigger>
            <TabsTrigger value="completed" asChild>
              <a href={`/reviews?view=completed&status=approved,rejected,additional_data_requested${searchParams ? `&${new URLSearchParams({
                ...Object.fromEntries(
                  Object.entries(searchParams).filter(([key]) => key !== 'view' && key !== 'status')
                )
              }).toString()}` : ''}`}>
                Completed
              </a>
            </TabsTrigger>
          </TabsList>
        </div>

        <ReviewsFilter />

        <TabsContent value="all" className="space-y-4">
          <ReviewsTable reviews={reviews} />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <ReviewsTable reviews={reviews.filter(review => review.status === 'pending')} />
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4">
          <ReviewsTable reviews={reviews.filter(review => review.status === 'in_progress')} />
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          <ReviewsTable 
            reviews={reviews.filter(review => 
              ['approved', 'rejected', 'additional_data_requested'].includes(review.status)
            )} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
