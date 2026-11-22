'use client';

import { Button } from '@/components/ui/button';
import { NavLink as Link, useNavigate } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormGetFormInstance, useFormSubmitFormAnswers } from '@/lib/services/form.hooks';
import { useFormGetFormById } from '@/lib/services/form.hooks';
import { FormViewer } from '@/app/modules/private/forms/components/form-builder';

export default function NewAnswerPage() {
  const { mutateAsync: submitFormAnswers } = useFormSubmitFormAnswers();
  const router = useNavigate();
  const params = useParams<{ formId: string, instanceId: string }>();
  const formId = params.formId as string;
  const instanceId = params.instanceId as string;
  const { data: instance, isLoading: instanceLoading, error: instanceError } = useFormGetFormInstance({ instanceId, enabled: !!instanceId });
  const { data: form, isLoading: formLoading, error: formError } = useFormGetFormById({ id: formId, enabled: !!formId });
  const isLoading = instanceLoading || formLoading;
  const error = instanceError || formError;

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      await submitFormAnswers({ instanceId, answers: values });
      toast.success('Form submitted successfully');
      router(`/app/forms/${formId}/instances/${instanceId}/answers`);
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
          <Link to={`/app/forms/${formId}/instances`}>
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
        initialValues={{}}
        variables={{
          values: instance.variables || {},
          definitions: form.config.variables || {},
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
