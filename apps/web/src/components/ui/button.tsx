'use client';

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useGroupLock } from "@/lib/hooks/use-group-lock"

const buttonVariants = cva(
  "ui-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&>svg]:mx-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs shadow-inset-highlight hover:bg-primary/90 active:bg-primary",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs shadow-inset-highlight hover:bg-destructive/90",
        outline:
          "border border-input bg-background text-foreground shadow-xs hover:bg-accent hover:border-foreground/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "text-foreground/80 hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5",
        sm: "h-8 rounded-md px-2.5 text-[13px]",
        lg: "h-11 rounded-lg px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  groups?: string[]
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, groups, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isLocked = groups ? useGroupLock(groups) : false;
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLocked}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
