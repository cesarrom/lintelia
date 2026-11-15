import FormInstancesTable from './components/form-instances-table';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { NavLink as Link, useNavigate, useParams } from 'react-router';
import CreateInstanceButton from './components/create-instance-button';
import { useFormGetFormById } from '@/lib/services/form.hooks';


export default function FormInstancesPage() {
  const params = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { data: form, isLoading } = useFormGetFormById({ id: params.formId! });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!form) {
    navigate('/not-found');
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <Link to="/app/forms">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Forms
          </Button>
        </Link>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{form.name}</h1>
            {form.description && (
              <p className="text-muted-foreground mt-2">
                {form.description}
              </p>
            )}
          </div>
          <CreateInstanceButton form={form} />
        </div>
      </div>

      <FormInstancesTable formId={params.formId} />
    </div>
  );
}
