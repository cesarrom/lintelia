import { BellIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import Link from "next/link";

export const Notifications = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <BellIcon className="h-6 w-6" />
          <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
            3
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-4">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-4">
          <div className="grid grid-cols-[25px_1fr] items-start gap-3">
            <div className="flex h-2 w-2 translate-y-1.5 rounded-full bg-blue-500" />
            <div className="grid gap-1">
              <p className="text-sm font-medium">Your order has been shipped</p>
              <p className="text-sm text-muted-foreground">5 minutes ago</p>
            </div>
          </div>
          <div className="grid grid-cols-[25px_1fr] items-start gap-3">
            <div className="flex h-2 w-2 translate-y-1.5 rounded-full bg-blue-500" />
            <div className="grid gap-1">
              <p className="text-sm font-medium">Your subscription has been renewed</p>
              <p className="text-sm text-muted-foreground">1 hour ago</p>
            </div>
          </div>
          <div className="grid grid-cols-[25px_1fr] items-start gap-3">
            <div className="flex h-2 w-2 translate-y-1.5 rounded-full bg-blue-500" />
            <div className="grid gap-1">
              <p className="text-sm font-medium">Your account password has been changed</p>
              <p className="text-sm text-muted-foreground">3 days ago</p>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Link href="/app/notifications" className="flex items-center justify-between" prefetch={false}>
            <span>View all notifications</span>
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}