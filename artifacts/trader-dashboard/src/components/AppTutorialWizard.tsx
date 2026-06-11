import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  LayoutDashboard,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface AppTutorialWizardProps {
  open: boolean;
  onSkip: () => void;
  onFinish: () => void;
}

export function AppTutorialWizard({
  open,
  onSkip,
  onFinish,
}: AppTutorialWizardProps) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);

  const slides = useMemo(
    () => [
      {
        icon: LayoutDashboard,
        title: t("app_tutorial.slide_dashboard_title"),
        body: t("app_tutorial.slide_dashboard_body"),
        tint: "text-primary",
      },
      {
        icon: BookOpen,
        title: t("app_tutorial.slide_journal_title"),
        body: t("app_tutorial.slide_journal_body"),
        tint: "text-sky-400",
      },
      {
        icon: FlaskConical,
        title: t("app_tutorial.slide_tools_title"),
        body: t("app_tutorial.slide_tools_body"),
        tint: "text-amber-400",
      },
      {
        icon: Brain,
        title: t("app_tutorial.slide_zen_community_title"),
        body: t("app_tutorial.slide_zen_community_body"),
        tint: "text-emerald-400",
        companionIcon: MessageCircle,
      },
      {
        icon: MoreHorizontal,
        title: t("app_tutorial.slide_more_title"),
        body: t("app_tutorial.slide_more_body"),
        tint: "text-violet-400",
      },
    ],
    [t],
  );

  const current = slides[index] ?? slides[0];
  const Icon = current.icon;
  const CompanionIcon = current.companionIcon;
  const isFirst = index === 0;
  const isLast = index === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      onFinish();
      return;
    }
    setIndex((value) => Math.min(value + 1, slides.length - 1));
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onSkip()}>
      <DialogContent className="max-w-3xl overflow-hidden border-primary/20 bg-card p-0 shadow-2xl sm:rounded-2xl">
        <div className="grid min-h-[520px] grid-rows-[auto_1fr_auto] sm:min-h-[560px] md:grid-cols-[260px_1fr] md:grid-rows-none">
          <aside className="border-b border-border/40 bg-background/70 p-5 md:border-b-0 md:border-r">
            <DialogHeader className="space-y-2 text-left">
              <DialogTitle className="text-base font-bold">
                {t("app_tutorial.title")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("app_tutorial.progress", {
                  current: index + 1,
                  total: slides.length,
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid grid-cols-5 gap-1.5 md:grid-cols-1">
              {slides.map((slide, slideIndex) => {
                const StepIcon = slide.icon;
                const active = slideIndex === index;
                return (
                  <button
                    key={slide.title}
                    type="button"
                    onClick={() => setIndex(slideIndex)}
                    className={[
                      "flex h-10 items-center justify-center rounded-lg border transition-colors md:h-auto md:justify-start md:gap-3 md:px-3 md:py-2.5",
                      active
                        ? "border-primary/35 bg-primary/10 text-primary"
                        : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-primary/25 hover:text-foreground",
                    ].join(" ")}
                    aria-label={slide.title}
                  >
                    <StepIcon className="h-4 w-4 shrink-0" />
                    <span className="hidden truncate text-xs font-semibold md:block">
                      {slide.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="relative flex min-h-0 flex-col justify-center px-6 py-8 sm:px-8 md:px-10">
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute right-8 top-8 h-28 w-28 rounded-full border border-primary/20" />
              <div className="absolute bottom-12 left-8 h-px w-28 bg-primary/25" />
              <div className="absolute bottom-20 right-16 h-px w-16 bg-border" />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={current.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
                className="relative mx-auto flex max-w-md flex-col items-center text-center"
              >
                <div className="relative mb-6">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border/60 bg-background shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
                    <Icon className={`h-9 w-9 ${current.tint}`} />
                  </div>
                  {CompanionIcon && (
                    <div className="absolute -right-4 -top-4 flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card">
                      <CompanionIcon className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
                  {current.title}
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground sm:text-base">
                  {current.body}
                </p>
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="flex flex-col gap-3 border-t border-border/40 bg-background/65 p-4 sm:flex-row sm:items-center sm:justify-between md:col-start-2">
            <Button type="button" variant="ghost" onClick={onSkip}>
              {t("app_tutorial.skip")}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIndex((value) => Math.max(value - 1, 0))}
                disabled={isFirst}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("app_tutorial.back")}
              </Button>
              <Button type="button" onClick={handleNext}>
                {isLast ? t("app_tutorial.finish") : t("app_tutorial.next")}
                {!isLast && <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
