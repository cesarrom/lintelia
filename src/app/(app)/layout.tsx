/**
 * v0 by Vercel.
 * @see https://v0.dev/t/hfdp4kiIKbm
 * Documentation: https://v0.dev/docs#integrating-generated-code-into-your-nextjs-app
 */
import Link from "next/link"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Package2Icon, HomeIcon, FileTextIcon, ChevronRightIcon, DollarSignIcon, MenuIcon, UserPlusIcon, MessageCircleIcon, MoveHorizontalIcon } from "@/components/CustomIcons"
import React from "react"
import { Notifications } from "@/components/Notifications"

export default function AppLayout({ children }: React.PropsWithChildren<unknown>) {
  const menuItems = React.useMemo(() => [
    {
      label: "Dashboard",
      icon: <HomeIcon className="h-5 w-5" />,
      href: "/app/dashboard",
    },
    {
      label: "Applications",
      icon: <FileTextIcon className="h-5 w-5" />,
      children: [
        {
          label: "Forms",
          icon: <FileTextIcon className="h-5 w-5" />,
          href: "/app/applications/forms",
        },
        {
          label: "Review",
          icon: <FileTextIcon className="h-5 w-5" />,
          href: "/app/applications/reviews",
        }
      ]
    },
    {
      label: "Transactions",
      icon: <DollarSignIcon className="h-5 w-5" />,
      href: "/app/transactions",
    },
  ].map((item, i) => {
    if ('children' in item) {
      return (
        <Collapsible className="grid gap-2" key={item.label + i}>
          <CollapsibleTrigger className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground [&[data-state=open]>svg]:rotate-90">
            <div className="flex items-center gap-2">
              {item.icon}
              {item.label}
            </div>
            <ChevronRightIcon className="h-5 w-5 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-2 pl-6">
              {item.children?.map((item, k) => (
                <Link
                  key={k + item.label + i}
                  href={item.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.label + i}
        href={item.href}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted hover:text-foreground"
      >
        {item.icon}
        {item.label}
      </Link>
    );
  }), []);

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 flex-col border-r bg-background p-4 md:flex">
        <div className="mb-6 flex items-center gap-2">
          <Package2Icon className="h-6 w-6" />
          <span className="text-lg font-semibold">Fintivio</span>
        </div>
        <nav className="flex flex-col gap-2">
          {menuItems}
        </nav>
      </aside>
      <div className="flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <MenuIcon className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="md:hidden">
              <nav className="grid gap-4 p-4 text-sm font-medium">
                {menuItems}
              </nav>
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <img
                    src="/placeholder.svg"
                    width={32}
                    height={32}
                    alt="Avatar"
                    className="rounded-full"
                    style={{ aspectRatio: "32/32", objectFit: "cover" }}
                  />
                  <span className="sr-only">Toggle user menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link href="/app/profile">
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem>Support</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Notifications />
        </header>
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

