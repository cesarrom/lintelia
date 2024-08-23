"use client";
import Link from "next/link"
import { Select, SelectContent, SelectItem } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ListOrderedIcon } from "lucide-react"
import React from "react"

export default function Transactions() {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const transactions = React.useMemo(() => [
  ], []);
  return (
    <section className="container px-4 mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <div>
          {!isAdmin && (
            <Link href="/app/transactions/new" className="btn btn-primary" prefetch={false}>
              New Transaction
            </Link>
          )}
          <Button variant={isAdmin ? "outline" : "default"} onClick={() => setIsAdmin(false)}>
            Client View
          </Button>
          <Button variant={isAdmin ? "default" : "outline"} onClick={() => setIsAdmin(true)}>
            Admin View
          </Button>
        </div>
      </div>
      {isAdmin && (
        <div className="mb-4 grid gap-4 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Filter by:</span>
            <Select defaultValue="all">
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Input type="search" placeholder="Search transactions..." className="max-w-xs" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="ml-auto">
                  <ListOrderedIcon className="w-4 h-4" />
                  <span className="sr-only">Sort</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Date (newest)</DropdownMenuItem>
                <DropdownMenuItem>Date (oldest)</DropdownMenuItem>
                <DropdownMenuItem>Amount (highest)</DropdownMenuItem>
                <DropdownMenuItem>Amount (lowest)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {new Array(10).fill(null).map((_, i) => (
              <TableRow key={i}>
                <TableCell>2023-05-{String(i + 1).padStart(2, "0")}</TableCell>
                <TableCell>
                  <span className="font-medium">Example Transaction</span>
                  <span className="block text-sm text-muted-foreground">Example description</span>
                </TableCell>
                <TableCell>Deposit</TableCell>
                <TableCell>$100.00</TableCell>
                <TableCell>
                  <Badge variant="secondary">Pending</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {isAdmin ?
                      <>
                        <Link href="/app/transactions/1">
                          <Button size="sm" variant="outline">
                            Review
                          </Button>
                        </Link>
                        <Button size="sm" variant="default">
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive">
                          Reject
                        </Button>
                      </> :
                      <Link href="/app/transactions/1">
                        <Button size="sm" variant="outline">
                          View
                        </Button>
                      </Link>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}