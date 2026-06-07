import { Link, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, BookOpen, MessageCircle, Wrench, Brain, BrainCircuit, Settings, FlaskConical, Sunrise } from "lucide-react";
import { getGetUnreadCountQueryKey, useGetUnreadCount } from "@workspace/api-client-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { UserButton } from "@clerk/react";

const NAV_ITEMS = [
  { href: "/",        icon: LayoutDashboard, labelKey: "nav.home",    isChat: false },
  { href: "/journal", icon: BookOpen,         labelKey: "nav.journal", isChat: false },
  { href: "/tools",   icon: Wrench,           labelKey: "nav.tools",   isChat: false },
  { href: "/zen",     icon: Brain,            labelKey: "nav.zen",     isChat: false },
  { href: "/chat",    icon: MessageCircle,    labelKey: "nav.chat",    isChat: true  },
] as const;

const SECONDARY_ITEMS = [
  { href: "/brain",    icon: BrainCircuit, labelKey: "nav.brain"    },
  { href: "/routine",  icon: Sunrise,     labelKey: "nav.routine"  },
  { href: "/backtest", icon: FlaskConical, labelKey: "nav.backtest" },
  { href: "/settings", icon: Settings,     labelKey: "nav.settings" },
] as const;

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  vertical,
  small,
  compact,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: number;
  vertical?: boolean;
  small?: boolean;
  compact?: boolean;
}) {
  const [isActive] = useRoute(href);

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
        {/* Active left bar */}
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
      className="relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-2"
    >
      <AnimatePresence>
        {isActive && (
          <motion.div
            layoutId="nav-indicator-mobile"
            className="absolute top-0 left-1/2 -translate-x-1/2 w-8 sm:w-10 h-0.5 bg-primary rounded-full"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        )}
      </AnimatePresence>

      <div className="relative">
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

      <motion.span
        animate={{ opacity: isActive ? 1 : 0.5 }}
        transition={{ duration: 0.15 }}
        className={`text-[10px] sm:text-[11px] font-medium transition-colors duration-200 ${
          isActive ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {label}
      </motion.span>
    </Link>
  );
}

export function BottomNav() {
  const { t } = useLanguage();
  const { data: unreadData } = useGetUnreadCount({ query: { queryKey: getGetUnreadCountQueryKey(), refetchInterval: 5000 } });
  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      {/* ── Mobile / tablet bottom bar ────────────────────────────────── */}
      <motion.nav
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      >
        <div className="bg-card/95 backdrop-blur-2xl border-t border-border/50 shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center max-w-lg mx-auto px-1 safe-bottom">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={t(item.labelKey)}
                badge={item.isChat ? unreadCount : undefined}
              />
            ))}
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)]" />
        </div>
      </motion.nav>

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
            <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 shadow-[0_0_24px_hsl(var(--primary)/0.1)]">
              <div className="w-3.5 h-3.5 rounded-md bg-primary" />
            </div>
          </motion.div>
        </div>

        {/* Primary nav */}
        <div className="flex-1 flex flex-col px-2 py-3 gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item, i) => (
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

          {/* Divider */}
          <div className="mx-auto my-2 h-px w-9 bg-border/35" />

          {SECONDARY_ITEMS.map((item, i) => (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.05, type: "spring", stiffness: 400, damping: 28 }}
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
          <div className="flex items-center justify-center rounded-xl py-1.5 hover:bg-white/5 transition-colors cursor-pointer group">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 rounded-xl border border-border/60",
                },
              }}
            />
          </div>
        </motion.div>
      </motion.nav>
    </>
  );
}
