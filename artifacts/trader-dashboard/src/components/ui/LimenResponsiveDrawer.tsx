// ─── LimenResponsiveDrawer (Adaptive Desktop Dialog / Mobile Bottom Sheet) ──
// Canonical divergent modal architecture for AUREUS OS:
// - On Desktop (lg >= 1024px): Centered imperial dialog with obsidian glass and gold borders.
// - On Mobile (max-width < 1024px): Ergonomic Bottom Sheet (side="bottom") with drag handle,
//   touch swipe-down to dismiss, iOS safe-area insets, and thumb-zone accessibility.

import * as React from "react";
import { useCallback, useRef } from "react";
import { X } from "lucide-react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { synestheticClick } from "@/lib/soundFx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";

export interface LimenResponsiveDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  desktopClassName?: string;
  mobileClassName?: string;
  showCloseButton?: boolean;
}

export function LimenResponsiveDrawer({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  className,
  desktopClassName,
  mobileClassName,
  showCloseButton = true,
}: LimenResponsiveDrawerProps) {
  const isDesktop = useIsDesktop();

  // Swipe-down to dismiss for Mobile Bottom Sheet
  const touchStartYRef = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartYRef.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const dy = endY - touchStartYRef.current;
    touchStartYRef.current = null;

    // Swiped down by > 48px -> close bottom sheet
    if (dy > 48) {
      synestheticClick();
      onOpenChange(false);
    }
  }, [onOpenChange]);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "app-dialog max-w-3xl max-h-[88vh] overflow-y-auto bg-[#07080b]/98 border border-[#C5A059]/30 shadow-[0_16px_50px_rgba(0,0,0,0.9),0_0_24px_rgba(197,160,89,0.1)] text-foreground rounded-xl p-6",
            className,
            desktopClassName
          )}
        >
          {(title || subtitle) && (
            <DialogHeader className="border-b border-[#C5A059]/20 pb-3 mb-4 text-left">
              {title && (
                <DialogTitle className="font-mono text-base font-bold uppercase tracking-wider text-[#E8C56A]">
                  {title}
                </DialogTitle>
              )}
              {subtitle && (
                <DialogDescription className="font-mono text-xs text-slate-400 mt-1">
                  {subtitle}
                </DialogDescription>
              )}
            </DialogHeader>
          )}

          {children}
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile / Tablet: Bottom Sheet
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "app-sheet fixed inset-x-0 bottom-0 z-[100] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[#C5A059]/40 bg-[#07080b]/98 backdrop-blur-2xl p-4 text-foreground shadow-[0_-12px_40px_rgba(0,0,0,0.95)] flex flex-col font-mono select-none",
          className,
          mobileClassName
        )}
        style={{
          paddingBottom: "max(18px, env(safe-area-inset-bottom))",
        }}
      >
        {/* Tactile drag grab handle */}
        <div
          aria-hidden="true"
          className="w-12 h-1 rounded-full bg-[#C5A059]/40 hover:bg-[#C5A059]/70 transition-colors mx-auto mb-2.5 shrink-0"
        />

        {(title || subtitle) && (
          <SheetHeader className="border-b border-[#C5A059]/20 pb-2.5 mb-3 text-left">
            <div className="flex items-center justify-between">
              {title && (
                <SheetTitle className="font-mono text-sm font-bold uppercase tracking-wider text-[#E8C56A] truncate pr-6">
                  {title}
                </SheetTitle>
              )}
              {showCloseButton && (
                <SheetClose asChild>
                  <button
                    type="button"
                    onClick={() => synestheticClick()}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={14} />
                    <span className="sr-only">Chiudi</span>
                  </button>
                </SheetClose>
              )}
            </div>
            {subtitle && (
              <SheetDescription className="font-mono text-[11px] text-slate-400 mt-0.5">
                {subtitle}
              </SheetDescription>
            )}
          </SheetHeader>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-[#C5A059]/30">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
