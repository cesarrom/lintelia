import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReview } from '../../../(actions)/actions';
import ReviewDetail from './components/review-detail';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Review Details',
  description: 'View and manage review details',
};

export default async function ReviewDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const review = await getReview(params.id);
  
  if (!review) {
    notFound();
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <Link href="/reviews">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Reviews
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{review.title}</h1>
        {review.description && (
          <p className="text-muted-foreground mt-2">
            {review.description}
          </p>
        )}
      </div>

      <ReviewDetail review={review} />
    </div>
  );
} 