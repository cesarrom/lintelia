import { useTenant } from '@/lib/providers/TenantProvider';
import { useTheme } from '@/lib/providers/ThemeProvider';
import { UserProfile } from '@descope/react-sdk';


export default function ProfilePage() {
  const { tenant } = useTenant();
  const { theme } = useTheme();
  if (!tenant) {
    return null;
  }

  return (
    <div className="container mx-auto py-10">
      <UserProfile
        widgetId="user-profile-widget"
        theme={theme} // light / dark / os (auto detect)
        onLogout={() => {
          // add here you own logout callback
          window.location.href = '/login';
        }}
      />
    </div>
  );
} 