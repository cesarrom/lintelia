import { UserManagement } from '@descope/react-sdk';
import { useTenant } from '@/lib/providers/TenantProvider';
import { useTheme } from '@/lib/providers/ThemeProvider';


export default function UsersPage() {
  const { tenant } = useTenant();
  const { theme } = useTheme();

  if (!tenant) {
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <UserManagement
        widgetId="user-management-widget"
        tenant={tenant.domain}
        theme={theme}
      />
    </div>
  );
} 