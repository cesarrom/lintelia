import { useAuth } from '@/lib/auth/AuthContext';
import { PermissionCheck } from './types';

export const usePermissions = () => {
  const { user, permissions, isSuperAdmin } = useAuth();

  const can = (check: PermissionCheck | PermissionCheck[]): boolean => {
    if (!user) return false;
    if (isSuperAdmin) return true;

    const checks = Array.isArray(check) ? check : [check];
    
    return checks.every(({ module, action }) => {
      const modulePermissions = permissions[module];
      return modulePermissions?.includes(action) ?? false;
    });
  };

  return {
    can,
    isSuperAdmin,
  };
}; 