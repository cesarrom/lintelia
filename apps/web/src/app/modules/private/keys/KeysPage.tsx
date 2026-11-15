import { AccessKeyManagement } from '@descope/react-sdk';
import { useTenant } from '@/lib/providers/TenantProvider';
import { useTheme } from '@/lib/providers/ThemeProvider';


export default function KeysPage() {
  const { tenant } = useTenant();
  const { theme } = useTheme();

  if (!tenant) {
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <AccessKeyManagement
        widgetId="access-key-management-widget"
        tenant={tenant.domain}
        theme={theme}
      />
    </div>
  );
} 