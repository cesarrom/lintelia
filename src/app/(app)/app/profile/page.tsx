import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { BellIcon, CheckIcon, CreditCardIcon, MoveIcon, MoveVerticalIcon } from "lucide-react"
import Link from "next/link"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

const PersonalInformation = () => {
  return (
    <Card x-chunk="dashboard-05-chunk-4">
      <CardHeader className="flex flex-row items-start bg-muted/50">
        <div className="grid gap-0.5">
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>View and update your profile details.</CardDescription>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <div className="h-3.5 w-3.5" />
            <span className="lg:sr-only xl:not-sr-only xl:whitespace-nowrap">Edit</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-sm">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold">Name</div>
              <div>John Doe</div>
            </div>
            <div>
              <div className="font-semibold">Email</div>
              <div>john@example.com</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold">Phone</div>
              <div>+1 (555) 555-5555</div>
            </div>
            <div>
              <div className="font-semibold">Address</div>
              <div>
                123 Main St.
                <br />
                Anytown, CA 12345
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Products = () => {
  return (
    <Card className="overflow-hidden" x-chunk="dashboard-05-chunk-4">
      <CardHeader className="flex flex-row items-start bg-muted/50">
        <div className="grid gap-0.5">
          <CardTitle>Products</CardTitle>
          <CardDescription>View your account balances and details.</CardDescription>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" className="h-8 gap-1">
            <div className="h-3.5 w-3.5" />
            <span className="lg:sr-only xl:not-sr-only xl:whitespace-nowrap">Add Account</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 text-sm">
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6" />
              <div>
                <div className="font-medium">Checking Account</div>
                <div className="text-xs text-muted-foreground">*1234</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">$12,345.67</div>
              <div className="text-xs text-muted-foreground">Available Balance</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6" />
              <div>
                <div className="font-medium">Savings Account</div>
                <div className="text-xs text-muted-foreground">*5678</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">$23,456.89</div>
              <div className="text-xs text-muted-foreground">Available Balance</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6" />
              <div>
                <div className="font-medium">Credit Card</div>
                <div className="text-xs text-muted-foreground">*4321</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">$4,567.89</div>
              <div className="text-xs text-muted-foreground">Available Credit</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const Transactions = () => {
  return (
    <Card x-chunk="dashboard-05-chunk-3">
      <CardHeader className="px-7">
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="hidden sm:table-cell">Account</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>2024-05-01</TableCell>
              <TableCell>Grocery Store</TableCell>
              <TableCell className="hidden sm:table-cell">Checking</TableCell>
              <TableCell className="text-right">-$75.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>2024-04-30</TableCell>
              <TableCell>Payroll</TableCell>
              <TableCell className="hidden sm:table-cell">Checking</TableCell>
              <TableCell className="text-right">+$2,500.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>2024-04-29</TableCell>
              <TableCell>Rent</TableCell>
              <TableCell className="hidden sm:table-cell">Checking</TableCell>
              <TableCell className="text-right">-$1,200.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>2024-04-28</TableCell>
              <TableCell>Transfer</TableCell>
              <TableCell className="hidden sm:table-cell">Savings</TableCell>
              <TableCell className="text-right">+$500.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>2024-04-27</TableCell>
              <TableCell>Online Purchase</TableCell>
              <TableCell className="hidden sm:table-cell">Credit Card</TableCell>
              <TableCell className="text-right">-$75.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <div className="text-xs text-muted-foreground">
          Showing <strong>5</strong> of <strong>25</strong> transactions
        </div>
      </CardFooter>
    </Card>
  );
}

const QuickActions = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Links</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
          <Link
            href="#"
            className="flex items-center gap-2 rounded-md bg-accent p-3 text-accent-foreground hover:bg-accent/90"
            prefetch={false}
          >
            <MoveIcon className="h-6 w-6" />
            <span>Transfer Funds</span>
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 rounded-md bg-accent p-3 text-accent-foreground hover:bg-accent/90"
            prefetch={false}
          >
            <BellIcon className="h-6 w-6" />
            <span>Pay Bills</span>
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 rounded-md bg-accent p-3 text-accent-foreground hover:bg-accent/90"
            prefetch={false}
          >
            <CheckIcon className="h-6 w-6" />
            <span>Deposit Checks</span>
          </Link>
          <Link
            href="#"
            className="flex items-center gap-2 rounded-md bg-accent p-3 text-accent-foreground hover:bg-accent/90"
            prefetch={false}
          >
            <CreditCardIcon className="h-6 w-6" />
            <span>Apply for Loan</span>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Profile() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:flex-1">
          <PersonalInformation />
        </div>
        <div className="lg:flex-1">
          <Products />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:flex-1">
          <Transactions />
        </div>
        <div>
          <QuickActions />
        </div>
      </div>
    </div>
  );
}