import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { socialHref } from "@/lib/chatTabs";
import { BattleRoomLobbyModal } from "./BattleRoomLobbyModal";
import { CustomLobbyModal } from "./CustomLobbyModal";
import {
  fetchBacktestTournaments,
  joinBacktestTournament,
  backtestTournamentsKey,
  backtestTournamentLeaderboardKey,
  type BacktestTournament,
  type BacktestCustomLobby,
} from "@/lib/backtestTournamentsApi";
import { playBattleChime } from "@/lib/tournamentSoundEffects";
import { useToast } from "@/hooks/use-toast";
import {
  Flame,
  ChevronDown,
  ChevronUp,
  Trophy,
  ArrowRight,
  ShieldAlert,
  Users,
  Award,
  Plus,
  Shield,
  Shuffle,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function BacktestBattlesDrawer({ onOpenHub }: { onOpenHub?: () => void }) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedLobbyTournament, setSelectedLobbyTournament] = useState<BacktestTournament | null>(null);
  const [activeCustomLobby, setActiveCustomLobby] = useState<BacktestCustomLobby | null>(null);
  const [isCustomLobbyModalOpen, setIsCustomLobbyModalOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: backtestTournamentsKey(),
    queryFn: () => fetchBacktestTournaments(),
  });

  const tournaments = data?.tournaments ?? [];

  const joinMutation = useMutation({
    mutationFn: (tId: number) => joinBacktestTournament(tId),
    onSuccess: (res, tId) => {
      playBattleChime();
      toast({
        title: "Prova del Fuoco Iniziata",
        description: `Sei entrato in ${res.tournament?.title || "Time Trial"}. Lancio Replay Terminal…`,
      });
      qc.invalidateQueries({ queryKey: backtestTournamentsKey() });
      qc.invalidateQueries({ queryKey: backtestTournamentLeaderboardKey(tId) });

      if (res.sessionId) {
        navigate(`/backtest/${res.sessionId}/replay?tournamentId=${tId}`);
      }
    },
    onError: (err) => {
      toast({
        title: "Impossibile accedere alla prova",
        description: (err as Error).message,
        variant: "destructive",
      });
    },
  });

  return (
    <div
      style={{
        borderTop: "1px solid rgba(197, 160, 89, 0.25)",
        background: "linear-gradient(180deg, rgba(14, 15, 20, 0.95) 0%, rgba(10, 10, 14, 0.98) 100%)",
      }}
      className="shrink-0"
    >
      {/* Header Tendina */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 0.2s ease",
        }}
        className="hover:bg-[#1a1a24]/60"
        aria-expanded={isOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: "rgba(197, 160, 89, 0.15)",
              border: "1px solid rgba(197, 160, 89, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#D4AF37",
            }}
          >
            <Flame size={13} />
          </span>
          <div>
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#D4AF37",
                display: "block",
              }}
            >
              Le Prove del Fuoco
            </span>
            <span style={{ fontSize: 10, color: "#8E92A0" }}>
              Duelli & Time Trials della Forgia ({tournaments.length || 5})
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#C5A059" }}>
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Contenuto Tendina Richiudibile */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 10px 10px", maxHeight: "320px", overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 4px" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "9.5px",
                    fontFamily: "ui-monospace, monospace",
                    color: "#71717A",
                    lineHeight: 1.4,
                  }}
                >
                  Date storiche casuali blind e limite DD al 10%. Pura esecuzione strategica.
                </p>

                <button
                  type="button"
                  onClick={() => setIsCustomLobbyModalOpen(true)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "rgba(197, 160, 89, 0.15)",
                    border: "1px solid rgba(197, 160, 89, 0.4)",
                    color: "#D4AF37",
                    fontSize: 10,
                    fontFamily: "ui-monospace, monospace",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                  className="hover:brightness-110"
                >
                  <Plus size={11} /> Nuova Tribù
                </button>
              </div>

              {isLoading ? (
                <div style={{ padding: 12, textAlign: "center", fontSize: 11, color: "#71717A" }}>
                  Caricamento prove…
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {tournaments.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(22, 22, 28, 0.7)",
                        border: "1px solid rgba(255, 255, 255, 0.07)",
                        transition: "all 0.18s ease",
                      }}
                      className="hover:border-[#C5A059]/40 hover:bg-[#1a1a24]"
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#f4f4f5",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {t.title}
                        </span>
                        <span
                          style={{
                            fontFamily: "ui-monospace, monospace",
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#D4AF37",
                            background: "rgba(197, 160, 89, 0.12)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: "1px solid rgba(197, 160, 89, 0.25)",
                          }}
                        >
                          {t.pair} · {t.timeframe}
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 9.5,
                          color: "#94a3b8",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Users size={11} color="#C5A059" /> {t.participantCount}/50 in gara
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#f87171" }}>
                          <ShieldAlert size={11} /> Max DD {t.maxDrawdownPct}%
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setSelectedLobbyTournament(t)}
                          disabled={joinMutation.isPending}
                          style={{
                            flex: 1,
                            padding: "5px 10px",
                            borderRadius: 6,
                            background: "linear-gradient(135deg, rgba(197, 160, 89, 0.25) 0%, rgba(212, 175, 55, 0.12) 100%)",
                            border: "1px solid rgba(197, 160, 89, 0.4)",
                            color: "#F4F4F6",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 5,
                            transition: "all 0.15s ease",
                          }}
                          className="hover:border-[#C5A059] hover:brightness-110"
                        >
                          <span>Affronta la Prova</span>
                          <ArrowRight size={11} color="#D4AF37" />
                        </button>

                        <a
                          href={`/duello/room_tournament_${t.id}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "5px 8px",
                            borderRadius: 6,
                            background: "rgba(197, 160, 89, 0.1)",
                            border: "1px solid rgba(197, 160, 89, 0.3)",
                            color: "#E8C56A",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title="Osserva la Prova dalla Tribuna Spettatori"
                          className="hover:bg-[#C5A059]/20"
                        >
                          <Eye size={11} />
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenHub) {
                              onOpenHub();
                            } else {
                              navigate(socialHref("competizioni", { vista: "battaglie", sub: "backtest" }));
                            }
                          }}
                          style={{
                            padding: "5px 8px",
                            borderRadius: 6,
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "#C5A059",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title="Consulta Podio e Gerarchia"
                          className="hover:bg-[#1f1f2a]"
                        >
                          <Trophy size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Link piè di pagina: Albo della Forgia */}
              <div style={{ marginTop: 8, textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenHub) {
                      onOpenHub();
                    } else {
                      navigate(socialHref("competizioni", { vista: "battaglie", sub: "backtest" }));
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#C5A059",
                    fontSize: 9.5,
                    fontFamily: "ui-monospace, monospace",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                  }}
                  className="hover:underline"
                >
                  <Award size={11} /> Consulta la Gerarchia Completa ➔
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedLobbyTournament && (
        <BattleRoomLobbyModal
          tournament={selectedLobbyTournament}
          isOpen={Boolean(selectedLobbyTournament)}
          onClose={() => setSelectedLobbyTournament(null)}
          onEnterBattle={(assignedStartTs) => {
            const tId = selectedLobbyTournament.id;
            setSelectedLobbyTournament(null);
            if (assignedStartTs != null && typeof window !== "undefined") {
              try {
                window.localStorage.setItem(`traderloading:backtest-start:temp`, String(assignedStartTs));
              } catch {
                // Ignore storage failure
              }
            }
            joinMutation.mutate(tId);
          }}
          isJoining={joinMutation.isPending}
        />
      )}

      {/* Modal Creazione Stanza Custom & Gruppi Tribù */}
      <CustomLobbyModal
        isOpen={isCustomLobbyModalOpen}
        onClose={() => setIsCustomLobbyModalOpen(false)}
        onLobbyReady={(lobby) => {
          setIsCustomLobbyModalOpen(false);
          setActiveCustomLobby(lobby);
        }}
      />

      {/* Modal Sala d'Attesa Multiplayer per Stanza Custom */}
      {activeCustomLobby && (
        <BattleRoomLobbyModal
          customLobby={activeCustomLobby}
          isOpen={Boolean(activeCustomLobby)}
          onClose={() => setActiveCustomLobby(null)}
          onEnterBattle={(assignedStartTs) => {
            setActiveCustomLobby(null);
            // Join standard session for the custom lobby
            joinMutation.mutate(1);
          }}
          isJoining={joinMutation.isPending}
        />
      )}
    </div>
  );
}
