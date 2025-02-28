'use client';

import { useState } from 'react';
import { 
  PERMISSIONS, 
  PERMISSION_CATEGORIES, 
  getPermissionsByCategory 
} from '@/lib/auth/permissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PermissionsSelectorProps {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
}

export default function PermissionsSelector({
  selectedPermissions,
  onChange,
}: PermissionsSelectorProps) {
  const [activeTab, setActiveTab] = useState<string>(PERMISSION_CATEGORIES[0]);

  const handleTogglePermission = (permissionId: string) => {
    if (selectedPermissions.includes(permissionId)) {
      onChange(selectedPermissions.filter((id) => id !== permissionId));
    } else {
      onChange([...selectedPermissions, permissionId]);
    }
  };

  // Special handling for admin and super_admin permissions
  const handleToggleAdminPermission = (permissionId: string) => {
    if (permissionId === 'admin') {
      if (selectedPermissions.includes('admin')) {
        // Remove admin and all other permissions except super_admin
        const newPermissions = selectedPermissions.filter(
          (id) => id === 'super_admin'
        );
        onChange(newPermissions);
      } else {
        // Add admin and remove all other permissions except super_admin
        const newPermissions = selectedPermissions.filter(
          (id) => id === 'super_admin'
        );
        onChange([...newPermissions, 'admin']);
      }
    } else if (permissionId === 'super_admin') {
      if (selectedPermissions.includes('super_admin')) {
        // Remove super_admin
        onChange(selectedPermissions.filter((id) => id !== 'super_admin'));
      } else {
        // Add super_admin and remove all other permissions
        onChange(['super_admin']);
      }
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid grid-cols-3 lg:grid-cols-7">
        {PERMISSION_CATEGORIES.map((category) => (
          <TabsTrigger key={category} value={category}>
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {PERMISSION_CATEGORIES.map((category) => (
        <TabsContent key={category} value={category} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{category} Permissions</CardTitle>
              <CardDescription>
                Manage {category.toLowerCase()} related permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {getPermissionsByCategory(category).map((permission) => (
                <div
                  key={permission.id}
                  className="flex items-center justify-between space-x-2"
                >
                  <div className="space-y-0.5">
                    <Label htmlFor={permission.id}>{permission.name}</Label>
                    <p className="text-sm text-muted-foreground">
                      {permission.description}
                    </p>
                  </div>
                  <Switch
                    id={permission.id}
                    checked={selectedPermissions.includes(permission.id)}
                    onCheckedChange={() => {
                      if (permission.id === 'admin' || permission.id === 'super_admin') {
                        handleToggleAdminPermission(permission.id);
                      } else {
                        handleTogglePermission(permission.id);
                      }
                    }}
                    disabled={
                      // Disable other permissions if super_admin is selected
                      selectedPermissions.includes('super_admin') && 
                      permission.id !== 'super_admin'
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
      
      <div className="mt-4 flex flex-wrap gap-2">
        <p className="text-sm font-medium">Selected permissions:</p>
        {selectedPermissions.length === 0 ? (
          <Badge variant="outline">None</Badge>
        ) : (
          selectedPermissions.map((id) => (
            <Badge key={id} variant="secondary">
              {id}
            </Badge>
          ))
        )}
      </div>
    </Tabs>
  );
} 