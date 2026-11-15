import FormsTable from './components/forms-table';
import CreateFormButton from './components/create-form-button';
import FormsFilter from './components/forms-filter';
import { useFormListForms } from '@/lib/services/form.hooks';
import { useSearchParams } from "react-router";

export default function FormsPage() {
  const [searchParams] = useSearchParams();
  const { data: forms = [] } = useFormListForms({ search: searchParams.get('search') || undefined });

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage forms for data collection
          </p>
        </div>
        <CreateFormButton />
      </div>

      <div className="space-y-4">
        <FormsFilter />
        <FormsTable forms={forms || []} />
      </div>
    </div>
  );
}
