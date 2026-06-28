import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Crown, UserX, Ban, MicOff } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { useCommunityMembers } from "./hooks";
import type { CommunityRole } from "./types";

export function MemberManager({
  communityId,
  roles,
  canAssignRoles,
  canKick,
  canBan,
  canMute,
}: {
  communityId: number;
  roles: CommunityRole[];
  canAssignRoles: boolean;
  canKick: boolean;
  canBan: boolean;
  canMute: boolean;
}) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const { data: members = [], isLoading } = useCommunityMembers(communityId);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["communityMembers", communityId] });
    qc.invalidateQueries({ queryKey: ["communityBans", communityId] });
    qc.invalidateQueries({ queryKey: ["community", communityId] });
    qc.invalidateQueries({ queryKey: ["communities"] });
  };

  const run = async (userId: string, fn: () => Promise<unknown>, context: string) => {
    setBusyUser(userId);
    try {
      await fn();
      refresh();
    } catch (error) {
      reportClientError(error, { context, notify: false });
    } finally {
      setBusyUser(null);
    }
  };

  const assignRole = (userId: string, roleId: string) =>
    run(
      userId,
      () =>
        apiJSON(`community/${communityId}/members/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleId: roleId === "" ? null : Number(roleId) }),
        }),
      "community assign role",
    );

  const kick = (userId: string, name: string) => {
    if (!window.confirm(t("community.member.confirmKick", { name }))) return;
    run(userId, () => apiFetch(`community/${communityId}/members/${userId}`, { method: "DELETE" }), "community kick");
  };

  const ban = (userId: string, name: string) => {
    if (!window.confirm(t("community.member.confirmBan", { name }))) return;
    run(
      userId,
      () => apiJSON(`community/${communityId}/members/${userId}/ban`, { method: "POST" }),
      "community ban",
    );
  };

  const mute = (userId: string) => {
    const raw = window.prompt(t("community.member.mutePrompt"));
    if (raw === null) return;
    const minutes = Number(raw);
    run(
      userId,
      () =>
        apiJSON(`community/${communityId}/members/${userId}/mute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: Number.isFinite(minutes) ? minutes : 0 }),
        }),
      "community mute",
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/20 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
            {m.avatarUrl ? (
              <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              m.name.slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate flex items-center gap-1.5">
              {m.name}
              {m.isOwner && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
            </p>
            {m.roleName && (
              <span
                className="text-[10px] font-medium"
                style={{ color: m.roleColor ?? undefined }}
              >
                {m.roleName}
              </span>
            )}
          </div>

          {!m.isOwner && (
            <div className="flex items-center gap-1.5 shrink-0">
              {canAssignRoles && (
                <select
                  value={m.roleId ?? ""}
                  onChange={(e) => assignRole(m.userId, e.target.value)}
                  disabled={busyUser === m.userId}
                  className="bg-secondary/40 border border-border rounded-lg px-1.5 py-1 text-[11px] focus:outline-none focus:border-primary/50 max-w-[110px]"
                >
                  <option value="">{t("community.member.noRole")}</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              {canMute && (
                <button
                  onClick={() => mute(m.userId)}
                  disabled={busyUser === m.userId}
                  title={t("community.member.mute")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-50"
                >
                  <MicOff className="w-3.5 h-3.5" />
                </button>
              )}
              {canKick && (
                <button
                  onClick={() => kick(m.userId, m.name)}
                  disabled={busyUser === m.userId}
                  title={t("community.member.kick")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                </button>
              )}
              {canBan && (
                <button
                  onClick={() => ban(m.userId, m.name)}
                  disabled={busyUser === m.userId}
                  title={t("community.member.ban")}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
