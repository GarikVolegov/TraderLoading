import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, X, Users, Shield, Ban } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { useCommunityBans } from "./hooks";
import { RoleEditor } from "./RoleEditor";
import { MemberManager } from "./MemberManager";
import type { CommunityDetail } from "./types";

type Tab = "members" | "roles" | "bans";

export function CommunitySettingsModal({
  detail,
  onClose,
}: {
  detail: CommunityDetail;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const perms = detail.myPermissions ?? [];
  const can = (p: string) => detail.isOwner || perms.includes(p);

  const canManageRoles = can("roles.manage");
  const canKick = can("members.kick");
  const canBan = can("members.ban");
  const canMute = can("members.mute");

  const [tab, setTab] = useState<Tab>("members");
  const { data: bans = [], isLoading: loadingBans } = useCommunityBans(detail.id, tab === "bans" && canBan);
  const [unbanning, setUnbanning] = useState<string | null>(null);

  const unban = async (userId: string) => {
    setUnbanning(userId);
    try {
      await apiFetch(`community/${detail.id}/bans/${userId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["communityBans", detail.id] });
    } catch (error) {
      reportClientError(error, { context: "community unban", notify: false });
    } finally {
      setUnbanning(null);
    }
  };

  const tabs: { id: Tab; label: string; icon: typeof Users; show: boolean }[] = [
    { id: "members", label: t("community.settings.tab.members"), icon: Users, show: true },
    { id: "roles", label: t("community.settings.tab.roles"), icon: Shield, show: canManageRoles },
    { id: "bans", label: t("community.settings.tab.bans"), icon: Ban, show: canBan },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{detail.iconEmoji}</span>
            <h2 className="font-bold text-base truncate">{t("community.settings.title")}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("community.close")}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 py-2 border-b border-border shrink-0">
          {tabs.filter((tb) => tb.show).map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === tb.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <tb.icon className="w-3.5 h-3.5" />
              {tb.label}
            </button>
          ))}
        </div>

        <div className="p-4 overflow-y-auto">
          {tab === "members" && (
            <MemberManager
              communityId={detail.id}
              roles={detail.roles ?? []}
              canAssignRoles={canManageRoles}
              canKick={canKick}
              canBan={canBan}
              canMute={canMute}
            />
          )}
          {tab === "roles" && canManageRoles && <RoleEditor communityId={detail.id} />}
          {tab === "bans" && canBan && (
            <div className="space-y-1.5">
              {loadingBans ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : bans.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">{t("community.bans.empty")}</p>
              ) : (
                bans.map((b) => (
                  <div key={b.userId} className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/20 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{b.name}</p>
                      {b.reason && <p className="text-[10px] text-muted-foreground truncate">{b.reason}</p>}
                    </div>
                    <button
                      onClick={() => unban(b.userId)}
                      disabled={unbanning === b.userId}
                      className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {t("community.bans.unban")}
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
