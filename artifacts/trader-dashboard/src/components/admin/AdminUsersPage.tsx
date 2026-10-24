import { FilterPanel } from "@/components/FilterPanel";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { uiText } from "@/contexts/LanguageContext";
import { getAdminUsers, type AdminUserRow } from "@/lib/adminApi";
import { Search } from "lucide-react";
import { type AdminUserStatusFilter, getInitialAdminUserStatus, getInitialAdminUserQuery, syncAdminUserFiltersToUrl, statusVariant, AdminErrorState } from "./shared";

export function AdminUsersPage() {
  const [query, setQuery] = useState(getInitialAdminUserQuery);
  const [status, setStatus] = useState<AdminUserStatusFilter>(
    getInitialAdminUserStatus,
  );
  const [, setLocation] = useLocation();
  const users = useQuery({
    queryKey: ["admin", "users", query, status],
    queryFn: () => getAdminUsers({ q: query, status, limit: 50 }),
  });
  const rows = users.data?.users ?? [];

  useEffect(() => {
    syncAdminUserFiltersToUrl(query, status, setLocation);
  }, [query, setLocation, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{uiText("admin.users.title")}</h1>
          <p className="text-sm text-muted-foreground">
            Cerca, filtra e apri i profili operativi.
          </p>
        </div>
        <Badge variant="outline">{rows.length} risultati</Badge>
      </div>
      <FilterPanel active={Boolean(query.trim()) || status !== "all"}>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/80 p-4 md:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
            placeholder={uiText("auto.ui.a09bda942e")}
          />
        </div>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as AdminUserStatusFilter)
          }
          className="min-h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="all">{uiText("auto.ui.bb894e3bb7")}</option>
          <option value="active">{uiText("auto.ui.ded055b716")}</option>
          <option value="suspended">{uiText("auto.ui.1d2fb38e6f")}</option>
          <option value="banned">{uiText("auto.ui.fffe3601b7")}</option>
        </select>
      </div>

      </FilterPanel>
      {users.isError ? (
        <AdminErrorState
          title={uiText("auto.ui.dd9b118f73")}
          description="La ricerca utenti non ha risposto correttamente."
        />
      ) : (
        <>
        <div className="admin-user-cards">
          {users.isLoading ? Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />) : rows.map((user: AdminUserRow) => (
            <article key={user.profileId} className="min-w-0 space-y-3 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0"><p className="break-words font-semibold">{user.name}</p><p className="break-all text-sm text-muted-foreground">{user.email}</p></div>
                <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm"><span>{uiText("common.level")} {user.level}</span><span>{user.xp} XP</span></div>
              <Button variant="outline" className="w-full" disabled={!user.userId} onClick={() => user.userId && setLocation(`/admin/users/${user.userId}`)}>{uiText("archive.open")}</Button>
            </article>
          ))}
          {!users.isLoading && rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">{uiText("auto.ui.f4b60ba9f9")}</p>}
        </div>
        <section className="hidden overflow-hidden rounded-lg border border-border bg-card/80 lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{uiText("auto.ui.cef52217ee")}</TableHead>
                <TableHead>{uiText("auto.ui.84add5b295")}</TableHead>
                <TableHead>{uiText("auto.ui.148c60ecba")}</TableHead>
                <TableHead>{uiText("auto.ui.227771829c")}</TableHead>
                <TableHead>XP</TableHead>
                <TableHead className="text-right">{uiText("auto.ui.f18824e55d")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((user: AdminUserRow) => (
                    <TableRow key={user.profileId}>
                      <TableCell>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {user.userId ?? "guest"}
                        </div>
                      </TableCell>
                      <TableCell>{user.email ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(user.status)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.level}</TableCell>
                      <TableCell>{user.xp}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!user.userId}
                          onClick={() =>
                            user.userId &&
                            setLocation(`/admin/users/${user.userId}`)
                          }
                        >
                          Apri
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          {!users.isLoading && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">
              Nessun utente trovato.
            </div>
          )}
        </section>
        </>
      )}
    </div>
  );
}
