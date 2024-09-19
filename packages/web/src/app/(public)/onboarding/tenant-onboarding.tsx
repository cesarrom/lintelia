'use client';
import React from "react";
import { Formik, Field } from 'formik';
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createTenant } from "@/actions/tenants/createTenant";
import { CreateTenant } from "@fintivio-sst/core/services/tenants.service";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, XIcon } from "lucide-react";

type CustomCreateTenant = CreateTenant & { currentEmail: string; currentDomain: string; };

export default function TenantOnboardingPage() {
  const [_, startTransition] = React.useTransition();
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
  const router = useRouter();
  return (
    <Formik
      initialValues={initialValues}
      validate={values => {
        const errors = {};
        // if (!values.email) {
        //   errors.email = 'Required';
        // } else if (
        //   !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
        // ) {
        //   errors.email = 'Invalid email address';
        // }
        return errors;
      }}
      onSubmit={async (values: CustomCreateTenant) => {
        startTransition(async () => {
          try {
            await createTenant(values)
            router.push("/app/dashboard");
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
                  <Input id="name" placeholder="Enter tenant name" name="name" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.name} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input id="domain" placeholder="Enter domain name" name="domain" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.domain} />
                  <CardDescription>{values.domain ? `https://${values.domain}.fintivio.org/` : ''}</CardDescription>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <Input id="addressLine1" placeholder="Enter address line 1" required disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.addressLine1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <Input id="addressLine2" placeholder="Enter address line 2 (optional)" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.addressLine2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input id="city" placeholder="Enter city" required disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.city} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province</Label>
                    <Input id="state" placeholder="Enter state or province" required disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.state} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Field
                      name="country"
                      render={() => (
                        <Select required onValueChange={(value: string) => setFieldValue('country', value)} value={values.country} disabled={isSubmitting} defaultValue={values.country}>
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Zip/Postal Code</Label>
                    <Input id="zipCode" placeholder="Enter zip or postal code" required disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.zipCode} name="zipCode" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Working Hours</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="time"
                      name="startWorkingHour"
                      required
                      disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.startWorkingHour}
                    />
                    <span>to</span>
                    <Input
                      type="time"
                      name="endWorkingHour"
                      disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.endWorkingHour}
                      required
                    />
                  </div>
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
                  <Input id="logoUrl" placeholder="Enter logo URL" name="logoUrl" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.logoUrl} />
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
                    <Input id="primary-color" type="color" className="h-10 w-full" name="pallette.primary" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.pallette.primary} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="secondary-color">Secondary Color</Label>
                    <Input id="secondary-color" type="color" className="h-10 w-full" name="pallette.secondary" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.pallette.secondary} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="accent-color">Accent Color</Label>
                    <Input id="accent-color" type="color" className="h-10 w-full" name="pallette.accent" disabled={isSubmitting} onChange={handleChange} onBlur={handleBlur} value={values.pallette.accent} />
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
                      <Input type="text" placeholder="add a domain" disabled={isSubmitting} name="currentDomain" onChange={handleChange} onBlur={handleBlur} value={values.currentDomain} />
                      <Button variant="outline" type="button" onClick={() => {
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
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {
                  values.allowedDomains.map((domain, index) => {
                    return <li key={domain} className="flex items-center justify-between bg-secondary p-2 rounded-md" >
                      <span>{domain}</span>
                      <Button variant="ghost" size="icon" onClick={() => {
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
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>
                  <div className="flex items-center space-x-2">
                    <Input type="email" placeholder="Add email" disabled={isSubmitting} name="currentEmail" onChange={handleChange} onBlur={handleBlur} value={values.currentEmail} />
                    <Button variant="outline" type="button" onClick={() => {
                      setFieldValue('invitee', [{ email: values.currentEmail, role: 'admin' }, ...values.invitee]);
                      setFieldValue('currentEmail', '');
                    }}>Add</Button>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {
                  values.invitee.map((person, index) => {
                    const initials = person.email.split('@')[0].slice(0, 2).toUpperCase();
                    // externalize these values and add the roles and permissions from the document received
                    const roles = {
                      admin: 'Admin',
                      reviewer: 'Reviewer',
                    };

                    return (
                      <div className="flex items-center space-x-4" key={person.email}>
                        <Avatar>
                          <AvatarImage src="/placeholder-user.jpg" alt={person.email} />
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">{person.email}</p>
                        </div>
                        <Select
                          name={`invitee.${index}.role`}
                          value={person.role}
                          onValueChange={(value) => setFieldValue(`invitee.${index}.role`, value)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(roles).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-2"
                          type="button"
                          onClick={() => {
                            const newInvitee = [...values.invitee];
                            newInvitee.splice(index, 1);
                            setFieldValue('invitee', newInvitee);
                          }}
                          disabled={isSubmitting}
                        >
                          <XIcon className="w-4 h-4" />
                          <span className="sr-only">Remove</span>
                        </Button>
                      </div>
                    );
                  })
                }
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
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                Save Settings
              </Button>
            </div>
          </div>
        </form>
      )
      }
    </Formik >

  )
}