'use client';
import React from "react";
import { Formik, Field, FormikErrors } from 'formik';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTenant } from "@/actions/tenants";
import { CreateTenant } from "@fintivio-sst/core/services/tenants.service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, XIcon } from "lucide-react";
import * as Yup from 'yup';
import { InviteeList } from "@/components/InviteApplicants";

type CustomCreateTenant = CreateTenant & { currentEmail: string; currentDomain: string; };

export default function TenantOnboardingPage() {
  const [sending, startTransition] = React.useTransition();
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
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      startWorkingHour: '',
      endWorkingHour: '',
    }) as CustomCreateTenant,
    []);
  const schema = Yup.object().shape({
    name: Yup.string().max(255, 'Cannot exceed 255 characters').required('Required'),
    domain: Yup.string().matches(/^[a-z0-9-]+$/, 'May only contain numbers, lowercase letters, and dashes').max(255, 'Cannot exceed 255 characters').required('Required'),
    logoUrl: Yup.string().max(255, 'Cannot exceed 255 characters'),
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
  });

  // TODO: show in the ui that the saving is in progress and when it is done

  const getErrorMessage = (errors: FormikErrors<CustomCreateTenant>) => {
    if (!errors || !Object.values(errors).length) {
      return null;
    }

    let { key, val } = Object.entries(errors).map(([key, val]) => ({ key, val }))[0];

    let [errorMessage] = [val].flat();

    let limit = 30;

    while (errorMessage && typeof errorMessage !== 'string') {
      const [message] = [Object.values(errorMessage)[0]].flat();
      errorMessage = message;

      limit -= 1;

      if (limit < 0) {
        console.error('Error message processing is too long, aborting');
        break;
      }
    }

    const strMessage = errorMessage as string;

    if (strMessage) {
      return <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        {key}: {strMessage}
      </div>
    }

    return null;
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={schema}
      onSubmit={(values: CustomCreateTenant) => {
        startTransition(async () => {
          try {
            await createTenant(values)
            const [currentSchema] = window.location.href.split('://');
            window.location.href = `${currentSchema}://${values.domain}.${window.location.host}/app/dashboard`;
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
          {getErrorMessage(errors)}
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold">Organization Setup</h1>
              <p className="text-muted-foreground">Configure your tenant settings to get started.</p>
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
                            <SelectItem value="us">United States</SelectItem>
                            <SelectItem value="ca">Canada</SelectItem>
                            <SelectItem value="uk">United Kingdom</SelectItem>
                            {/* Add more countries as needed */}
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
                  <Label>Working Hours</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="time"
                      name="startWorkingHour"
                      required
                      disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.startWorkingHour}
                    />
                    <span>to</span>
                    <Input
                      type="time"
                      name="endWorkingHour"
                      disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.endWorkingHour}
                      required
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
                  <Input id="logoUrl" placeholder="Enter logo URL" name="logoUrl" disabled={isSubmitting || sending} onChange={handleChange} onBlur={handleBlur} value={values.logoUrl} />
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