'use server';
/**
 * v0 by Vercel.
 * @see https://v0.dev/t/rrnVQvqLLKu
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { CheckIcon, EyeIcon, FileIcon, FilterIcon, ListOrderedIcon, MoveVerticalIcon, PlusIcon, XIcon } from "lucide-react"
import React from "react"
import { getAllApplications } from "@/actions/applications"
import { getTenant } from "@/actions/tenants";

export default async function ApplicationsReviews() {
  const tenant = await getTenant();
  const applicantsResponse = await getAllApplications(tenant.domain, 'user');

  const applicants = Object.values(
    Object.fromEntries(
      applicantsResponse.filter(a => !a.application.parentApplicationId).map(
        applicant => [
          applicant.application.id,
          {
            id: applicant.application.id,
            name: applicant.user.name,
            status: applicant.application.status,
            purpose: applicant.application.applicationPurpose,
            documents: ['ID', 'Selfie'],
            risk: JSON.parse(applicant.application.data)?.risk,
          }
        ]
      )
    )
  );

  return (
    <div className="flex-1 bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <FilterIcon className="h-4 w-4" />
                <span>Filter</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by:</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem>Pending</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Approved</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Rejected</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>High Risk</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Medium Risk</DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem>Low Risk</DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <ListOrderedIcon className="h-4 w-4" />
                <span>Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Sort by:</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value="name">
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="risk">Risk Level</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-4">
          <Input type="search" placeholder="Search applications..." className="bg-muted px-4 py-2 rounded-md w-64" />
          <Button>
            <PlusIcon className="h-4 w-4 mr-2" />
            New Application
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Risk Level</TableHead>
              <TableHead>Required Documents</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applicants.map(applicant => (
              <TableRow key={applicant.name + applicant.id}>
                <TableCell>
                  <Link href={"/app/applications/reviews/" + applicant.id} className="font-medium" prefetch={false}>
                    {applicant.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{applicant.purpose}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{applicant.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{applicant.risk}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileIcon className="h-4 w-4" />
                    <span>{applicant.documents.join(", ")}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoveVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={"/app/applications/reviews/" + applicant.id} className="flex items-center gap-2" prefetch={false}>
                          <EyeIcon className="h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="#" className="flex items-center gap-2" prefetch={false}>
                          <CheckIcon className="h-4 w-4" />
                          Approve
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link href="#" className="flex items-center gap-2" prefetch={false}>
                          <XIcon className="h-4 w-4" />
                          Reject
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
