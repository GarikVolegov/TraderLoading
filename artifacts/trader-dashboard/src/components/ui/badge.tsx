import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "whitespace-nowrap inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover-elevate",
  {
    variants: {
      variant: {
        default:
          "bg-primary/10 text-primary border-primary/30",
        gold:
          "bg-primary/15 text-primary border-primary/40 shadow-[0_0_12px_rgba(197,160,89,0.15)]",
        secondary:
          "bg-secondary/70 text-muted-foreground border-border/80",
        destructive:
          "bg-destructive/15 text-destructive border-destructive/35",
        crimson:
          "bg-[#8B1E1E]/20 text-[#ef4444] border-[#8B1E1E]/40 font-mono",
        success:
          "bg-success/15 text-success border-success/35",
        warning:
          "bg-warning/15 text-warning border-warning/35",
        muted:
          "bg-white/5 text-muted-foreground border-white/10",
        outline:
          "text-foreground border border-border",
        brand:
          "bg-primary text-primary-foreground border-primary font-bold shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
