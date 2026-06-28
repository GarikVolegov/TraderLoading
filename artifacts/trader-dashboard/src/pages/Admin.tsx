import { Route, Switch } from "wouter";
import { AdminAccessBoundary } from "@/components/admin/shared";
import { AdminDashboardPage } from "@/components/admin/AdminDashboardPage";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";
import { AdminUserDetailPage } from "@/components/admin/AdminUserDetailPage";
import { AdminTradingPage } from "@/components/admin/AdminTradingPage";
import { AdminContentPage } from "@/components/admin/AdminContentPage";
import { AdminSubscriptionsPage } from "@/components/admin/AdminSubscriptionsPage";
import { AdminSupportPage } from "@/components/admin/AdminSupportPage";
import { AdminTicketsPage } from "@/components/admin/AdminTicketsPage";
import { AdminSystemPage } from "@/components/admin/AdminSystemPage";
import { AdminSecurityPage } from "@/components/admin/AdminSecurityPage";

export default function AdminPage() {
  return (
    <AdminAccessBoundary>
      <Switch>
        <Route path="/admin/users/:userId" component={AdminUserDetailPage} />
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/trading" component={AdminTradingPage} />
        <Route path="/admin/content" component={AdminContentPage} />
        <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
        <Route path="/admin/support/tickets" component={AdminTicketsPage} />
        <Route path="/admin/support" component={AdminSupportPage} />
        <Route path="/admin/system" component={AdminSystemPage} />
        <Route path="/admin/audit" component={AdminSecurityPage} />
        <Route path="/admin/security" component={AdminSecurityPage} />
        <Route path="/admin" component={AdminDashboardPage} />
      </Switch>
    </AdminAccessBoundary>
  );
}
