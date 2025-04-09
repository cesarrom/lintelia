'use client';

import { useState, useEffect } from 'react';
import { getFormById, getFormInstance, submitFormAnswers } from '@/app/(modules)/(private)/(forms)/(actions)/actions';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { FormViewer } from '@/app/(modules)/(private)/(forms)/(components)/form-builder';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormInstance } from '@/lib/entities/tenant';

export default function NewAnswerPage() {
  const router = useRouter();
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [instance, setInstance] = useState<FormInstance | null>(null);

  const formId = params.formId as string;
  const instanceId = params.instanceId as string;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [formData, instanceData] = await Promise.all([
          getFormById(formId),
          getFormInstance(instanceId)
        ]);

        if (!formData || !instanceData) {
          notFound();
        }

        setForm(formData);
        setInstance(instanceData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [formId, instanceId]);

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      await submitFormAnswers(instanceId, values);
      toast.success('Form submitted successfully');
      router.push(`/forms/${formId}/instances/${instanceId}/answers`);
    } catch (error: any) {
      toast.error('Failed to submit form: ' + error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !form || !instance) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error?.message || 'Failed to load form data'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href={`/forms/${formId}/instances`}>
            <Button variant="ghost" className="pl-0">
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back to Instances
            </Button>
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{form.name}</h2>
          {form.description && (
            <p className="text-muted-foreground">{form.description}</p>
          )}
        </div>
      </div>

      <FormViewer
        config={form.config}
        initialValues={instance.answers}
        variables={{
          values: instance.variables || {},
          definitions: form.config.variables || {},
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
