import {
  BarChart3,
  BookOpen,
  CreditCard,
  LifeBuoy,
  LogOut,
  LockKeyhole,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/admin",
    labelKey: "admin.nav.dashboard",
    icon: BarChart3,
    permission: "dashboard.read",
  },
  { href: "/admin/users", labelKey: "admin.nav.users", icon: Users, permission: "users.read" },
  {
    href: "/admin/trading",
    labelKey: "admin.nav.trading",
    icon: Shield,
    permission: "trading.read",
  },
  {
    href: "/admin/content",
    labelKey: "admin.nav.content",
    icon: BookOpen,
    permission: "content.publish",
  },
  {
    href: "/admin/subscriptions",
    labelKey: "admin.nav.subscriptions",
    icon: CreditCard,
    permission: "billing.subscriptions.write",
  },
  {
    href: "/admin/support",
    labelKey: "admin.nav.support",
    icon: LifeBuoy,
    permission: "support.write",
  },
  {
    href: "/admin/system",
    labelKey: "admin.nav.system",
    icon: Settings,
    permission: "system.feature_flags.write",
  },
  {
    href: "/admin/security",
    labelKey: "admin.nav.security",
    icon: LockKeyhole,
    permission: "security.audit.read",
  },
];

interface AdminShellProps {
  children: ReactNode;
  role?: string;
  permissions?: string[];
  source?: string;
}

function canShowAdminNavItem(
  permission: string,
  permissions: string[] | undefined,
): boolean {
  return permissions === undefined || permissions.includes(permission);
}

function isAdminNavItemActive(href: string, location: string): boolean {
  return href === "/admin" ? location === "/admin" : location.startsWith(href);
}

export function AdminShell({
  children,
  role,
  permissions,
  source,
}: AdminShellProps) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const visibleNavItems = navItems.filter((item) =>
    canShowAdminNavItem(item.permission, permissions),
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card/95 lg:block">
        <div className="flex h-16 items-center border-b border-border px-5">
          <div>
            <p className="text-sm font-semibold">TraderLoadings</p>
            <p className="text-xs text-muted-foreground">{t("admin.brand.console")}</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label={t("admin.nav.label")}>
          {visibleNavItems.map((item) => {
            const active = isAdminNavItemActive(item.href, location);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-h-16 items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">{t("admin.header.title")}</p>
            <p className="text-xs text-muted-foreground">
              {t("admin.header.role", { role: role ?? t("admin.header.verifying") })}
              {source ? ` - ${source}` : ""}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t("admin.header.back_app")}
          </Link>
          </div>
          <nav
            id="mobile-admin-navigation"
            className="-mx-4 flex gap-2 overflow-x-auto border-t border-border px-4 py-2 lg:hidden"
            aria-label={t("admin.nav.label")}
          >
            {visibleNavItems.map((item) => {
              const active = isAdminNavItemActive(item.href, location);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
