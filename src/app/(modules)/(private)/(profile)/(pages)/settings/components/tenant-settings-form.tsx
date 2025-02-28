'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTenantSettings, getTenant } from '../actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Edit2, Save } from 'lucide-react';
import { type Tenant } from '@/lib/entities/global/tenant.entity';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

type TenantSettings = Omit<Tenant, 'databaseId' | 'databaseUrl' | 'createdAt' | 'updatedAt'>;

export default function TenantSettingsForm() {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => getTenant() as Promise<Tenant>,
  });

  const { register, handleSubmit, watch, setValue } = useForm<TenantSettings>({
    defaultValues: {
      name: '',
      logoUrl: '',
      pallette: {
        primary: '#000000',
        secondary: '#000000',
        accent: '#000000',
      },
      allowedDomains: [],
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      startWorkingHour: '09:00',
      endWorkingHour: '17:00',
    },
  });

  useEffect(() => {
    if (!settings) return;
    Object.entries(settings).forEach(([key, value]) => {
      setValue(key as keyof TenantSettings, value);
    });
  }, [settings]);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: TenantSettings) => updateTenantSettings(settings?.domain!, data),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      router.refresh();
    }
  });

  const onSubmit = (data: TenantSettings) => {
    if (!settings) return;
    mutation.mutate(data);
  };

  const handlePaletteChange = (color: string, type: 'primary' | 'secondary' | 'accent') => {
    setValue(`pallette.${type}`, color);
  };

  const formValues = watch();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>General Information</CardTitle>
              <CardDescription>
                Basic information about your organization
              </CardDescription>
            </div>
            <Button
              type={isEditing ? "submit" : "button"}
              onClick={() => !isEditing && setIsEditing(true)}
              disabled={mutation.isPending}
            >
              {isEditing ? (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Edit Settings
                </>
              )}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  {...register('name')}
                  disabled={!isEditing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  {...register('logoUrl')}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Colors</CardTitle>
            <CardDescription>
              Customize your organization's color scheme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {(['primary', 'secondary', 'accent'] as const).map((color) => (
                <div key={color} className="space-y-2">
                  <Label className="capitalize">{color} Color</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={!isEditing}
                      >
                        <div
                          className="mr-2 h-4 w-4 rounded"
                          style={{ background: formValues.pallette[color] }}
                        />
                        {formValues.pallette[color]}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3">
                      <HexColorPicker
                        color={formValues.pallette[color]}
                        onChange={(newColor) => handlePaletteChange(newColor, color)}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
            <CardDescription>
              Your organization's physical address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  {...register('addressLine1')}
                  disabled={!isEditing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  {...register('addressLine2')}
                  disabled={!isEditing}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    {...register('city')}
                    disabled={!isEditing}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    {...register('state')}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    {...register('country')}
                    disabled={!isEditing}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zipCode">ZIP Code</Label>
                  <Input
                    id="zipCode"
                    {...register('zipCode')}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working Hours</CardTitle>
            <CardDescription>
              Set your organization's working hours
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startWorkingHour">Start Time</Label>
                <Input
                  id="startWorkingHour"
                  type="time"
                  {...register('startWorkingHour')}
                  disabled={!isEditing}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endWorkingHour">End Time</Label>
                <Input
                  id="endWorkingHour"
                  type="time"
                  {...register('endWorkingHour')}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}