import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Edit2, Hexagon, Star, Upload, Sparkles, Check, X, Loader2, Flame, Trophy, TrendingUp, BookOpen } from "lucide-react";
import { getLevelName, getLevelBadge } from "@/utils/levelNames";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
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
        <span className="text-xs text-muted-foreground/50 font-mono">—%</span>
        <span className="text-[10px] text-muted-foreground/40">Win Rate</span>
      </div>
    );
  }
  const color =
    winRate >= 60 ? "text-emerald-400" :
    winRate >= 45 ? "text-yellow-400" :
    "text-red-400";
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <span className={`text-sm font-bold font-mono ${color}`}>{winRate}%</span>
      <span className="text-[10px] text-muted-foreground/60">Win Rate</span>
      <span className="text-[9px] text-muted-foreground/40">{totalTrades} trade</span>
    </div>
  );
}

export function ProfileWidget() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useGetProfile();

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
      <Card className="h-full animate-pulse">
        <CardContent className="p-8 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-secondary/50" />
        </CardContent>
      </Card>
    );
  }

  const XP_PER_LEVEL = 500;
  const xpIntoLevel = profile.xp % XP_PER_LEVEL;
  const progressPercentage = Math.min(100, (xpIntoLevel / XP_PER_LEVEL) * 100);
  const levelBadge = getLevelBadge(profile.level);
  const levelName = profile.levelName || getLevelName(profile.level);
  const streak = profile.streak ?? 0;
  const currentAvatar = editAvatarUrl || profile.avatarUrl;
  const yearsExp = profile.yearsExperience ?? null;

  return (
    <>
      <Card className="h-full relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        <CardContent className="p-4 sm:p-6 md:p-8 relative z-10 flex flex-col h-full justify-between">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 sm:gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 border-primary/50 overflow-hidden relative z-10 bg-secondary">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                  ) : (
                    <img src={`${import.meta.env.BASE_URL}images/avatar-default.png`} alt="Default avatar" className="w-full h-full object-cover opacity-80" />
                  )}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-background border border-primary text-primary text-xs font-bold w-8 h-8 flex items-center justify-center rounded-full z-20 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                  {profile.level}
                </div>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground font-mono flex items-center gap-2">
                  {profile.name}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={handleOpenEdit}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </h2>
                <div className={`flex items-center gap-1.5 mt-1 text-sm font-medium ${levelBadge.color}`}>
                  <span>{levelBadge.emoji}</span>
                  <span>{levelName}</span>
                </div>
                {yearsExp != null && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground/60">
                    <BookOpen className="w-3 h-3" />
                    <span>{yearsExp} {yearsExp === 1 ? "anno" : "anni"} di esperienza</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {streak > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 px-2.5 py-1 rounded-full text-xs font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{streak}d</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 border border-border/20 rounded-xl p-3 bg-secondary/10">
            <div className="flex flex-col items-center gap-0.5 text-center border-r border-border/20">
              <TrendingUp className="w-4 h-4 text-muted-foreground/50 mb-0.5" />
              <WinRateBadge winRate={profile.winRate} totalTrades={profile.totalTrades} />
            </div>
            <div className="flex flex-col items-center gap-0.5 text-center">
              <Trophy className="w-4 h-4 text-muted-foreground/50 mb-0.5" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-bold font-mono text-primary">{profile.xp.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground/60">XP Totali</span>
                <span className="text-[9px] text-muted-foreground/40">Livello {profile.level}</span>
              </div>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 space-y-2 sm:space-y-3">
            <div className="flex justify-between items-end text-sm">
              <span className="font-medium text-muted-foreground flex items-center gap-1">
                <Hexagon className="w-4 h-4" /> Progressione XP
              </span>
              <span className="font-mono font-bold">
                <span className="text-primary">{xpIntoLevel}</span>
                <span className="text-muted-foreground"> / {XP_PER_LEVEL}</span>
              </span>
            </div>

            <div className="h-3 w-full bg-secondary/80 rounded-full overflow-hidden border border-border shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full relative"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-20 bg-white/20 blur-sm -skew-x-12 animate-[shimmer_2s_infinite]" />
              </motion.div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-mono">
                {profile.xpToNextLevel} XP al prossimo livello
              </p>
              {streak > 0 && (
                <p className="text-xs text-orange-400/70 flex items-center gap-1">
                  <Flame className="w-3 h-3" />
                  {streak} {streak === 1 ? "giorno" : "giorni"} • +{Math.min(50, (streak - 1) * 5)} XP bonus
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => !updateProfileMutation.isPending && setIsEditModalOpen(false)}
        title="Modifica Profilo"
      >
        <form onSubmit={handleSaveEdit} className="space-y-5">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 rounded-full border-2 border-primary/50 overflow-hidden bg-secondary">
              {isAvatarBusy && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}
              {currentAvatar ? (
                <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <img src={`${import.meta.env.BASE_URL}images/avatar-default.png`} alt="Default" className="w-full h-full object-cover opacity-80" />
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
              >
                <Upload className="w-4 h-4 mr-1" />
                Carica Foto
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateAvatar}
                disabled={isAvatarBusy}
              >
                {generateAvatarMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-1" />
                )}
                Genera con AI
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome Trader</label>
            <div className="relative">
              <Input
                required
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  setNameError("");
                  setNameAvailable(null);
                }}
                placeholder="Il tuo nome"
                className={nameError ? "border-destructive pr-10" : nameAvailable === true ? "border-primary pr-10" : "pr-10"}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingName && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {!checkingName && nameAvailable === true && <Check className="w-4 h-4 text-primary" />}
                {!checkingName && nameAvailable === false && <X className="w-4 h-4 text-destructive" />}
              </div>
            </div>
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
            {nameAvailable === true && (
              <p className="text-xs text-primary">Nome disponibile</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              Anni di esperienza nel trading
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="60"
                value={editYearsExp}
                onChange={(e) => setEditYearsExp(e.target.value)}
                placeholder="es. 3"
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">anni</span>
            </div>
            <p className="text-xs text-muted-foreground/50">
              Lascia vuoto se preferisci non indicarlo
            </p>
          </div>

          <div className="rounded-xl bg-secondary/20 border border-border/20 p-3">
            <p className="text-xs text-muted-foreground/60 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Il <strong>Win Rate</strong> viene calcolato automaticamente dai tuoi trade nel Diario.</span>
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditModalOpen(false)}
              disabled={updateProfileMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              isLoading={updateProfileMutation.isPending}
              disabled={isSaveDisabled}
            >
              Salva Modifiche
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
