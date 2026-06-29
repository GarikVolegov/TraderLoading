import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiJSON } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { useCommunityRoles, usePermissionsCatalog } from "./hooks";
import type { CommunityRole } from "./types";

type Draft = { name: string; color: string; permissions: string[] };

const DEFAULT_COLOR = "#51a488";

export function RoleEditor({ communityId }: { communityId: number }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useCommunityRoles(communityId);
  const { data: catalog } = usePermissionsCatalog(communityId);
  const permissions = catalog?.permissions ?? [];

  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of roles) {
        if (!next[r.id]) {
          next[r.id] = { name: r.name, color: r.color ?? DEFAULT_COLOR, permissions: [...r.permissions] };
        }
      }
      return next;
    });
  }, [roles]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["communityRoles", communityId] });
    qc.invalidateQueries({ queryKey: ["community", communityId] });
  };

  const updateDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const togglePerm = (id: number, perm: string) => {
    const draft = drafts[id];
    if (!draft) return;
    const has = draft.permissions.includes(perm);
    updateDraft(id, {
      permissions: has ? draft.permissions.filter((p) => p !== perm) : [...draft.permissions, perm],
    });
  };

  const saveRole = async (role: CommunityRole) => {
    const draft = drafts[role.id];
    if (!draft) return;
    setBusyId(role.id);
    try {
      await apiJSON(`community/roles/${role.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draft.name, color: draft.color, permissions: draft.permissions }),
      });
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community role save", notify: false });
    } finally {
      setBusyId(null);
    }
  };

  const deleteRole = async (role: CommunityRole) => {
    if (!window.confirm(t("community.role.confirmDelete", { name: role.name }))) return;
    setBusyId(role.id);
    try {
      await apiJSON(`community/roles/${role.id}`, { method: "DELETE" });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[role.id];
        return next;
      });
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community role delete", notify: false });
    } finally {
      setBusyId(null);
    }
  };

  const createRole = async () => {
    setCreating(true);
    try {
      await apiJSON(`community/${communityId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: t("community.role.newName"), color: DEFAULT_COLOR, permissions: [] }),
      });
      refresh();
    } catch (error) {
      reportClientError(error, { context: "community role create", notify: false });
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={createRole}
        disabled={creating}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
      >
        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        {t("community.role.create")}
      </button>

      {roles.map((role) => {
        const draft = drafts[role.id] ?? { name: role.name, color: role.color ?? DEFAULT_COLOR, permissions: role.permissions };
        return (
          <div key={role.id} className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full shrink-0 border border-border"
                style={{ backgroundColor: draft.color }}
              />
              <input
                value={draft.name}
                onChange={(e) => updateDraft(role.id, { name: e.target.value })}
                maxLength={40}
                className="flex-1 bg-secondary/40 border border-border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-primary/50"
              />
              <input
                type="color"
                aria-label={t("community.role.color")}
                value={draft.color}
                onChange={(e) => updateDraft(role.id, { color: e.target.value })}
                className="w-8 h-8 rounded-lg border border-border bg-transparent cursor-pointer"
              />
              {role.isDefault && (
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1 rounded-md bg-secondary/40 shrink-0">
                  {t("community.role.default")}
                </span>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {t("community.role.permissions")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {permissions.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-xs cursor-pointer text-foreground/90">
                    <input
                      type="checkbox"
                      checked={draft.permissions.includes(perm)}
                      onChange={() => togglePerm(role.id, perm)}
                      className="accent-primary"
                    />
                    {t(`community.perm.${perm}`)}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => saveRole(role)}
                disabled={busyId === role.id}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {busyId === role.id && <Loader2 className="w-3 h-3 animate-spin" />}
                {t("community.role.save")}
              </button>
              {!role.isDefault && (
                <button
                  onClick={() => deleteRole(role)}
                  disabled={busyId === role.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3 h-3" />
                  {t("community.role.delete")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
