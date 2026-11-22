import { Button } from '@/components/ui/button';
import {NavLink as Link, useNavigate} from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { FormAnswersTable } from './components/form-answers-table';
import { useFormGetFormById, useFormGetFormInstance } from '@/lib/services/form.hooks';
import { useParams } from 'react-router';

type FormAnswersParams = {
  formId: string;
  instanceId: string;
};
export default function FormAnswersPage() {
  const navigate = useNavigate();
  const params = useParams<FormAnswersParams>();
  const { data: form, isLoading: isLoadingForm } = useFormGetFormById({ id: params.formId! });
  const { data: instance, isLoading: isLoadingInstance } = useFormGetFormInstance({ instanceId: params.instanceId! });

  if (isLoadingForm || isLoadingInstance) {
    return <div>Loading...</div>
  }

  if (!form || !instance) {
    navigate(`/app/forms/${params.formId}/instances`);
    return;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to={`/app/forms/${params.formId}/instances`}>
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
        formId={params.formId!}
        instanceId={params.instanceId!}
        formConfig={form.config}
      />
    </div>
  );
} 