import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormById } from '../../../(actions)/actions';
import FormInstancesTable from './components/form-instances-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Form Instances',
  description: 'View form instances and submissions',
};

export default async function FormInstancesPage({
  params,
}: {
  params: { formId: string };
}) {
  const form = await getFormById(params.formId);
  
  if (!form) {
    notFound();
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <Link href="/forms">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Forms
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{form.name}</h1>
        {form.description && (
          <p className="text-muted-foreground mt-2">
            {form.description}
          </p>
        )}
      </div>

      <FormInstancesTable formId={params.formId} />
    </div>
  );
}
