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
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage tenant settings and system variables
        </p>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="tenant">Tenant Settings</TabsTrigger>
          {hasPermission('security:manage') && <TabsTrigger value="security">Security</TabsTrigger>}
          <TabsTrigger value="variables">System Variables</TabsTrigger>
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
    </div>
  );
} 