import { Metadata } from 'next';
import { getFormById, getFormInstance } from '@/app/(modules)/(private)/(forms)/(actions)/actions';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FormAnswersTable } from './components/form-answers-table';

interface FormAnswersPageProps {
  params: {
    formId: string;
    instanceId: string;
  };
}

export const metadata: Metadata = {
  title: 'Form Answers',
  description: 'View and review form answers',
};

export default async function FormAnswersPage({ params }: FormAnswersPageProps) {
  const [form, instance] = await Promise.all([
    getFormById(params.formId),
    getFormInstance(params.instanceId)
  ]);

  if (!form || !instance) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href={`/forms/${params.formId}/instances`}>
            <Button variant="ghost" className="pl-0">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Instances
            </Button>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{form.name}</h2>
          <p className="text-muted-foreground">
            View and review answers for this form instance
          </p>
        </div>
      </div>

      <FormAnswersTable
        formId={params.formId}
        instanceId={params.instanceId}
        formConfig={form.config}
      />
    </div>
  );
} 