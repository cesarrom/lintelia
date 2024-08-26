import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import React from "react"

export default function TenantOnboardingPage() {
  return (
    <div className="container max-w-4xl mx-auto p-6 sm:p-8 md:p-10">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Tenant Setup</h1>
          <p className="text-muted-foreground">Configure your tenant settings to get started.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Tenant Details</CardTitle>
            <CardDescription>Set the basic information for your tenant.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input id="tenant-name" placeholder="Enter tenant name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="domain-name">Domain Name</Label>
                <Input id="domain-name" placeholder="Enter domain name" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="logo-url">Logo URL</Label>
              <Input id="logo-url" placeholder="Enter logo URL" />
              <div className="flex items-center gap-2">
                <img
                  src="/placeholder.svg"
                  width="48"
                  height="48"
                  alt="Logo"
                  className="rounded-md"
                  style={{ aspectRatio: "48/48", objectFit: "cover" }}
                />
                <p className="text-muted-foreground">Preview your logo here.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>Choose your primary, secondary, and accent colors.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="primary-color">Primary Color</Label>
                <Input id="primary-color" type="color" className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="secondary-color">Secondary Color</Label>
                <Input id="secondary-color" type="color" className="h-10 w-full" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="accent-color">Accent Color</Label>
                <Input id="accent-color" type="color" className="h-10 w-full" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-md bg-primary" />
              <div className="h-10 w-10 rounded-md bg-secondary" />
              <div className="h-10 w-10 rounded-md bg-accent" />
              <p className="text-muted-foreground">Preview your color palette.</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
            <CardDescription>Select the subscription plan for your tenant.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select subscription plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
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
          <Button type="submit" className="w-full sm:w-auto">
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}