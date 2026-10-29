import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useQuery } from "@tanstack/react-query";
import { fetchCandidates, type CandidateTrader } from "@/lib/backtestTournamentsApi";
import { useToast } from "@/hooks/use-toast";
import {
  Link,
  Copy,
  Check,
  Search,
  UserPlus,
  Users,
  Shield,
  Sparkles,
  Eye,
  ExternalLink,
} from "lucide-react";
import { synestheticCheck } from "@/lib/soundFx";

export interface BattleInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode?: string;
  roomId?: string;
  onSendSocketInvite?: (targetUserId: string) => void;
}

export function BattleInviteModal({
  isOpen,
  onClose,
  roomCode = "FORGIA-LIV3",
  roomId,
  onSendSocketInvite,
}: BattleInviteModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"link" | "search" | "spectator">("link");
  const [copied, setCopied] = useState(false);
  const [spectatorCopied, setSpectatorCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());

  const candidatesQuery = useQuery({
    queryKey: ["/api/backtest-tournaments/candidates", searchQuery],
    queryFn: () => fetchCandidates(searchQuery),
    enabled: isOpen && activeTab === "search",
  });

  const getInviteUrl = () => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    return `${origin}/chat?t=competizioni&vista=battaglie&room=${encodeURIComponent(roomCode)}`;
  };

  const effectiveRoomId = roomId || roomCode;
  const getSpectatorUrl = () => {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    return `${origin}/duello/${encodeURIComponent(effectiveRoomId)}`;
  };

  const handleCopySpectatorLink = () => {
    const url = getSpectatorUrl();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      synestheticCheck();
      navigator.clipboard.writeText(url);
      setSpectatorCopied(true);
      toast({
        title: "Link Tribuna Spettatori Copiato!",
        description: "Condividi questo link per far assistere chiunque al duello in diretta streaming sincrona.",
      });
      setTimeout(() => setSpectatorCopied(false), 2500);
    }
  };

  const handleCopyLink = () => {
    const url = getInviteUrl();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: "Link d'Invito Copiato!",
        description: "Invia questo link al tuo compagno per farlo entrare istantaneamente nella stanza 3D.",
      });
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleInviteCandidate = (candidate: CandidateTrader) => {
    setInvitedIds((prev) => new Set(prev).add(candidate.userId));
    if (onSendSocketInvite) {
      onSendSocketInvite(candidate.userId);
    }
    toast({
      title: "Invito Inviato!",
      description: `Sfida recapitata a ${candidate.displayName}.`,
    });
  };

  const candidates = candidatesQuery.data?.candidates ?? [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      className="max-w-md bg-[#0B0C10] border border-[#C5A059]/40 p-0 text-white overflow-hidden shadow-2xl"
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#D4AF37]">
              <UserPlus size={13} />
            </span>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">
                Invita Concorrenti alla Prova
              </h3>
              <span className="font-mono text-[10px] text-[#A1A1AA]">
                Stanza {roomCode}
              </span>
            </div>
          </div>

          <div className="flex rounded-lg bg-[#14151C] p-0.5 border border-white/10 font-mono text-[10.5px]">
            <button
              type="button"
              onClick={() => setActiveTab("link")}
              className={`px-2.5 py-1 rounded transition-all ${
                activeTab === "link"
                  ? "bg-[#C5A059] text-black font-bold shadow"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Link Rapido
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("search")}
              className={`px-2.5 py-1 rounded transition-all ${
                activeTab === "search"
                  ? "bg-[#C5A059] text-black font-bold shadow"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Fratellanza
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("spectator")}
              className={`px-2.5 py-1 rounded transition-all ${
                activeTab === "spectator"
                  ? "bg-[#C5A059] text-black font-bold shadow"
                  : "text-[#A1A1AA] hover:text-white"
              }`}
            >
              Tribuna
            </button>
          </div>
        </div>

        {activeTab === "link" && (
          <div className="space-y-3.5 py-1">
            <div className="p-3 rounded-lg bg-[#121318] border border-white/10 space-y-2 text-left">
              <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#A1A1AA] block">
                Codice Stanza Forgia
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xl font-mono font-extrabold tracking-wider text-[#D4AF37]">
                  {roomCode}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-mono text-[9.5px] text-emerald-400">
                  Pronta per il Duello
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                Link Diretto di Accesso
              </label>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#14151C] border border-white/10">
                <input
                  type="text"
                  readOnly
                  value={getInviteUrl()}
                  className="w-full bg-transparent border-none outline-none text-xs font-mono text-[#CBD5E1] px-2 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 shrink-0 transition-all shadow"
                >
                  {copied ? <Check size={12} className="stroke-[3]" /> : <Copy size={12} />}
                  <span>{copied ? "Copiato" : "Copia Link"}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-[#71717A] text-left leading-relaxed">
              Chiunque apra questo link accede immediatamente alla stanza multiplayer e compare nella Forgia 3D con il proprio profilo registrato.
            </p>
          </div>
        )}

        {activeTab === "search" && (
          <div className="space-y-3 text-left py-1">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-2.5 text-[#71717A]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca compagno per nome…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#14151C] border border-white/10 text-xs text-white placeholder-white/30 outline-none font-mono focus:border-[#C5A059]"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {candidatesQuery.isLoading ? (
                <div className="py-6 text-center text-xs font-mono text-[#71717A]">
                  Ricerca compagni in corso…
                </div>
              ) : candidates.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-[#71717A]">
                  Nessun trader trovato
                </div>
              ) : (
                candidates.map((c) => {
                  const isInvited = invitedIds.has(c.userId);
                  return (
                    <div
                      key={c.userId}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#14151C] border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#242531] border border-[#C5A059]/40 flex items-center justify-center font-mono text-[9.5px] text-[#D4AF37] font-bold">
                          {c.displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white block leading-tight">
                            {c.displayName}
                          </span>
                          <span className="text-[9.5px] font-mono text-[#8E92A0]">
                            {c.gradeTitle}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleInviteCandidate(c)}
                        disabled={isInvited}
                        className={`px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                          isInvited
                            ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                            : "bg-[#1E1F26] border border-white/10 text-[#CBD5E1] hover:bg-[#C5A059] hover:text-black hover:border-[#C5A059]"
                        }`}
                      >
                        {isInvited ? "Inviato" : "Invita"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === "spectator" && (
          <div className="space-y-3.5 py-1 text-left">
            <div className="p-3 rounded-lg bg-[#121318] border border-[#C5A059]/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-[#A1A1AA] flex items-center gap-1.5">
                  <Eye size={12} className="text-[#C5A059]" /> Tribuna Spettatori Live
                </span>
                <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 font-mono text-[9px] text-[#E8C56A] font-bold uppercase tracking-wider">
                  Accesso Libero
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-relaxed m-0">
                Consenti a osservatori, allievi e confratelli di assistere alla Prova in diretta.
                Visualizzeranno telemetria sincrona, battiti cardiaci e curve di capitale in tempo reale senza poter inviare ordini.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                Link Pubblico Spettatore
              </label>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#14151C] border border-white/10">
                <input
                  type="text"
                  readOnly
                  value={getSpectatorUrl()}
                  className="w-full bg-transparent border-none outline-none text-xs font-mono text-[#CBD5E1] px-2 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopySpectatorLink}
                  className="px-3 py-1.5 rounded bg-gradient-to-r from-[#C5A059] to-[#D4AF37] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hover:brightness-110 shrink-0 transition-all shadow"
                >
                  {spectatorCopied ? <Check size={12} className="stroke-[3]" /> : <Copy size={12} />}
                  <span>{spectatorCopied ? "Copiato" : "Copia Link"}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <a
                href={getSpectatorUrl()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#D4AF37] hover:underline"
              >
                <span>Apri schermata spettatore</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1E1F26] border border-white/10 text-xs font-mono font-semibold text-[#CBD5E1] hover:bg-[#2A2B35] transition-all"
          >
            Chiudi
          </button>
        </div>
      </div>
    </Modal>
  );
}
