import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export function buttonVariants({
  variant = "default",
  size = "default",
}: Pick<ButtonProps, "variant" | "size"> = {}) {
  const baseStyles = "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]";
  const variants = {
    default: "bg-primary text-primary-foreground shadow-[0_0_0_1px_hsl(var(--primary)/0.16),0_10px_22px_hsl(var(--primary)/0.12)] hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground shadow-[0_0_0_1px_hsl(var(--destructive)/0.16)] hover:bg-destructive/90",
    outline: "border border-border/60 bg-card/50 text-foreground hover:border-primary/45 hover:text-primary",
    secondary: "bg-secondary/80 text-secondary-foreground hover:bg-secondary",
    ghost: "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
    link: "min-h-0 rounded-none px-0 text-primary underline-offset-4 hover:underline",
    glass: "glass-bar text-foreground hover:text-primary hover:border-primary/40",
  };
  const sizes = {
    default: "px-4 py-2 text-sm",
    sm: "min-h-10 rounded-md px-3 text-xs",
    lg: "min-h-12 px-6 text-base",
    icon: "h-11 w-11 p-0",
  };

  return cn(baseStyles, variants[variant], sizes[size]);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isLoading || disabled}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
