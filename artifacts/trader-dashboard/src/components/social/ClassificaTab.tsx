import { useState } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { useGetProfile } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import { PositionBadge } from "./PositionBadge";
import { useLeaderboard } from "./hooks";
import { UserProfileModal } from "./UserProfileModal";
import { apiJSON } from "@/lib/apiFetch";
import {
  computeCompositeMasteryScore,
  computeLimenIntegritySnapshot,
  type LimenGradeDefinition,
} from "../../../../../contracts/limenGrades";
import { SigilIcon } from "@/components/ui/SigilIcon";

interface IntegrityLeaderboardEntry {
  position: number;
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  level: number;
  xp: number;
  grade: LimenGradeDefinition;
  integrityIndex: number;
  consistencyScore: number;
  avgRiskReward: number;
  profitFactor: number;
  recentViolationsCount: number;
  driftDetected: boolean;
  masteryScore: number;
  winRate?: number | null;
}

export function ClassificaTab({ currentUserId }: { currentUserId: string }) {
  const { data: legacyLeaderboard, isLoading: legacyLoading } = useLeaderboard();
  const { data: integrityLeaderboard, isLoading: integrityLoading } = useQuery<
    IntegrityLeaderboardEntry[]
  >({
    queryKey: ["leaderboard-integrity"],
    queryFn: () => apiJSON("leaderboard/integrity"),
    staleTime: 30_000,
    retry: false,
  });
  const { data: profile } = useGetProfile();
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  const isLoading = legacyLoading && integrityLoading;

  const rows: IntegrityLeaderboardEntry[] =
    integrityLeaderboard && integrityLeaderboard.length > 0
      ? integrityLeaderboard
      : (legacyLeaderboard ?? [])
          .map((entry) => {
            const snap = computeLimenIntegritySnapshot({
              legacyLevel: entry.level,
            });
            const consistencyScore = Math.min(100, 60 + entry.level * 2);
            const avgRiskReward = 1.6;
            const profitFactor = 1.45;
            const winRate = 50;
            const masteryScore = computeCompositeMasteryScore({
              integrityIndex: snap.integrityIndex,
              consistencyScore,
              avgRiskReward,
              profitFactor,
              protocolViolationsCount: 0,
            });
            return {
              position: entry.position,
              userId: entry.userId ?? null,
              name: entry.name,
              avatarUrl: entry.avatarUrl ?? null,
              level: entry.level,
              xp: entry.xp,
              grade: snap.currentGrade,
              integrityIndex: snap.integrityIndex,
              consistencyScore,
              avgRiskReward,
              profitFactor,
              recentViolationsCount: 0,
              driftDetected: snap.driftDetected,
              masteryScore,
              winRate,
            };
          })
          .sort((a, b) => b.masteryScore - a.masteryScore)
          .map((entry, idx) => ({ ...entry, position: idx + 1 }));

  return (
    <>
      <div className="flex flex-col h-full min-h-0 bg-[#07080B] text-slate-200">
        <div className="p-4 border-b border-[#C5A059]/20 space-y-2.5 shrink-0 bg-[#0A0B10]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#C5A059]">
                <SigilIcon variant="hierarchy" size={16} />
              </span>
              <div>
                <p
                  className="font-bold text-sm uppercase tracking-[0.14em] text-white font-display"
                >
                  La Gerarchia dell&apos;Integrità
                </p>
                <p className="text-xs text-slate-400 font-sans">
                  Il rango non si compra: si conquista rispettando il Codice.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block rounded-md border border-[#C5A059]/35 bg-[#C5A059]/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#E8C56A]">
              Score Composito di Maestria
            </span>
          </div>

          <div className="rounded-lg border border-[#C5A059]/20 bg-[#12131A] px-3 py-2 font-mono text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              FORMULA:{" "}
              <strong className="text-[#F4F4F6]">
                Integrità del Protocollo (%) + Costanza + Risk/Reward Ratio + Profit Factor
              </strong>
            </span>
            <span className="text-red-400 font-semibold">
              Penalità attiva per violazione de Il Custode della Soglia
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#C5A059]" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <SigilIcon variant="hierarchy" size={32} className="mx-auto mb-3 opacity-30 text-[#C5A059]" />
              <p className="text-sm font-mono">{uiText("auto.ui.5ce296ad34")}</p>
            </div>
          ) : (
            <div className="divide-y divide-[#C5A059]/15">
              {rows.map((entry, idx) => {
                const isMe =
                  entry.userId === currentUserId ||
                  Boolean(profile && entry.name === profile.name);
                const canViewProfile = Boolean(
                  entry.userId && entry.userId !== currentUserId,
                );
                return (
                  <motion.div
                    key={`${entry.position}-${entry.userId ?? entry.name}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => canViewProfile && entry.userId && setViewingProfile(entry.userId)}
                    className={`px-4 py-3 flex items-center justify-between gap-3 sm:gap-4 transition-colors ${
                      isMe ? "bg-[#C5A059]/15 border-l-2 border-l-[#C5A059]" : ""
                    } ${
                      canViewProfile
                        ? "cursor-pointer hover:bg-white/5 active:bg-white/10"
                        : ""
                    }`}
                  >
                    {/* Flank Sinistro: Posizione, Avatar, Nome bello grande, Grado & Eventuale Penalità */}
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 overflow-hidden">
                      <div className="shrink-0">
                        <PositionBadge position={entry.position} />
                      </div>
                      <div className="shrink-0">
                        <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size="md" />
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 truncate">
                        <span
                          className={`text-base sm:text-lg font-bold font-display tracking-wide truncate ${
                            isMe ? "text-[#E8C56A]" : "text-white"
                          }`}
                        >
                          {entry.name}
                        </span>
                        {isMe && (
                          <span className="shrink-0 text-xs text-[#C5A059] font-mono font-semibold">
                            (Tu)
                          </span>
                        )}
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#C5A059]/40 bg-[#C5A059]/10 px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#E8C56A]">
                          <SigilIcon variant={entry.grade.sigilId} size={12} />
                          {entry.grade.code} — {entry.grade.title}
                        </span>
                        {entry.recentViolationsCount > 0 && (
                          <span className="shrink-0 rounded border border-[#8B1E1E] bg-[#8B1E1E]/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-red-400">
                            Penalizzato (-{entry.recentViolationsCount * 8} pt)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Flank Destro: Riquadri Dati (Costanza, Win Rate, R:R, Maestria) */}
                    <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                      <div className="rounded-lg border border-[#C5A059]/30 bg-[#12131A] px-2.5 sm:px-3 py-1.5 text-center min-w-[62px] sm:min-w-[76px] shadow-sm">
                        <div className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400">
                          Costanza
                        </div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-white">
                          {entry.consistencyScore}%
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#C5A059]/30 bg-[#12131A] px-2.5 sm:px-3 py-1.5 text-center min-w-[62px] sm:min-w-[76px] shadow-sm">
                        <div className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400">
                          Win Rate
                        </div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-white">
                          {entry.winRate != null ? `${entry.winRate}%` : "—"}
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#C5A059]/30 bg-[#12131A] px-2.5 sm:px-3 py-1.5 text-center min-w-[62px] sm:min-w-[76px] shadow-sm">
                        <div className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-slate-400">
                          R:R
                        </div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-white">
                          {entry.avgRiskReward.toFixed(2)}
                        </div>
                      </div>

                      <div className="rounded-lg border border-[#C5A059]/60 bg-[#171822] px-2.5 sm:px-3.5 py-1.5 text-center min-w-[68px] sm:min-w-[82px] shadow-[0_0_12px_rgba(197,160,89,0.12)]">
                        <div className="font-mono text-[8px] sm:text-[9px] uppercase tracking-wider text-[#C5A059]">
                          Maestria
                        </div>
                        <div className="font-mono text-xs sm:text-sm font-bold text-[#E8C56A]">
                          {entry.masteryScore.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {viewingProfile && (
        <UserProfileModal
          userId={viewingProfile}
          currentUserId={currentUserId}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </>
  );
}
