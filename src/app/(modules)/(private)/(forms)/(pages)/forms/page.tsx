import { Metadata } from 'next';
import { listForms } from '../../(actions)/actions';
import FormsTable from './components/forms-table';
import CreateFormButton from './components/create-form-button';
import FormsFilter from './components/forms-filter';

export const metadata: Metadata = {
  title: 'Forms',
  description: 'Create and manage forms',
};

export default async function FormsPage({
  searchParams,
}: {
  searchParams?: {
    search?: string;
  };
}) {
  const forms = await listForms(searchParams?.search);

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
        <FormsTable forms={forms} />
      </div>
    </div>
  );
}
