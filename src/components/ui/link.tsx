import * as React from "react"
import BaseLink from "next/link"
import { cva, type VariantProps } from "class-variance-authority"
import { useGroupLock, useGroupLocker } from "@/lib/hooks/use-group-lock"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
const linkVariants = cva(
  "inline-flex items-center justify-start whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-primary hover:text-primary/90",
        destructive: "text-destructive hover:text-destructive/90",
        secondary: "text-secondary-foreground hover:text-secondary-foreground/80",
        ghost: "hover:text-accent-foreground",
        underline: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface LinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement>,
    VariantProps<typeof linkVariants> {
  href: string
  groups?: string[]
  disableOnClick?: boolean
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, variant, groups = [], href, disableOnClick = false, target, onClick, ...props }, ref) => {
    const isLocked = useGroupLock(groups)
    const { lock, unlock } = useGroupLocker()
    const router = useRouter()
    
    if (isLocked) {
      return (
        <span
          className={cn(linkVariants({ variant, className }), "opacity-50 cursor-not-allowed")}
          {...props}
        />
      )
    }

    const handleClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!disableOnClick && groups.length > 0) {
        e.preventDefault()
        lock(groups)
        
        if (target === '_blank') {
          window.open(href, '_blank')
          setTimeout(() => unlock(groups), 100)
        } else {
          try {
            await router.push(href)
          } finally {
            unlock(groups)
          }
        }
      }

      onClick?.(e)
    }

    return (
      <BaseLink
        href={href}
        target={target}
        className={cn(linkVariants({ variant, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)

Link.displayName = "CustomLink"

export { Link, linkVariants }
