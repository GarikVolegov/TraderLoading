import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoButtonProps {
  title?: string;
  description: string;
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * Tap-friendly info trigger that keeps titles clean on mobile by moving
 * descriptions and helper copy into an on-demand glass popover.
 */
export function InfoButton({
  title,
  description,
  className,
  align = "start",
}: InfoButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={title ? `Info: ${title}` : "Info"}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-64 rounded-lg border border-border/70 bg-card/95 p-3 text-xs shadow-xl backdrop-blur-xl"
      >
        {title ? (
          <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
            {title}
          </p>
        ) : null}
        <p className="leading-relaxed text-muted-foreground">{description}</p>
      </PopoverContent>
    </Popover>
  );
}
