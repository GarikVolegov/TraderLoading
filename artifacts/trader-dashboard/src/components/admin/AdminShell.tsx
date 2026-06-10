import {
  BarChart3,
  BookOpen,
  LifeBuoy,
  LockKeyhole,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/users", label: "Utenti", icon: Users },
  { href: "/admin/trading", label: "Trading", icon: Shield },
  { href: "/admin/content", label: "Content", icon: BookOpen },
  { href: "/admin/support", label: "Supporto", icon: LifeBuoy },
  { href: "/admin/system", label: "Sistema", icon: Settings },
  { href: "/admin/security", label: "Sicurezza", icon: LockKeyhole },
];

interface AdminShellProps {
  children: ReactNode;
  role?: string;
}

export function AdminShell({ children, role }: AdminShellProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card/95 lg:block">
        <div className="flex h-16 items-center border-b border-border px-5">
          <div>
            <p className="text-sm font-semibold">TraderLoadings</p>
            <p className="text-xs text-muted-foreground">Admin Console</p>
          </div>
        </div>
        <nav className="space-y-1 p-3" aria-label="Admin navigation">
          {navItems.map((item) => {
            const active =
              item.href === "/admin"
                ? location === "/admin"
                : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur lg:px-6">
          <div>
            <p className="text-sm font-semibold">Admin</p>
            <p className="text-xs text-muted-foreground">
              Ruolo: {role ?? "verifica in corso"}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Torna all'app
          </Link>
        </header>
        <div className="mx-auto max-w-[1440px] space-y-5 p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
