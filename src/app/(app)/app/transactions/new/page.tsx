/**
 * v0 by Vercel.
 * @see https://v0.dev/t/njWhsMpikHI
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import { Label } from "@/components/ui/label"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PlusIcon } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import Link from "next/link"

export default function Component() {
  return (
    <div className="container mx-auto max-w-2xl py-12">
      <h1 className="mb-8 text-3xl font-bold">New Money Transfer</h1>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <Label htmlFor="from-account">From Account</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account1">Account 1</SelectItem>
                <SelectItem value="account2">Account 2</SelectItem>
                <SelectItem value="account3">Account 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="to-account">To Account</Label>
            <div className="flex items-center gap-2">
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="account1">Account 1</SelectItem>
                  <SelectItem value="account2">Account 2</SelectItem>
                  <SelectItem value="account3">Account 3</SelectItem>
                </SelectContent>
              </Select>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <PlusIcon className="h-5 w-5" />
                    <span className="sr-only">Create New Account</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Account</DialogTitle>
                    <DialogDescription>Enter the details of the new account you want to transfer to.</DialogDescription>
                  </DialogHeader>
                  <div className="px-4 py-6 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-account-name">Account Name</Label>
                      <Input id="new-account-name" placeholder="Enter account name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-account-number">Account Number</Label>
                      <Input id="new-account-number" placeholder="Enter account number" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-account-type">Account Type</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">Checking</SelectItem>
                          <SelectItem value="savings">Savings</SelectItem>
                          <SelectItem value="credit-card">Credit Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Save Account</Button>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" type="number" placeholder="Enter amount" />
        </div>
        <div>
          <Label htmlFor="reason">Reason</Label>
          <Textarea id="reason" placeholder="Enter reason for transfer" className="min-h-[100px]" />
        </div>
        <div>
          <Label htmlFor="documents">Support Documents</Label>
          <Input id="documents" type="file" multiple />
        </div>
        <div className="rounded-lg border bg-muted p-4">
          <h2 className="mb-4 text-xl font-bold">Transfer Summary</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="font-medium">Total Amount:</div>
            <div className="text-right">$100.00</div>
            <div className="font-medium">Fees:</div>
            <div className="text-right">$2.50</div>
            <div className="font-medium">Total:</div>
            <div className="text-right font-bold">$102.50</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Link href="/app/transactions">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Link href="/app/transactions">
            <Button type="submit">Transfer</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
