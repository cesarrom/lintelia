import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import Link from "next/link"
import React from "react"
import moment from 'moment';
import { getTenant } from "@/actions/tenants";
import { getAllForms } from "@/actions/forms";
import { getAllApplications } from "@/actions/applications";

const statuses = {
  active: <div className="px-2 py-1 rounded-full bg-green-100 text-green-900 text-xs font-medium">Active</div>,
  inactive: <div className="px-2 py-1 rounded-full bg-red-100 text-red-900 text-xs font-medium">Inactive</div>,
  draft: <div className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-900 text-xs font-medium">Draft</div>,
} as const;

export default async function FormsPage() {
  const tenant = await getTenant();
  const formsResponse = await getAllForms(tenant.domain);

  const applications = await getAllApplications(tenant.domain, 'user');

  const forms = formsResponse.map(f => {

    return ({
      id: f.id,
      name: f.title,
      description: f.description,
      createdAt: f.createdAt,
      status: f.status || 'active',
      responses: applications.filter(a => a.application.formId === f.id).length,
    })
  });

  return (
    <div className="flex flex-col h-full">
      <header className="bg-background border-b px-4 md:px-6 flex items-center justify-between h-16 shrink-0">
        <h1 className="text-lg font-semibold">Form Dashboard</h1>
        <Link href="/app/applications/forms/create">
          <Button>Create New Form</Button>
        </Link>
      </header>
      <main className="flex-1 p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {forms.map(form => (
          <Link key={form.id + form.name} href={`/app/applications/forms/${form.id}`}>
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>{form.name}</CardTitle>
                <CardDescription>{form.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">Created: {moment(form.createdAt, 'YYYY-MM-DD').format("DD MMM YYYY")}</div>
                  {statuses[form.status]}
                </div>
                <div className="mt-2 flex justify-between items-center">
                  <div className="text-2xl font-bold">{form.responses}</div>
                  <div className="text-sm text-muted-foreground">Responses</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </main>
    </div>
  )
}