import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import Link from "next/link"
import React from "react"
import moment from 'moment';

const statuses = {
  active: <div className="px-2 py-1 rounded-full bg-green-100 text-green-900 text-xs font-medium">Active</div>,
  closed: <div className="px-2 py-1 rounded-full bg-red-100 text-red-900 text-xs font-medium">Closed</div>,
  draft: <div className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-900 text-xs font-medium">Draft</div>,
} as const;

export default function FormsPage() {
  const forms: Array<{ id: string, name: string, description: string, createdAt: string, status: keyof typeof statuses, responses: number }> = React.useMemo(() => [
    {
      id: "6",
      name: "Fix on Date of Birth",
      description: "Now it is a Date field, not a text field",
      createdAt: "2024-08-12",
      status: "draft",
      responses: 0,
    },
    {
      id: "5",
      name: "KYC, regulations 08/2024",
      description: "Family Information is now required",
      createdAt: "2024-08-01",
      status: "active",
      responses: 125,
    },
    {
      id: "4",
      name: "KYC, regulations 12/2023",
      description: "A picture of your face is now required",
      createdAt: "2023-12-01",
      status: "closed",
      responses: 84,
    },
    {
      id: "3",
      name: "Proposal for a new product",
      description: "House investing product might be a good idea",
      createdAt: "2023-05-23",
      status: "draft",
      responses: 0,
    },
    {
      id: "2",
      name: "KYC, regulations 02/2023",
      description: "Labs for blood type and eye color are now required",
      createdAt: "2023-02-23",
      status: "closed",
      responses: 643,
    },
    {
      id: "1",
      name: "Default form",
      description: "General form for all banking providers",
      createdAt: "2022-11-15",
      status: "closed",
      responses: 2534,
    }
  ], []);
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
          <Card key={form.id + form.name} className="shadow-md">
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
        ))}
      </main>
    </div>
  )
}