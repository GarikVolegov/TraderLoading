import { useEffect, useRef, useState } from "react";
import { Link, useRoute, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, BookOpen, Brain, FlaskConical, Archive, Users,
  ArrowLeft, MoreHorizontal,
  Library, Sunrise, Settings, Rocket,
} from "lucide-react";
import { getGetUnreadCountQueryKey, useGetProfile, useGetUnreadCount } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { matchHub, splitHubItems, TORNEI_ITEM } from "@/lib/navHubs";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

// Root hubs (level 0). Archivio is a direct hub; Community/Journal/Zen are
// hubs that, once entered, swap the bar to their own sub-nav (see navHubs.ts).
const ROOT_ITEMS = [
  { href: "/",         icon: LayoutDashboard, labelKey: "nav.home",      isChat: false },
  { href: "/journal",  icon: BookOpen,        labelKey: "nav.journal",   isChat: false },
  { href: "/backtest", icon: FlaskConical,    labelKey: "nav.backtest",  isChat: false },
  { href: "/zen",      icon: Brain,           labelKey: "nav.zen",       isChat: false },
  { href: "/wiki",     icon: Archive,         labelKey: "nav.wiki",      isChat: false },
  { href: "/chat",     icon: Users,           labelKey: "nav.community", isChat: true  },
] as const;

// Desktop-only secondary group (Archivio lives in the root group now).
const SECONDARY_ITEMS = [
  { href: "/library",  icon: Library,  labelKey: "nav.library"  },
  { href: "/routine",  icon: Sunrise,  labelKey: "nav.routine"  },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
] as const;

function NavItem({
  href,
  path,
  matchTab,
  defaultTab,
  icon: Icon,
  label,
  badge,
  vertical,
  small,
  compact,
}: {
  href: string;
  /** Route path used for active matching (query stripped). Defaults to href. */
  path?: string;
  /** When set, active also requires the current ?t= to equal this value. */
  matchTab?: string;
  /** ?t= to assume when the URL has none — the hub's own default tab. */
  defaultTab?: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  vertical?: boolean;
  small?: boolean;
  compact?: boolean;
}) {
  const [pathActive] = useRoute(path ?? href);
  const search = useSearch();
  const currentTab = new URLSearchParams(search).get("t") ?? defaultTab ?? "social";
  const isActive = pathActive && (matchTab == null || currentTab === matchTab);

  // The mobile tab label is hidden by default and only flashes briefly when the
  // user taps the item, then fades away on its own. Declared unconditionally.
  const [flashLabel, setFlashLabel] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSelect = () => {
    setFlashLabel(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setFlashLabel(false), 1600);
  };

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (vertical) {
    if (compact) {
      return (
        <Link
          href={href}
          title={label}
          aria-label={label}
          className={`group relative mx-auto flex h-11 w-11 items-center justify-center rounded-lg transition-colors duration-200 ${
            isActive
              ? "bg-primary/10 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_10px_26px_hsl(var(--primary)/0.08)]"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
          }`}
        >
          <AnimatePresence>
            {isActive && (
              <motion.div
                layoutId="nav-indicator-desktop"
                className="absolute left-[-10px] top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </AnimatePresence>
          <Icon className={`${small ? "h-4 w-4" : "h-[18px] w-[18px]"} transition-colors duration-200`} />
          {badge != null && badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute right-1 top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-destructive px-0.5 text-[9px] font-bold text-destructive-foreground"
            >
              {badge > 99 ? "99+" : badge}
            </motion.span>
          )}
        </Link>
      );
    }

    return (
      <Link
        href={href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative overflow-hidden group ${
          small ? "py-2" : ""
        } ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        }`}
      >
        <AnimatePresence>
          {isActive && (
            <motion.div
              layoutId="nav-indicator-desktop"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-full"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-10 shrink-0">
          <motion.div
            animate={{ scale: isActive ? 1.1 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
          >
            <Icon className={`${small ? "w-4 h-4" : "w-[18px] h-[18px]"} transition-colors duration-200`} />
          </motion.div>
          {badge != null && badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5"
            >
              {badge > 99 ? "99+" : badge}
            </motion.span>
          )}
        </div>
        <span className={`${small ? "text-xs" : "text-sm"} font-medium relative z-10 transition-colors duration-200`}>
          {label}
        </span>
      </Link>
    );
  }

  /* Mobile tab item */
  return (
    <Link
      href={href}
      onClick={handleSelect}
      className={`relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full py-2 transition-colors duration-200 ${
        isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="nav-indicator-mobile"
            className="absolute inset-x-1.5 bottom-1.5 top-1.5 rounded-full border border-primary/20 bg-primary/10 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.10),0_0_22px_hsl(var(--primary)/0.14)]"
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.86 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>

      <div className="relative z-10">
        <motion.div
          animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -1 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        >
          <Icon
            className={`w-5 h-5 sm:w-[22px] sm:h-[22px] transition-colors duration-200 ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </motion.div>
        {badge != null && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-2.5 min-w-[15px] h-[15px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full px-0.5"
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}
      </div>

      <AnimatePresence initial={false}>
        {flashLabel && (
          <motion.span
            key="label"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="relative z-10 overflow-hidden text-[10px] font-medium leading-none text-primary sm:text-[11px]"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const { data: unreadData } = useGetUnreadCount({ query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 30_000 } });
  const { data: profile } = useGetProfile();
  const unreadCount = unreadData?.count ?? 0;
  const [location] = useLocation();
  const activeHub = matchHub(location);
  const { primary, overflow } = activeHub
    ? splitHubItems(activeHub.items)
    : { primary: [], overflow: [] };
  const [moreOpen, setMoreOpen] = useState(false);

  const avatarSrc =
    profile && profile.avatarUrl
      ? profile.avatarUrl
      : `${import.meta.env.BASE_URL}images/avatar-default.webp`;
  const profileName = profile?.name ?? "Trader";

  return (
    <>
      {/* ── Mobile / tablet bottom bar ────────────────────────────────── */}
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] left-0 right-0 z-50 px-3 sm:px-4 lg:hidden"
      >
        <div className="mx-auto max-w-lg overflow-hidden rounded-full border border-white/10 bg-card/70 shadow-[0_18px_60px_rgba(0,0,0,0.38),inset_0_1px_0_hsl(var(--foreground)/0.16),inset_0_-1px_0_hsl(var(--background)/0.38)] backdrop-blur-2xl supports-[backdrop-filter]:bg-card/55">
          {activeHub ? (
            <div className="flex items-center px-1">
              {/* Back to Home — exits the active hub */}
              <Link
                href="/"
                aria-label={t("nav.home")}
                title={t("nav.home")}
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="mx-0.5 h-6 w-px shrink-0 bg-border/50" />
              {primary.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  path={item.path}
                  matchTab={item.tab}
                  defaultTab={activeHub.items[0]?.tab}
                  icon={item.icon}
                  label={t(item.labelKey)}
                />
              ))}
              {overflow.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  aria-label={t("nav.more")}
                  title={t("nav.more")}
                  className="relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-2 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  <MoreHorizontal className="h-5 w-5 sm:h-[22px] sm:w-[22px]" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center px-1">
              {ROOT_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  label={t(item.labelKey)}
                  badge={item.isChat ? unreadCount : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </motion.nav>

      {/* Overflow sheet — reached via "Più" when a hub has more sub-items than fit the pill */}
      {activeHub && overflow.length > 0 && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="lg:hidden">
            <SheetTitle>{t("nav.more")}</SheetTitle>
            <div className="mt-2 flex flex-col gap-1">
              {overflow.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* ── Desktop sidebar ───────────────────────────────────────────── */}
      <motion.nav
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.05 }}
        className="fixed bottom-0 left-0 top-0 z-50 hidden w-20 flex-col border-r border-border/45 bg-card/90 shadow-[2px_0_24px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:flex"
      >
        {/* Logo */}
        <div className="px-3 py-4 border-b border-border/30">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.4 }}
            className="flex items-center justify-center"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary shadow-[0_0_24px_hsl(var(--primary)/0.1)]">
              <Rocket className="h-6 w-6" aria-label="TraderLoading" />
            </div>
          </motion.div>
        </div>

        {/* Primary nav: the active hub's sub-items, or the root hubs + Tornei */}
        <div className="flex-1 flex flex-col px-2 py-3 gap-1 overflow-y-auto">
          {activeHub ? (
            <>
              <motion.div
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              >
                <NavItem href="/" icon={ArrowLeft} label={t("nav.home")} vertical compact />
              </motion.div>

              {activeHub.items.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
                >
                  <NavItem
                    href={item.href}
                    path={item.path}
                    matchTab={item.tab}
                    defaultTab={activeHub.items[0]?.tab}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    vertical
                    compact
                  />
                </motion.div>
              ))}
            </>
          ) : (
            <>
              {ROOT_ITEMS.map((item, i) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
                >
                  <NavItem
                    href={item.href}
                    icon={item.icon}
                    label={t(item.labelKey)}
                    badge={item.isChat ? unreadCount : undefined}
                    vertical
                    compact
                  />
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 400, damping: 28 }}
              >
                <NavItem
                  href={TORNEI_ITEM.href}
                  path={TORNEI_ITEM.path}
                  icon={TORNEI_ITEM.icon}
                  label={t(TORNEI_ITEM.labelKey)}
                  vertical
                  compact
                />
              </motion.div>
            </>
          )}

          {/* Divider */}
          <div className="mx-auto my-2 h-px w-9 bg-border/35" />

          {SECONDARY_ITEMS.map((item, i) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.45 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
            >
              <NavItem
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                vertical
                small
                compact
              />
            </motion.div>
          ))}
        </div>

        {/* Bottom user section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="px-3 py-3 border-t border-border/30"
        >
          <Link
            href="/settings"
            aria-label={t("profile.open_settings")}
            title={t("profile.settings")}
            className="mx-auto flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-primary/35 bg-card/70 p-0.5 shadow-[0_0_14px_hsl(var(--primary)/0.08)] transition-colors hover:border-primary hover:bg-primary/10"
          >
            <img
              src={avatarSrc}
              alt={t("profile.alt", { name: profileName })}
              className="h-full w-full rounded-[10px] object-cover"
            />
          </Link>
        </motion.div>
      </motion.nav>
    </>
  );
}
