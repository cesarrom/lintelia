'use client';
import React, { useCallback, useEffect } from "react";
import { Formik, Field, FormikErrors } from 'formik';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { type APICreateTenantRequest, CreatedTenant, createTenant } from "@/actions/tenants";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { v4 as uuid } from 'uuid';
import { X } from "lucide-react";
import * as Yup from 'yup';
import { InviteeList } from "@/components/InviteApplicants";
import countries from '@/app/(app)/onboarding/FormViewer/datasources/countries.json'
import { uploadFile } from "@/actions/files";
import timezones from './timezones.json';
import { TimePicker } from "@/components/TimePicker";
import { Gothic_A1 } from "next/font/google";
type CustomCreateTenant = APICreateTenantRequest & {
  currentEmail: string; currentDomain: string; logoName: string;
  timezone: string;
};

export default function TenantOnboardingPage() {
  const [sending, startTransition] = React.useTransition();
  const [tenant, setTenant] = React.useState<CreatedTenant | null>(null);
  const initialValues = React.useMemo(
    () => ({
      name: '',
      domain: '',
      logoUrl: '',
      plan: '',
      pallette: {
        primary: '#000000',
        secondary: '#000000',
        accent: '#000000',
      },
      invitee: [],
      allowedDomains: [],
      currentEmail: '',
      currentDomain: '',
      logoName: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      startWorkingHour: '',
      endWorkingHour: '',
      individualContract: '',
      coApplicantContract: '',
      businessContract: '',
      timezone: '',
    }) as CustomCreateTenant,
    []);
  const schema = Yup.object().shape({
    name: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    domain: Yup.string().matches(/^[a-z0-9-]+$/, 'May only contain numbers, lowercase letters, and dashes').max(255, 'Cannot exceed 255 characters').required('Required'),
    logoUrl: Yup.string(),
    logoName: Yup.string(),
    plan: Yup.string().max(255, 'Cannot exceed 255 characters'),
    pallette: Yup.object().shape({
      primary: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
      secondary: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
      accent: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    }),
    invitee: Yup.array().of(Yup.object({
      email: Yup.string().email('Invalid email').max(255, 'Cannot exceed 255 characters').required('Required'),
      role: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    })),
    allowedDomains: Yup.array().of(Yup.string().max(255, 'Cannot exceed 255 characters')),
    addressLine1: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    addressLine2: Yup.string().max(255, 'Cannot exceed 255 characters'),
    city: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    state: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    country: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    zipCode: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    startWorkingHour: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    endWorkingHour: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    individualContract: Yup.string().required('Required'),
    coApplicantContract: Yup.string().required('Required'),
    businessContract: Yup.string().required('Required'),
    timezone: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
  });

  const handleContractChange = (fieldName: string, setFieldValue: (fieldName: string, val: any) => unknown) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result?.toString().split(',')[1];
        setFieldValue(fieldName, base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const goToDashboard = useCallback(() => {
    const [currentSchema] = window.location.href.split('://');
    window.location.href = `${currentSchema}://${tenant.domain}.${window.location.host}/app/dashboard`;
  }, [tenant]);

  useEffect(() => {
    if (tenant && !tenant.cnameRecords.length) {
      goToDashboard();
    }
  }, [tenant, goToDashboard]);

  if (tenant) {
    return (
      <div className="container max-w-4xl mx-auto p-6 sm:p-8 md:p-10">
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold">DNS Configuration Required</h1>
            <p className="text-muted-foreground mb-6">Please set up the following CNAME records for your domain:</p>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg">
            {tenant.cnameRecords.map((record, index) => (
              <div key={index} className="mb-4 last:mb-0">
                <p className="font-mono bg-white p-3 rounded border">{record.Type}</p>
                <p className="font-mono bg-white p-3 rounded border">{record.Name}</p>
                <p className="font-mono bg-white p-3 rounded border">{record.Value}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={goToDashboard}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={schema}
      onSubmit={(values: CustomCreateTenant) => {
        startTransition(async () => {
          try {
            const [logoUrl, individualContract, coApplicantContract, businessContract] = await Promise.all([
              uploadFile(null, values.logoUrl, values.logoName),
              uploadFile(null, values.individualContract, uuid() + '__individualContract.pdf'),
              uploadFile(null, values.coApplicantContract, uuid() + '__coApplicantContract.pdf'),
              uploadFile(null, values.businessContract, uuid() + '__businessContract.pdf'),
            ]);

            Object.assign(values, { logoUrl, individualContract, coApplicantContract, businessContract });

            const response = await createTenant(values)

            setTenant(response);

          } catch (e) {
            console.error(e);
          }
        });
      }}
    >
      {({
        values,
        handleChange,
        setFieldValue,
        setFieldError,
        handleBlur,
        handleSubmit,
        errors,
        isSubmitting,
        /* and other goodies */
      }) => (
        <form onSubmit={handleSubmit} className="container max-w-4xl mx-auto p-6 sm:p-8 md:p-10">
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold">New institution form</h1>
              <p className="text-muted-foreground">Please fill out the below form to get your institution's profile created.</p>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Set the basic information for your tenant.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="name">Legal Name</Label>
                  <Input id="name" placeholder="Enter tenant name" name="name" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.name} />
                  {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input id="domain" placeholder="Enter domain name" name="domain" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.domain} />
                  <CardDescription>{values.domain ? `https://${values.domain}.fintivio.org/` : ''}</CardDescription>
                  {errors.domain && <p className="text-red-500 text-sm">{errors.domain}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <Input id="addressLine1" placeholder="Enter address line 1" required disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.addressLine1} />
                  {errors.addressLine1 && <p className="text-red-500 text-sm">{errors.addressLine1}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input id="addressLine2" placeholder="Enter address line 2 (optional)" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.addressLine2} />
                  {errors.addressLine2 && <p className="text-red-500 text-sm">{errors.addressLine2}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Enter city" required disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.city} />
                    {errors.city && <p className="text-red-500 text-sm">{errors.city}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province</Label>
                    <Input id="state" placeholder="Enter state or province" required disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.state} />
                    {errors.state && <p className="text-red-500 text-sm">{errors.state}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Field
                      name="country"
                      render={() => (
                        <Select required onValueChange={(value: string) => setFieldValue('country', value)} value={values.country} disabled={isSubmitting || sending} defaultValue={values.country}>
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
                      )}
                    />
                    {errors.country && <p className="text-red-500 text-sm">{errors.country}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip/Postal Code</Label>
                    <Input id="zipCode" placeholder="Enter zip or postal code" required disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.zipCode} name="zipCode" />
                    {errors.zipCode && <p className="text-red-500 text-sm">{errors.zipCode}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Field
                    name="timezone"
                    render={() => (
                      <Select required onValueChange={(value: string) => setFieldValue('timezone', value)} value={values.timezone} disabled={isSubmitting || sending} defaultValue={values.timezone}>
                        <SelectTrigger id="timezone">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          {timezones.map((tz) => (
                            <SelectItem key={tz.value} value={tz.value}>
                              {tz.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.zipCode && <p className="text-red-500 text-sm">{errors.zipCode}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Working Hours</Label>
                  <div className="flex flex-col items-start space-x-2">
                    <Field
                      name="startWorkingHour"
                      render={() => (
                        <TimePicker date={values.startWorkingHour ? new Date(values.startWorkingHour) : undefined} setDate={(date) => setFieldValue('startWorkingHour', date.toISOString())} />
                      )}
                    />
                    <div>To</div>
                    <Field
                      name="endWorkingHour"
                      render={() => (
                        <TimePicker date={values.endWorkingHour ? new Date(values.endWorkingHour) : undefined} setDate={(date) => setFieldValue('endWorkingHour', date.toISOString())} />
                      )}
                    />
                  </div>
                  {errors.startWorkingHour && <p className="text-red-500 text-sm">{errors.startWorkingHour}</p>}
                  {errors.endWorkingHour && <p className="text-red-500 text-sm">{errors.endWorkingHour}</p>}
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
                    name="logoUrl"
                    type="file"
                    disabled={isSubmitting || sending}
                    onBlur={handleBlur}
                    onChange={e => {
                      // we will read the file as a base64 url, and then set that value to the logoUrl field
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setFieldValue('logoUrl', reader.result as string);
                          setFieldValue('logoName', file.name);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {errors.logoUrl && <p className="text-red-500 text-sm">{errors.logoUrl}</p>}
                  <div className="flex items-center gap-2">
                    <img
                      src={values.logoUrl || "/placeholder.svg"}
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
                    <Input id="primary-color" type="color" className="h-10 w-full" name="pallette.primary" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.pallette.primary} />
                    {errors.pallette?.primary && <p className="text-red-500 text-sm">{errors.pallette.primary}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <Input id="secondary-color" type="color" className="h-10 w-full" name="pallette.secondary" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.pallette.secondary} />
                    {errors.pallette?.secondary && <p className="text-red-500 text-sm">{errors.pallette.secondary}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="accent-color">Accent Color</Label>
                    <Input id="accent-color" type="color" className="h-10 w-full" name="pallette.accent" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.pallette.accent} />
                    {errors.pallette?.accent && <p className="text-red-500 text-sm">{errors.pallette.accent}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-md" style={{ background: values.pallette.primary }} />
                  <div className="h-10 w-10 rounded-md" style={{ background: values.pallette.secondary }} />
                  <div className="h-10 w-10 rounded-md" style={{ background: values.pallette.accent }} />
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
                      <Input type="text" placeholder="add a domain" disabled={isSubmitting || sending} name="currentDomain" onChange={handleChange} onBlur={handleBlur} value={values.currentDomain} />
                      <Button variant="outline" type="button" disabled={sending} onClick={() => {
                        const pattern = /^([a-zA-Z0-9]+(-[a-zA-Z0-9]+)*\.)+[a-zA-Z]{2,}$/
                        const isValidDomain = pattern.test(values.currentDomain);

                        if (values.allowedDomains.includes(values.currentDomain)) {
                          setFieldError('currentDomain', 'Domain already exists');
                          return;
                        }

                        if (!isValidDomain) {
                          setFieldError('currentDomain', 'Please enter a valid domain');
                          return;
                        }

                        setFieldError('currentDomain', '');
                        setFieldValue('allowedDomains', [values.currentDomain, ...values.allowedDomains]);
                        setFieldValue('currentDomain', '');
                      }}>Add</Button>
                    </div>
                    {errors.currentDomain && <p className="text-sm text-red-500">{errors.currentDomain}</p>}
                    {errors.allowedDomains && <p className="text-sm text-red-500">{errors.allowedDomains}</p>}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {
                  values.allowedDomains.map((domain, index) => {
                    return <li key={domain} className="flex items-center justify-between bg-secondary p-2 rounded-md" >
                      <span>{domain}</span>
                      <Button variant="ghost" size="icon" disabled={sending} onClick={() => {
                        const newDomains = [...values.allowedDomains];
                        newDomains.splice(index, 1);
                        setFieldValue('allowedDomains', newDomains);
                      }}>
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove {domain}</span>
                      </Button>
                    </li>
                  })
                }
              </CardContent>
            </Card>
            <InviteeList
              title="Team Members"
              disabled={isSubmitting || sending}
              values={['admin', 'user']}
              value={Object.fromEntries(values.invitee.map((invitee) => [invitee.email, invitee.role]))}
              onChange={value => {
                setFieldValue('invitee', Object.entries(value).map(([email, role]) => ({ email, role })));
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
                    onChange={handleContractChange('individualContract', setFieldValue)}
                    disabled={sending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="co-applicant-contract">Co-Applicant Terms Template</Label>
                  <Input
                    id="co-applicant-contract"
                    type="file"
                    accept=".pdf"
                    onChange={handleContractChange('coApplicantContract', setFieldValue)}
                    disabled={sending}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="business-contract">Business Terms Template</Label>
                  <Input
                    id="business-contract"
                    type="file"
                    accept=".pdf"
                    onChange={handleContractChange('businessContract', setFieldValue)}
                    disabled={sending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* <Card>
          <CardHeader>
            <CardTitle>User Database</CardTitle>
            <CardDescription>Configure how users will be stored and authenticated.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <RadioGroup>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="managed" id="managed" onClick={() => setValue("managed")} />
                <Label htmlFor="managed">Managed (Recommended)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="ldap" id="ldap" onClick={() => setValue("ldap")} />
                <Label htmlFor="ldap">LDAP</Label>
              </div>
              {value === "ldap" && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="ldap-host">LDAP Host</Label>
                    <Input id="ldap-host" placeholder="Enter LDAP host" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ldap-port">LDAP Port</Label>
                    <Input id="ldap-port" placeholder="Enter LDAP port" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ldap-base-dn">Base DN</Label>
                    <Input id="ldap-base-dn" placeholder="Enter base DN" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ldap-bind-dn">Bind DN</Label>
                    <Input id="ldap-bind-dn" placeholder="Enter bind DN" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ldap-bind-password">Bind Password</Label>
                    <Input id="ldap-bind-password" type="password" placeholder="Enter bind password" />
                  </div>
                </div>
              )}
            </RadioGroup>
          </CardContent>
        </Card> */}
            <div className="flex justify-end">
              <Button type="submit" className="w-full sm:w-auto" disabled={sending}>
                {sending ? 'Sending...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </form>
      )
      }
    </Formik >

  )
}