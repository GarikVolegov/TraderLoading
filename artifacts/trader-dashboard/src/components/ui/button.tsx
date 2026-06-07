import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

export function buttonVariants({
  variant = "default",
  size = "default",
}: Pick<ButtonProps, "variant" | "size"> = {}) {
  const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";
  const variants = {
    default: "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]",
    destructive: "bg-destructive text-destructive-foreground shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-destructive/90",
    outline: "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline",
  };
  const sizes = {
    default: "h-11 px-5 py-2",
    sm: "h-9 rounded-lg px-3 text-xs",
    lg: "h-12 rounded-2xl px-8 text-lg",
    icon: "h-11 w-11",
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
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
