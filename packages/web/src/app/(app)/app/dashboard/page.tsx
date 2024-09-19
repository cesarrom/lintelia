
"use client"
/**
 * v0 by Vercel.
 * @see https://v0.dev/t/hfdp4kiIKbm
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { DollarSignIcon, FileTextIcon, MessageCircleIcon, MoveHorizontalIcon, UserIcon, UserPlusIcon } from "lucide-react"
import { useSession } from "@/providers/session/session.provider"

export default function Dashboard() {
  const session = useSession();

  console.log(session);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
          <CardDescription>Overview of your business performance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                <DollarSignIcon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">$45,231</div>
              <div className="mt-1 text-xs text-muted-foreground">+12.4% from last month</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">New Customers</div>
                <UserPlusIcon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">124</div>
              <div className="mt-1 text-xs text-muted-foreground">+6.1% from last month</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Transactions</div>
                <DollarSignIcon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">1,234</div>
              <div className="mt-1 text-xs text-muted-foreground">+4.2% from last month</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Active Users</div>
                <UserIcon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">2,345</div>
              <div className="mt-1 text-xs text-muted-foreground">+8.9% from last month</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Forms</CardTitle>
          <CardDescription>Manage your forms and review responses.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Manage Forms</div>
                <FileTextIcon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">12</div>
              <div className="mt-1 text-xs text-muted-foreground">Active forms</div>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">Review Responses</div>
                <MessageCircleIcon className="h-5 w-5" />
              </div>
              <div className="mt-2 text-2xl font-bold">345</div>
              <div className="mt-1 text-xs text-muted-foreground">Unread responses</div>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>View and manage your recent transactions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>#1234</TableCell>
                <TableCell>2023-04-15</TableCell>
                <TableCell>$250.00</TableCell>
                <TableCell>
                  <Badge variant="secondary">Completed</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoveHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Refund</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>#1233</TableCell>
                <TableCell>2023-04-12</TableCell>
                <TableCell>$75.00</TableCell>
                <TableCell>
                  <Badge variant="outline">Pending</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoveHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Refund</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>#1232</TableCell>
                <TableCell>2023-04-10</TableCell>
                <TableCell>$120.00</TableCell>
                <TableCell>
                  <Badge variant="secondary">Completed</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoveHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Refund</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

