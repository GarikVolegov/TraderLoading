import { BrandMark } from "@/components/BrandMark";
import { Link, useLocation, useSearch } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { ROOT_ITEMS, rootDestination } from "@/lib/navHubs";
import { Settings, MoreHorizontal } from "lucide-react";
import { SECONDARY_ITEMS } from "@/lib/navHubs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Global navigation never changes its destinations inside a workspace. */
export function BottomNav() {
  const { t } = useLanguage();
  const [location] = useLocation();
  const search = useSearch();
  const active = rootDestination(location, search);
  const renderItems = (desktop: boolean) =>
    ROOT_ITEMS.map((item) => {
      const selected = active === item.id;
      return (
        <Link
          key={item.id}
          href={item.href}
          aria-current={selected ? "page" : undefined}
          className={
            desktop
              ? `relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`
              : `relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-colors ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground"}`
          }
        >
          <item.icon className="h-5 w-5 shrink-0" />
          <span className="whitespace-nowrap">{t(item.labelKey)}</span>
        </Link>
      );
    });
  const more = (desktop: boolean) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t("process.nav.more")} className={desktop
          ? "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary"
          : "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] text-muted-foreground"}>
          <MoreHorizontal className="h-5 w-5" /><span>{t("process.nav.more")}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={desktop ? "right" : "top"} align="end">
        {SECONDARY_ITEMS.map(item => <DropdownMenuItem key={item.id} asChild>
          <Link href={item.href} aria-current={active === item.id ? "page" : undefined} className="min-h-11 gap-3"><item.icon size={17} />{t(item.labelKey)}</Link>
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  return (
    <>
      <nav
        aria-label={t("workspace.navigation")}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] inset-x-3 z-50 rounded-xl border border-border bg-card shadow-lg lg:hidden"
      >
        <div className="mx-auto flex max-w-lg gap-1 p-1">{renderItems(false)}{more(false)}</div>
      </nav>
      <nav
        aria-label={t("workspace.navigation")}
        className="fixed inset-y-0 left-0 z-50 hidden w-[var(--app-inset-left)] flex-col border-r border-border bg-background lg:flex"
      >
        <Link
          href="/"
          className="flex h-14 items-center border-b border-border px-4 text-sm"
        >
          <BrandMark />
        </Link>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {renderItems(true)}

        </div>
        <div className="space-y-1 border-t border-border p-3">
          {more(true)}
          <Link
            href="/settings"
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Settings className="h-4 w-4" />
            {t("nav.settings")}
          </Link>
        </div>
      </nav>
    </>
  );
}
