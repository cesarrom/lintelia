'use client';

import React, { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { X } from "lucide-react";
import { InviteeList } from "@/components/InviteApplicants";
import countries from '../data/countries.json'
import timezones from '../data/timezones.json';
import { TimePicker } from "@/components/TimePicker";
import { OnboardingData, OnboardingDataSchema, onboardingDefaultValues } from "../types";
import { CreateTenant, CreateTenantResponse } from "@repo/fintivio/schemas";
import { useTenantCreateTenant } from "@/lib/services/tenant.hooks";
import { useFilesPutObject } from "@/lib/services/files.hooks";

export function TenantOnboardingPage() {
  const [sending, startTransition] = React.useTransition();
  const [tenant, setTenant] = React.useState<CreateTenantResponse | null>(null);
  const { mutateAsync: createTenant } = useTenantCreateTenant();
  const { mutateAsync: uploadFile } = useFilesPutObject();

  const form = useForm<OnboardingData>({
    resolver: zodResolver(OnboardingDataSchema),
    defaultValues: onboardingDefaultValues
  });

  const handleContractChange = (fieldName: 'individualContract' | 'coApplicantContract' | 'businessContract' | 'logo') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue(fieldName, file);
    }
  };

  const goToDashboard = useCallback(() => {
    const [currentSchema] = window.location.href.split('://');
    window.location.href = `${currentSchema}://${tenant!.domain}.${window.location.host}/dashboard`;
  }, [tenant]);

  useEffect(() => {
    if (tenant && !tenant?.cnameRecords?.length) {
      goToDashboard();
    }
  }, [tenant, goToDashboard]);

  if (tenant) {
    return (
      <div className="container max-w-4xl mx-auto p-6 sm:p-8 md:p-10 bg-background text-foreground">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">DNS Configuration Required</h1>
            <p className="text-muted-foreground mb-6">Please set up the following CNAME records for your domain:</p>
          </div>
          <div className="bg-muted p-6 rounded-lg">
            {tenant?.cnameRecords?.map((record, index) => (
              <div key={record.Name + index} className="mb-4 last:mb-0">
                <p className="font-mono bg-card text-card-foreground p-3 rounded border">{record.Type}</p>
                <p className="font-mono bg-card text-card-foreground p-3 rounded border">{record.Name}</p>
                <p className="font-mono bg-card text-card-foreground p-3 rounded border">{record.Value}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={goToDashboard}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(async (values) => {
      startTransition(async () => {
        try {
          const logoUrl = values.logo.name!;
          const individualContractUrl = values.individualContract.name!;
          const coApplicantContractUrl = values.coApplicantContract.name!;
          const businessContractUrl = values.businessContract.name!;

          await Promise.all([
            uploadFile(values.logo),
            uploadFile(values.individualContract),
            uploadFile(values.coApplicantContract),
            uploadFile(values.businessContract),
          ]);

          Object.assign(values, { logoUrl, individualContractUrl, coApplicantContractUrl, businessContractUrl, logo: undefined, individualContract: undefined, coApplicantContract: undefined, businessContract: undefined });

          const response = await createTenant(values as unknown as CreateTenant)

          setTenant(response);

        } catch (e) {
          console.error(e);
        }
      });
    })} className="container max-w-4xl mx-auto p-6 sm:p-8 md:p-10">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">New institution form</h1>
          <p className="text-muted-foreground">Please fill out the below form to get your institution&apos;s profile created.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Set the basic information for your tenant.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Legal Name</Label>
              <Input
                id="name"
                placeholder="Enter tenant name"
                disabled={sending}
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                placeholder="Enter domain name"
                disabled={sending}
                {...form.register('domain')}
              />
              <CardDescription>
                {form.watch('domain') ? `https://${form.watch('domain')}.fintivio.org/` : ''}
              </CardDescription>
              {form.formState.errors.domain && (
                <p className="text-red-500 text-sm">{form.formState.errors.domain.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <Input
                id="addressLine1"
                placeholder="Enter address line 1"
                required
                disabled={sending}
                {...form.register('addressLine1')}
              />
              {form.formState.errors.addressLine1 && (
                <p className="text-red-500 text-sm">{form.formState.errors.addressLine1.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                placeholder="Enter address line 2 (optional)"
                disabled={sending}
                {...form.register('addressLine2')}
              />
              {form.formState.errors.addressLine2 && (
                <p className="text-red-500 text-sm">{form.formState.errors.addressLine2.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Enter city"
                  required
                  disabled={sending}
                  {...form.register('city')}
                />
                {form.formState.errors.city && (
                  <p className="text-red-500 text-sm">{form.formState.errors.city.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  placeholder="Enter state or province"
                  required
                  disabled={sending}
                  {...form.register('state')}
                />
                {form.formState.errors.state && (
                  <p className="text-red-500 text-sm">{form.formState.errors.state.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  onValueChange={(value) => form.setValue('country', value)}
                  value={form.watch('country')}
                  disabled={sending}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.country && (
                  <p className="text-red-500 text-sm">{form.formState.errors.country.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip/Postal Code</Label>
                <Input
                  id="zipCode"
                  placeholder="Enter zip or postal code"
                  required
                  disabled={sending}
                  {...form.register('zipCode')}
                />
                {form.formState.errors.zipCode && (
                  <p className="text-red-500 text-sm">{form.formState.errors.zipCode.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                onValueChange={(value) => form.setValue('timezone', value)}
                value={form.watch('timezone')}
                disabled={sending}
              >
                <SelectTrigger id="timezone">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map((tz, index) => (
                    <SelectItem key={tz.value + index} value={tz.value}>
                      {tz.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.timezone && (
                <p className="text-red-500 text-sm">{form.formState.errors.timezone.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Working Hours</Label>
              <div className="flex flex-col items-start space-x-2">
                <TimePicker
                  date={form.watch('startWorkingHour') ? new Date(form.watch('startWorkingHour')) : undefined}
                  setDate={(date) => form.setValue('startWorkingHour', date?.toISOString() || '')}
                />
                <div>To</div>
                <TimePicker
                  date={form.watch('endWorkingHour') ? new Date(form.watch('endWorkingHour')) : undefined}
                  setDate={(date) => form.setValue('endWorkingHour', date?.toISOString() || '')}
                />
              </div>
              {form.formState.errors.startWorkingHour && (
                <p className="text-red-500 text-sm">{form.formState.errors.startWorkingHour.message}</p>
              )}
              {form.formState.errors.endWorkingHour && (
                <p className="text-red-500 text-sm">{form.formState.errors.endWorkingHour.message}</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Organization Theme</CardTitle>
            <CardDescription>Design details for this organization.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="Enter logo URL"
                type="file"
                disabled={sending}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      form.setValue('logoUrl', reader.result as string);
                      form.setValue('logoName', file.name);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {form.formState.errors.logoUrl && (
                <p className="text-red-500 text-sm">{form.formState.errors.logoUrl.message}</p>
              )}
              <div className="flex items-center gap-2">
                <img
                  src={form.watch('logoUrl') || "/placeholder.svg"}
                  width="48"
                  height="48"
                  alt="Logo"
                  className="rounded-md"
                  style={{ aspectRatio: "48/48", objectFit: "cover" }}
                />
                <p className="text-muted-foreground">Preview your logo here.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="primary-color">Primary Color</Label>
                <Input
                  id="primary-color"
                  type="color"
                  className="h-10 w-full"
                  disabled={sending}
                  {...form.register('pallette.primary')}
                />
                {form.formState.errors.pallette?.primary && (
                  <p className="text-red-500 text-sm">{form.formState.errors.pallette.primary.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="secondary-color">Secondary Color</Label>
                <Input
                  id="secondary-color"
                  type="color"
                  className="h-10 w-full"
                  disabled={sending}
                  {...form.register('pallette.secondary')}
                />
                {form.formState.errors.pallette?.secondary && (
                  <p className="text-red-500 text-sm">{form.formState.errors.pallette.secondary.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accent-color">Accent Color</Label>
                <Input
                  id="accent-color"
                  type="color"
                  className="h-10 w-full"
                  disabled={sending}
                  {...form.register('pallette.accent')}
                />
                {form.formState.errors.pallette?.accent && (
                  <p className="text-red-500 text-sm">{form.formState.errors.pallette.accent.message}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-md" style={{ background: form.watch('pallette.primary') }} />
              <div className="h-10 w-10 rounded-md" style={{ background: form.watch('pallette.secondary') }} />
              <div className="h-10 w-10 rounded-md" style={{ background: form.watch('pallette.accent') }} />
              <p className="text-muted-foreground">Preview your color palette.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allowed Domains</CardTitle>
            <CardDescription>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Input
                    type="text"
                    placeholder="add a domain"
                    disabled={sending}
                    {...form.register('currentDomain')}
                  />
                  <Button
                    variant="outline"
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      const pattern = /^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/
                      const currentDomain = form.watch('currentDomain');
                      const isValidDomain = pattern.test(currentDomain || '');
                      const allowedDomains = form.watch('allowedDomains');

                      if (allowedDomains.includes(currentDomain || '')) {
                        form.setError('currentDomain', { message: 'Domain already exists' });
                        return;
                      }

                      if (!isValidDomain) {
                        form.setError('currentDomain', { message: 'Please enter a valid domain' });
                        return;
                      }

                      form.clearErrors('currentDomain');
                      form.setValue('allowedDomains', [currentDomain || '', ...allowedDomains]);
                      form.setValue('currentDomain', '');
                    }}
                  >
                    Add
                  </Button>
                </div>
                {form.formState.errors.currentDomain && (
                  <p className="text-sm text-red-500">{form.formState.errors.currentDomain.message}</p>
                )}
                {form.formState.errors.allowedDomains && (
                  <p className="text-sm text-red-500">{form.formState.errors.allowedDomains.message}</p>
                )}
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.watch('allowedDomains').map((domain, index) => (
              <li key={domain + index} className="flex items-center justify-between bg-secondary p-2 rounded-md">
                <span>{domain}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={sending}
                  onClick={() => {
                    const newDomains = [...form.watch('allowedDomains')];
                    newDomains.splice(index, 1);
                    form.setValue('allowedDomains', newDomains);
                  }}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove {domain}</span>
                </Button>
              </li>
            ))}
          </CardContent>
        </Card>
        <InviteeList
          title="Team Members"
          disabled={sending}
          values={['admin', 'user']}
          value={Object.fromEntries(form.watch('invitee').map((invitee) => [invitee.email, invitee.role]))}
          onChange={value => {
            form.setValue('invitee', Object.entries(value).map(([email, role]) => ({ email, role })));
          }}
        />
        <Card>
          <CardHeader>
            <CardTitle>Terms Templates</CardTitle>
            <CardDescription>Upload your standard terms that users have to sign when they sign up to your platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="individual-contract">Individual Terms Template</Label>
              <Input
                id="individual-contract"
                type="file"
                accept=".pdf"
                onChange={handleContractChange('individualContract')}
                disabled={sending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="co-applicant-contract">Co-Applicant Terms Template</Label>
              <Input
                id="co-applicant-contract"
                type="file"
                accept=".pdf"
                onChange={handleContractChange('coApplicantContract')}
                disabled={sending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="business-contract">Business Terms Template</Label>
              <Input
                id="business-contract"
                type="file"
                accept=".pdf"
                onChange={handleContractChange('businessContract')}
                disabled={sending}
              />
            </div>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" className="w-full sm:w-auto" disabled={sending}>
            {sending ? 'Sending...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </form>
  );
}