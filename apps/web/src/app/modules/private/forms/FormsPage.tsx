import { PageContainer, PageHeader } from '@/components/app/page';
import FormsTable from './components/forms-table';
import CreateFormButton from './components/create-form-button';
import FormsFilter from './components/forms-filter';
import { useFormListForms } from '@/lib/services/form.hooks';
import { useSearchParams } from "react-router";
import { useAuth } from '@/lib/auth/AuthContext';

export default function FormsPage() {
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { data: forms = [] } = useFormListForms({ search: searchParams.get('search') || undefined });

  return (
    <PageContainer>
      <PageHeader
        title="Forms"
        description="Build forms, publish them on your website and route every submission into a workflow"
        actions={hasPermission('forms:manage') ? <CreateFormButton /> : undefined}
      />
      <div className="space-y-4">
        <FormsFilter />
        <FormsTable forms={forms || []} />
      </div>
    </PageContainer>
  );
}
