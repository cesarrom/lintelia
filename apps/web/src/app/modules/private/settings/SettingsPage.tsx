import { PageContainer, PageHeader } from '@/components/app/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TenantSettingsForm from './components/tenant-settings-form';
import SystemVariablesTable from './components/system-variables-table';
import { useSystemGetSystemVariables } from '@/lib/services/system.hooks';
import SecuritySettings from './components/security-settings';
import DomainsSettings from './components/domains-settings';
import { useAuth } from '@/lib/auth/AuthContext';

export default function SettingsPage() {
  const { data: systemVariables = [] } = useSystemGetSystemVariables();
  const { hasPermission } = useAuth();
  const initialTab = new URLSearchParams(window.location.search).get('tab') ?? 'tenant';

  return (
    <PageContainer>
      <PageHeader title="Settings" description="Your workspace: name, brand colours, domains, sign-in security and variables used by workflows" />

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="tenant">Workspace</TabsTrigger>
          {hasPermission('security:manage') && <TabsTrigger value="security">Security</TabsTrigger>}
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>

        {hasPermission('security:manage') && (
          <TabsContent value="security" className="space-y-4">
            <SecuritySettings />
          </TabsContent>
        )}

        <TabsContent value="tenant" className="space-y-4">
          <TenantSettingsForm />
          {hasPermission('domains:manage') && <DomainsSettings />}
        </TabsContent>

        <TabsContent value="variables" className="space-y-4">
          <SystemVariablesTable variables={systemVariables} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
} 