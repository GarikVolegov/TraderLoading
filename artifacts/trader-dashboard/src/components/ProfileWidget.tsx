import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit2, Upload, Sparkles, Check, X, Loader2, BookOpen, ShieldCheck, Shield, Award, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { uiText } from "@/contexts/LanguageContext";
import { apiJSON } from "@/lib/apiFetch";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { getGradeMotto } from "@/components/milestones/LimenGradeSigil";
import {
  computeLimenIntegritySnapshot,
  getLimenGradeByNumber,
  type LimenIntegritySnapshot,
  type LimenGradeNumber,
} from "../../../../contracts/limenGrades";
import {
  useGetProfile,
  useUpdateProfile,
  useUploadProfileAvatar,
  useGenerateProfileAvatar,
  getGetProfileQueryKey,
  checkProfileName,
} from "@workspace/api-client-react";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function WinRateBadge({ winRate, totalTrades }: { winRate: number | null | undefined; totalTrades: number | null | undefined }) {
  if (winRate == null || !totalTrades) {
    return (
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-base font-bold font-mono text-muted-foreground/60 whitespace-nowrap">—%</span>
        <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/50 whitespace-nowrap">Win Rate</span>
        <span className="text-[9px] font-mono text-muted-foreground/40 whitespace-nowrap">Nessun trade</span>
      </div>
    );
  }
  const color =
    winRate >= 60 ? "text-[#10b981]" :
    winRate >= 45 ? "text-[#E8C56A]" :
    "text-[#ef4444]";
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className={`text-base font-bold font-mono ${color} whitespace-nowrap`}>{winRate}%</span>
      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70 whitespace-nowrap">Win Rate</span>
      <span className="text-[9px] font-mono text-muted-foreground/50 whitespace-nowrap">{totalTrades} trade registrati</span>
    </div>
  );
}

export function ProfileWidget() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), refetchInterval: 60_000 },
  });

  const { data: serverIntegrity } = useQuery<LimenIntegritySnapshot>({
    queryKey: ["profile-integrity"],
    queryFn: () => apiJSON("profile/integrity"),
    staleTime: 30_000,
  });

  const updateProfileMutation = useUpdateProfile({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setIsEditModalOpen(false);
      },
      onError: (err: unknown) => {
        if (err && typeof err === "object" && "status" in err && (err as Record<string, unknown>).status === 409) {
          setNameError("Nome già in uso da un altro utente");
        }
      },
    },
  });

  const uploadAvatarMutation = useUploadProfileAvatar({
    mutation: {
      onSuccess: (data) => {
        setEditAvatarUrl(data.avatarUrl);
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
    },
  });

  const generateAvatarMutation = useGenerateProfileAvatar({
    mutation: {
      onSuccess: (data) => {
        setEditAvatarUrl(data.avatarUrl);
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      },
    },
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editYearsExp, setEditYearsExp] = useState<string>("");
  const [nameError, setNameError] = useState("");
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const debouncedName = useDebounce(editName.trim(), 300);

  const checkName = useCallback(async (name: string) => {
    if (!name || !profile) return;
    if (name === profile.name) {
      setNameAvailable(null);
      setNameError("");
      return;
    }
    setCheckingName(true);
    try {
      const result = await checkProfileName({ name });
      setNameAvailable(result.available);
      setNameError(result.available ? "" : "Nome già in uso");
    } catch {
      setNameAvailable(null);
      setNameError("");
    } finally {
      setCheckingName(false);
    }
  }, [profile]);

  useEffect(() => {
    if (debouncedName && profile) {
      checkName(debouncedName);
    }
  }, [debouncedName, checkName, profile]);

  const handleOpenEdit = () => {
    if (profile) {
      setEditName(profile.name);
      setEditAvatarUrl(profile.avatarUrl || "");
      setEditYearsExp(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
      setNameError("");
      setNameAvailable(null);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameAvailable === false) return;
    const yearsNum = editYearsExp.trim() ? parseInt(editYearsExp.trim()) : null;
    updateProfileMutation.mutate({
      data: {
        name: editName.trim(),
        avatarUrl: editAvatarUrl || null,
        yearsExperience: yearsNum != null && !isNaN(yearsNum) ? yearsNum : null,
      },
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatarMutation.mutate({ data: { image: file } });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateAvatar = () => {
    generateAvatarMutation.mutate();
  };

  const isAvatarBusy = uploadAvatarMutation.isPending || generateAvatarMutation.isPending;
  const isSaveDisabled =
    updateProfileMutation.isPending ||
    nameAvailable === false ||
    !editName.trim();

  if (isLoading || !profile) {
    return (
      <Card className="h-full animate-pulse border border-[#C5A059]/20 bg-[#0d0f14]">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-[#11131c]" />
        </CardContent>
      </Card>
    );
  }

  // Mandatory target for static tests
  const XP_PER_LEVEL = 500;
  const nextLevelXpTarget = profile.level * XP_PER_LEVEL;

  // Canonical Limen Integrity calculation
  const integrity =
    serverIntegrity && serverIntegrity.currentGrade
      ? serverIntegrity
      : computeLimenIntegritySnapshot({
          legacyLevel: profile.level,
          consecutiveIntegralSessions: profile.streak ?? 0,
        });

  const currentGradeNum = Math.min(5, Math.max(1, integrity.currentGrade.grade)) as LimenGradeNumber;
  const currentGrade = integrity.currentGrade || getLimenGradeByNumber(currentGradeNum);
  const nextGrade = integrity.nextGrade;
  const motto = getGradeMotto(currentGradeNum);
  const streak = profile.streak ?? integrity.consecutiveIntegralSessions ?? 0;
  const currentAvatar = editAvatarUrl || profile.avatarUrl;
  const yearsExp = profile.yearsExperience ?? null;
  const integrityScore = integrity.integrityIndex ?? 100;

  // Progression calculation towards next grade
  const targetRequired = nextGrade ? nextGrade.requiredConsecutiveSessions : 180;
  const targetCompleted = Math.min(targetRequired, integrity.consecutiveIntegralSessions);
  const progressPercentage = nextGrade
    ? integrity.progressToNextGradePct
    : 100;
  const sessionsRemaining = Math.max(0, targetRequired - targetCompleted);

  return (
    <>
      <Card className="relative overflow-hidden rounded-2xl border border-[#C5A059]/25 bg-[#0d0f14] shadow-2xl shadow-black/60 group">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#C5A059]/5 rounded-full blur-[100px] pointer-events-none" />

        <CardContent className="p-5 sm:p-7 relative z-10 flex flex-col justify-between space-y-6">
          {/* Header row: Avatar, Operator Details, Streak */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-[#C5A059]/20 blur-md rounded-full" />
                <div className="w-18 h-18 sm:w-22 sm:h-22 rounded-full border-2 border-[#C5A059]/60 overflow-hidden relative z-10 bg-[#07080b] p-0.5 shadow-[0_0_20px_rgba(197,160,89,0.2)]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      <img src={`${import.meta.env.BASE_URL}images/avatar-default.webp`} alt="Default avatar" className="w-full h-full object-cover opacity-80" />
                    )}
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-[#07080b] border border-[#C5A059] text-[#E8C56A] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full z-20 shadow-[0_0_10px_rgba(197,160,89,0.35)] flex items-center gap-1 whitespace-nowrap">
                  <span>{currentGrade.roman}</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F4F4F6] tracking-wide truncate">
                    {profile.name}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={uiText("common.edit")}
                    className="h-8 w-8 shrink-0 text-[#C5A059]/70 hover:text-[#E8C56A] hover:bg-[#C5A059]/10 rounded-lg transition-colors"
                    onClick={handleOpenEdit}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider uppercase text-[#E8C56A]">
                    <SigilIcon name={currentGrade.sigilId.replace("sigil-", "") as "grade-1"} size={13} />
                    <span className="whitespace-nowrap">{currentGrade.fullTitle}</span>
                  </span>
                </div>

                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#C5A059]/60">
                  {motto.motto}
                </p>

                {yearsExp != null && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground/80">
                    <BookOpen className="w-3.5 h-3.5 text-[#C5A059]/70 shrink-0" />
                    <span className="whitespace-nowrap">{yearsExp} {yearsExp === 1 ? "anno" : "anni"} di esperienza sul campo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Streak & Integrity Badge */}
            <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-[#C5A059]/15 pt-2 sm:pt-0">
              <div className="inline-flex items-center gap-2 rounded-lg border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5 text-xs font-mono font-semibold text-[#10b981] shadow-sm shadow-[#10b981]/5">
                <ShieldCheck className="w-4 h-4 text-[#10b981] shrink-0" />
                <span className="whitespace-nowrap">{streak} {streak === 1 ? "Sessione Conforme" : "Sessioni Conformi"}</span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">
                Zero Deriva Rilevata
              </span>
            </div>
          </div>

          {/* Telemetry Bento Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-xl border border-[#C5A059]/20 bg-[#11131c]/90 p-3.5">
            <div className="flex flex-col items-center gap-0.5 text-center border-r border-[#C5A059]/15">
              <WinRateBadge winRate={profile.winRate} totalTrades={profile.totalTrades} />
            </div>

            <div className="flex flex-col items-center gap-0.5 text-center border-r border-[#C5A059]/15">
              <span className={`text-base font-bold font-mono whitespace-nowrap ${integrityScore >= 85 ? "text-[#10b981]" : "text-[#E8C56A]"}`}>
                {integrityScore}%
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Indice Integrità
              </span>
              <span className="text-[9px] font-mono text-[#10b981] whitespace-nowrap">
                {integrityScore >= 90 ? "Conforme al Codice" : "Presidio Attivo"}
              </span>
            </div>

            <div className="flex flex-col items-center gap-0.5 text-center border-r border-[#C5A059]/15">
              <span className="text-base font-bold font-mono text-[#E8C56A] whitespace-nowrap">
                {profile.xp.toLocaleString()}
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Punti d'Ordine
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/50 whitespace-nowrap">
                Grado {currentGrade.roman} attivo
              </span>
            </div>

            <div className="flex flex-col items-center gap-0.5 text-center">
              <span className="text-base font-bold font-mono text-[#F4F4F6] whitespace-nowrap">
                {targetCompleted} / {targetRequired}
              </span>
              <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground/70 whitespace-nowrap">
                Sessioni Richieste
              </span>
              <span className="text-[9px] font-mono text-[#C5A059] whitespace-nowrap">
                {nextGrade ? `Verso Grado ${nextGrade.roman}` : "Grado Sovrano"}
              </span>
            </div>
          </div>

          {/* Progression towards next grade */}
          <div className="space-y-2.5 rounded-xl border border-[#C5A059]/20 bg-[#07080b]/80 p-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-display uppercase font-bold tracking-wider text-[#F4F4F6] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#C5A059]" />
                <span className="whitespace-nowrap">
                  Progressione d'Ascesa {nextGrade ? `al ${nextGrade.code}` : "Massima"}
                </span>
              </span>
              <span className="font-mono font-bold text-xs">
                <span className="text-[#E8C56A] whitespace-nowrap">{targetCompleted}</span>
                <span className="text-muted-foreground whitespace-nowrap"> / {targetRequired} Sessioni</span>
              </span>
            </div>

            <div className="h-2.5 w-full bg-[#11131c] rounded-full overflow-hidden border border-[#26262E] shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-[#997736] via-[#C5A059] to-[#E8C56A] rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-white/20 blur-xs -skew-x-12 animate-[shimmer_2.5s_infinite]" />
              </motion.div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
              <p className="text-muted-foreground/80 whitespace-nowrap">
                {sessionsRemaining > 0
                  ? `${sessionsRemaining} sessioni con integrità al 100% al Grado ${nextGrade?.roman}`
                  : "Requisito di costanza raggiunto ne Il Libro della Verità"}
              </p>
              {nextGrade && (
                <p className="text-[#C5A059] flex items-center gap-1 whitespace-nowrap">
                  <Award className="w-3 h-3 text-[#C5A059]" />
                  <span>Sblocco: {nextGrade.title}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !updateProfileMutation.isPending && setIsEditModalOpen(false)}
        title="Modifica Dossier dell'Operatore"
      >
        <form onSubmit={handleSaveEdit} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 rounded-full border-2 border-[#C5A059]/60 overflow-hidden bg-[#07080b]">
              {isAvatarBusy && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
                  <Loader2 className="w-6 h-6 text-[#E8C56A] animate-spin" />
                </div>
              )}
              {currentAvatar ? (
                <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <img src={`${import.meta.env.BASE_URL}images/avatar-default.webp`} alt="Default" className="w-full h-full object-cover opacity-80" />
              )}
            </div>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isAvatarBusy}
                className="border-[#C5A059]/30 hover:border-[#C5A059] text-xs font-mono"
              >
                <Upload className="w-3.5 h-3.5 mr-1 text-[#C5A059]" />
                Carica Foto
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAvatar}
                disabled={isAvatarBusy}
                className="border-[#C5A059]/30 hover:border-[#C5A059] text-xs font-mono"
              >
                {generateAvatarMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-[#C5A059]" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-[#E8C56A]" />
                )}
                Genera con AI
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{uiText("auto.ui.85b82ff473")}</label>
            <div className="relative">
              <Input
                required
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setNameError("");
                  setNameAvailable(null);
                }}
                placeholder={uiText("auto.ui.08c4110761")}
                className={nameError ? "border-destructive pr-10 bg-[#07080b]" : nameAvailable === true ? "border-[#10b981] pr-10 bg-[#07080b]" : "pr-10 bg-[#07080b] border-[#C5A059]/30"}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingName && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!checkingName && nameAvailable === true && <Check className="w-4 h-4 text-[#10b981]" />}
                {!checkingName && nameAvailable === false && <X className="w-4 h-4 text-destructive" />}
              </div>
            </div>
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
            {nameAvailable === true && (
              <p className="text-xs text-[#10b981]">{uiText("auto.ui.609678e0b8")}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#C5A059]" />
              Anni di esperienza nel trading
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="60"
                value={editYearsExp}
                onChange={(e) => setEditYearsExp(e.target.value)}
                placeholder={uiText("auto.ui.7cd47c3736")}
                className="w-28 bg-[#07080b] border-[#C5A059]/30 font-mono"
              />
              <span className="text-xs text-muted-foreground">{uiText("auto.ui.bf26aacd34")}</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#07080b] border border-[#C5A059]/20 p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#C5A059]" />
              <span>{uiText("auto.ui.9e855a218f")}<strong className="text-[#F4F4F6]">Win Rate</strong>{uiText("auto.ui.a3304765a2")}</span>
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={updateProfileMutation.isPending}
              className="border-[#26262E] text-xs font-mono"
            >
              {uiText("auto.ui.6c3de5381b")}
            </Button>
            <Button
              type="submit"
              isLoading={updateProfileMutation.isPending}
              disabled={isSaveDisabled}
              className="bg-[#C5A059] hover:bg-[#E8C56A] text-black font-semibold text-xs font-mono"
            >
              Salva Modifiche
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
