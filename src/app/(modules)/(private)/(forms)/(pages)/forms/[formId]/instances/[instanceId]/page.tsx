'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { getFormInstance, submitFormAnswers } from '@/app/(modules)/(private)/(forms)/(actions)/actions';
import { FormViewer } from '@/app/(modules)/(private)/(forms)/(components)/form-builder';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function mapDBConfigToUIConfig(dbConfig: any) {
  return {
    id: dbConfig.id || '',
    name: dbConfig.name,
    description: dbConfig.description,
    variables: {},
    components: dbConfig.fields.map((field: any) => ({
      id: field.id,
      type: field.type,
      config: {
        label: field.label,
        required: field.required,
        placeholder: field.placeholder,
        description: field.description,
        ...(field.type === 'richtext' && {
          content: field.content,
          references: field.references,
        }),
        ...(field.type === 'select' || field.type === 'multiselect' ? {
          source: field.source,
          isSearchable: field.isSearchable,
          isClearable: field.isClearable,
          isCreatable: field.isCreatable,
        } : {}),
      },
    })),
  };
}

export default function FormInstancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const instanceId = params.instanceId as string;
  const promiseId = searchParams.get('promiseId');
  const key = searchParams.get('key');

  // Query for fetching form instance data
  const { data: instance, isLoading, error } = useQuery({
    queryKey: ['form-instance', instanceId],
    queryFn: () => getFormInstance(instanceId),
  });

  // Mutation for submitting form answers
  const { mutate: submitForm, isPending } = useMutation({
    mutationFn: (answers: Record<string, unknown>) => {
      if (!key || !promiseId) throw new Error('Missing required parameters');
      return submitFormAnswers(key, promiseId, answers);
    },
    onSuccess: () => {
      toast.success('Form submitted successfully');
      // Close the window since the form is submitted
      window.close();
    },
    onError: (error) => {
      toast.error('Failed to submit form: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="container py-8">
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

  if (error || !instance) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error?.message || 'Failed to load form instance'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <Card>
        <CardHeader>
          <CardTitle>{instance.form.name}</CardTitle>
          {instance.form.description && (
            <CardDescription>{instance.form.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <FormViewer
            config={mapDBConfigToUIConfig(instance.form.config)}
            initialValues={instance.answers}
            variables={{
              values: instance.variables,
              definitions: {},
            }}
            onSubmit={(values) => {
              submitForm(values);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
