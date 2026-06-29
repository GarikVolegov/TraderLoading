import { useState, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  Trophy,
  Lock,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Upload,
  Download,
  File,
  FileText,
  ImageIcon,
  CheckCircle,
  Star,
  Loader2,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Medal,
  Award,
  Shield,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { apiJSON, apiRequest as apiFetch } from "@/lib/apiFetch";
import { reportClientError } from "@/lib/clientErrorReporter";
import { formatFileSize } from "@/lib/fileFormatting";
import { uiText } from "@/contexts/LanguageContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 500;

const LEVEL_NAMES: Record<number, string> = {
  1: "Novizio Consapevole",
  2: "Apprendista Disciplinato",
  3: "Osservatore Silenzioso",
  4: "Analista in Formazione",
  5: "Samurai della Pazienza",
  6: "Cacciatore di Pattern",
  7: "Guardiano del Risk",
  8: "Maestro del Timeframe",
  9: "Sentinella dei Mercati",
  10: "Stratega dell'Incertezza",
  11: "Architetto del Piano",
  12: "Mente Antifrágile",
  13: "Ombra del Mercato",
  14: "Custode della Disciplina",
  15: "Ninja della Liquidità",
  16: "Alchimista delle Probabilità",
  17: "Falco dello Smart Money",
  18: "Sensei dell'Order Flow",
  19: "Leggenda del Trading",
  20: "Maestro Supremo",
};

function getLevelName(level: number): string {
  if (level in LEVEL_NAMES) return LEVEL_NAMES[level];
  if (level > 20) return "Maestro Supremo";
  return `Trader Livello ${level}`;
}

const BADGE_COLORS = [
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#6366f1",
];
const BADGE_EMOJIS = [
  "🏆",
  "⚔️",
  "🎯",
  "🧠",
  "🔥",
  "💎",
  "🌟",
  "🛡️",
  "🦅",
  "🌊",
  "⚡",
  "🎖️",
];

// ─── API helpers ──────────────────────────────────────────────────────────────
interface Milestone {
  id: number;
  level: number;
  title: string;
  description: string;
  skills: string;
  badgeEmoji: string;
  badgeColor: string;
  createdAt: string;
  updatedAt: string;
}
interface MilestoneFile {
  id: number;
  level: number;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  downloadable: boolean;
  createdAt: string;
}
interface Certificate {
  id: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  level: number;
  levelName: string;
  milestoneTitle: string;
  awardedAt: string;
}

function fileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith("image/"))
    return <ImageIcon className="w-4 h-4 text-blue-400" />;
  if (mimeType === "application/pdf")
    return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.startsWith("video/"))
    return <File className="w-4 h-4 text-purple-400" />;
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return <File className="w-4 h-4 text-green-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

// ─── NFT Certificate Card ─────────────────────────────────────────────────────

// Rarity tiers by level — higher levels get rarer, fancier holographic foils.
const RARITY_TIERS = [
  { min: 17, label: "MYTHIC",    holo: ["#ff5edb", "#a855f7", "#22d3ee", "#34d399"] },
  { min: 13, label: "LEGENDARY", holo: ["#fde68a", "#fbbf24", "#f59e0b", "#fb923c"] },
  { min: 9,  label: "EPIC",      holo: ["#c4b5fd", "#a855f7", "#7c3aed", "#6366f1"] },
  { min: 5,  label: "RARE",      holo: ["#7dd3fc", "#38bdf8", "#0ea5e9", "#22d3ee"] },
  { min: 1,  label: "COMMON",    holo: ["#6ee7b7", "#34d399", "#10b981", "#059669"] },
];
function rarityFor(level: number) {
  return RARITY_TIERS.find((t) => level >= t.min) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
}
// Deterministic FNV-1a hash → unique on-chain-style id + hue per certificate.
function certHash(cert: { id: number; level: number; userId: string }): string {
  let h = 2166136261;
  const s = `${cert.userId}:${cert.level}:${cert.id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function CertificateCard({ cert }: { cert: Certificate }) {
  const date = new Date(cert.awardedAt).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const color = BADGE_COLORS[(cert.level - 1) % BADGE_COLORS.length];
  const emoji = BADGE_EMOJIS[(cert.level - 1) % BADGE_EMOJIS.length];
  const tier = rarityFor(cert.level);
  const hash = certHash(cert);
  const hue = (parseInt(hash.slice(0, 2), 16) / 255) * 360;
  const holo = `linear-gradient(115deg, ${tier.holo[0]}, ${tier.holo[1]}, ${tier.holo[2]}, ${tier.holo[3]}, ${tier.holo[0]})`;

  // Pointer-driven 3D tilt + holographic sheen.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [10, -10]), { stiffness: 160, damping: 16 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), { stiffness: 160, damping: 16 });
  const sheenX = useTransform(px, [0, 1], ["-10%", "110%"]);
  const sheenBg = useTransform(sheenX, (x) => `linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.5) ${x}, transparent 65%)`);
  const sheenOpacity = useMotionValue(0);

  return (
    <div className="shrink-0" style={{ perspective: 1100 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          px.set((e.clientX - r.left) / r.width);
          py.set((e.clientY - r.top) / r.height);
          sheenOpacity.set(1);
        }}
        onMouseLeave={() => {
          px.set(0.5);
          py.set(0.5);
          sheenOpacity.set(0);
        }}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative w-64 rounded-[1.25rem] cursor-pointer select-none"
      >
        {/* Animated holographic foil border */}
        <motion.div
          aria-hidden
          className="absolute -inset-px rounded-[1.25rem] opacity-70"
          style={{ background: holo, backgroundSize: "300% 300%" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />

        {/* Card body */}
        <div
          className="relative rounded-[1.2rem] overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #070d1a 0%, #0d1426 48%, #070b16 100%)",
            boxShadow: `0 18px 40px -12px rgba(0,0,0,0.85), 0 0 26px ${tier.holo[1]}33`,
          }}
        >
          {/* Per-certificate unique iridescent wash (seeded hue) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.16]"
            style={{ background: `radial-gradient(120% 80% at ${20 + (hue % 60)}% 0%, hsl(${hue} 90% 60%), transparent 60%)` }}
          />
          {/* Guilloché security grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 7px),repeating-linear-gradient(-45deg,#fff 0 1px,transparent 1px 7px)",
            }}
          />
          {/* Pointer-following holographic sheen */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{ opacity: sheenOpacity, background: sheenBg }}
          />

          <div className="relative p-5" style={{ transform: "translateZ(40px)" }}>
            {/* Header: rarity tier + serial */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em]"
                style={{ background: `${tier.holo[1]}1f`, color: tier.holo[0], border: `1px solid ${tier.holo[1]}55` }}
              >
                {tier.label}
              </span>
              <span className="text-[9px] text-white/40 font-mono">#{cert.id.toString().padStart(4, "0")}</span>
            </div>

            {/* Floating badge */}
            <div className="flex justify-center mb-3">
              <motion.div
                className="relative"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 rounded-full blur-xl opacity-50" style={{ background: tier.holo[1] }} />
                <div
                  className="relative w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center text-4xl"
                  style={{
                    background: `radial-gradient(circle, ${color}22 0%, ${color}08 100%)`,
                    border: `2px solid ${color}66`,
                    boxShadow: `inset 0 0 18px ${color}33`,
                  }}
                >
                  {emoji}
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-[#06101d]"
                  style={{ background: holo, backgroundSize: "200% 200%" }}
                >
                  {cert.level}
                </div>
              </motion.div>
            </div>

            {/* Level name + milestone */}
            <div className="text-center mb-3">
              <p className="text-sm font-black text-white leading-tight">{cert.levelName}</p>
              {cert.milestoneTitle && (
                <p className="text-[10px] text-white/55 mt-0.5 leading-snug line-clamp-2">{cert.milestoneTitle}</p>
              )}
            </div>

            <div className="h-px mb-3" style={{ background: `linear-gradient(to right, transparent, ${tier.holo[1]}66, transparent)` }} />

            {/* Holder */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {cert.avatarUrl ? (
                <img src={cert.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover border" style={{ borderColor: `${color}66` }} />
              ) : (
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white" style={{ background: color }}>
                  {(cert.userName || "T").charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-[11px] font-bold text-white/85 truncate max-w-[10rem]">{cert.userName}</p>
            </div>

            {/* Footer: date + on-chain-style hash */}
            <div className="text-center">
              <p className="text-[9px] text-white/40">{date}</p>
              <p className="mt-1 text-[8px] font-mono text-white/30 flex items-center justify-center gap-1">
                <Sparkles className="w-2.5 h-2.5" style={{ color: tier.holo[0] }} />
                0x{hash}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Admin Milestone Editor ───────────────────────────────────────────────────

function MilestoneEditor({
  level,
  milestone,
  files,
  onClose,
}: {
  level: number;
  milestone: Milestone | null;
  files: MilestoneFile[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>(
    milestone?.skills ? (JSON.parse(milestone.skills) as string[]) : [],
  );
  const [badgeEmoji, setBadgeEmoji] = useState(milestone?.badgeEmoji ?? "🏆");
  const [badgeColor, setBadgeColor] = useState(
    milestone?.badgeColor ?? "#22c55e",
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setSkillInput("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await apiJSON(`milestones/${level}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          skills,
          badgeEmoji,
          badgeColor,
        }),
      });
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
      onClose();
    } catch (error) {
      reportClientError(error, { context: "milestone save", notify: false });
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await apiFetch(`milestones/${level}/files`, { method: "POST", body: fd });
      qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
    } catch (error) {
      reportClientError(error, {
        context: "milestone file upload",
        notify: false,
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleDownloadable = async (fileId: number, current: boolean) => {
    try {
      await apiJSON(`milestones/files/${fileId}/downloadable`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadable: !current }),
      });
      qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
    } catch (error) {
      reportClientError(error, {
        context: "milestone file downloadable toggle",
        notify: false,
      });
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      await apiFetch(`milestones/files/${fileId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
    } catch (error) {
      reportClientError(error, {
        context: "milestone file delete",
        notify: false,
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 border border-primary/30 rounded-2xl bg-card/80 backdrop-blur-sm p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          Modifica Traguardo Livello {level}
        </span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Titolo traguardo
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={uiText("auto.ui.5a8bc536be")}
            className="w-full h-9 px-3 rounded-xl border border-border bg-secondary/30 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5 flex-1">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Badge Emoji
            </label>
            <div className="flex flex-wrap gap-1">
              {BADGE_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setBadgeEmoji(e)}
                  className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${badgeEmoji === e ? "bg-primary/20 ring-1 ring-primary" : "bg-secondary/30 hover:bg-secondary/60"}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Colore badge
          </label>
          <div className="flex flex-wrap gap-2">
            {BADGE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setBadgeColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${badgeColor === c ? "scale-110 border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.07dfa30eec")}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={uiText("auto.ui.7a0349621f")}
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/30 text-sm focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Competenze acquisite
          </label>
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addSkill())
              }
              placeholder={uiText("auto.ui.3e04830784")}
              className="flex-1 h-9 px-3 rounded-xl border border-border bg-secondary/30 text-sm focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={addSkill}
              className="h-9 w-9 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary flex items-center justify-center transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skills.map((s, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                >
                  {s}
                  <button
                    onClick={() => setSkills(skills.filter((_, j) => j !== i))}
                    className="text-primary/60 hover:text-primary ml-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
            File e risorse
          </label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            {uploading ? "Caricamento..." : "Carica file"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={uploadFile}
            accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.mp4,.webm"
          />
        </div>
        {files.length > 0 && (
          <div className="space-y-1.5">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 p-2 rounded-xl border border-border bg-secondary/20 group"
              >
                <div className="shrink-0">{fileIcon(f.mimeType)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{f.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatFileSize(f.fileSize)}
                  </p>
                </div>
                <button
                  onClick={() => toggleDownloadable(f.id, f.downloadable)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${f.downloadable ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}
                >
                  {f.downloadable ? (
                    <ToggleRight className="w-3 h-3" />
                  ) : (
                    <ToggleLeft className="w-3 h-3" />
                  )}
                  {f.downloadable ? "DL" : "NO"}
                </button>
                <button
                  onClick={() => deleteFile(f.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length === 0 && (
          <p className="text-[11px] text-muted-foreground/50 text-center py-3 border border-dashed border-border rounded-xl">
            Nessun file — clicca "Carica file" per aggiungerne
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Salvataggio..." : "Salva Traguardo"}
        </button>
      </div>
    </motion.div>
  );
}

// ─── Level Row ────────────────────────────────────────────────────────────────

function LevelRow({
  level,
  currentLevel,
  isAdmin,
  certificates,
}: {
  level: number;
  currentLevel: number;
  isAdmin: boolean;
  certificates: Certificate[];
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const isUnlocked = currentLevel >= level;
  const isCurrent = currentLevel === level;
  const hasCert = certificates.some((c) => c.level === level);
  const levelName = getLevelName(level);
  const color = BADGE_COLORS[(level - 1) % BADGE_COLORS.length];
  const emoji = BADGE_EMOJIS[(level - 1) % BADGE_EMOJIS.length];

  const { data: detail, isLoading: loadingDetail } = useQuery<{
    milestone: Milestone | null;
    files: MilestoneFile[];
  }>({
    queryKey: ["milestone-detail", level],
    queryFn: () => apiJSON(`milestones/${level}`),
    enabled: expanded,
    staleTime: 30_000,
  });

  const milestone = detail?.milestone ?? null;
  const files = detail?.files ?? [];
  const skills: string[] = milestone?.skills
    ? JSON.parse(milestone.skills)
    : [];

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isCurrent
          ? "border-primary/50 shadow-[0_0_16px_rgba(34,197,94,0.1)]"
          : isUnlocked
            ? "border-border hover:border-border/80"
            : "border-border/30 opacity-60"
      } bg-card/40 backdrop-blur-sm`}
    >
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/10 transition-colors"
      >
        {/* Badge */}
        <div className="shrink-0 relative">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
            style={{
              background: isUnlocked
                ? `radial-gradient(circle, ${color}25 0%, ${color}08 100%)`
                : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${isUnlocked ? color + "50" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            {isUnlocked ? (
              emoji
            ) : (
              <Lock className="w-4 h-4 text-muted-foreground/30" />
            )}
          </div>
          {hasCert && (
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center shadow-sm">
              <Star className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Level info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: isUnlocked ? color : "rgba(255,255,255,0.3)" }}
            >
              LV {level}
            </span>
            {isCurrent && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/20 text-primary border border-primary/30">
                ATTUALE
              </span>
            )}
            {hasCert && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                CERTIFICATO
              </span>
            )}
          </div>
          <p
            className={`text-sm font-bold leading-tight truncate ${isUnlocked ? "text-foreground" : "text-muted-foreground/40"}`}
          >
            {levelName}
          </p>
          {milestone?.title && (
            <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">
              {milestone.title}
            </p>
          )}
        </div>

        {/* XP needed */}
        <div className="shrink-0 text-right mr-2 hidden sm:block">
          <p className="text-[10px] text-muted-foreground/50">{uiText("auto.ui.00f59e3a8e")}</p>
          <p className="text-xs font-mono font-bold text-muted-foreground">
            {((level - 1) * XP_PER_LEVEL).toLocaleString()}
          </p>
        </div>

        {/* Admin edit */}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(true);
              setEditing((s) => !s);
            }}
            className="shrink-0 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            title={uiText("auto.ui.d24714bb3d")}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/30 px-4 pb-4">
              {loadingDetail ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : !milestone && !isAdmin ? (
                <p className="text-sm text-muted-foreground/50 text-center py-6">
                  {isUnlocked
                    ? "Nessun contenuto ancora per questo livello."
                    : "Sblocca questo livello per vederne i contenuti."}
                </p>
              ) : (
                <div className="pt-4 space-y-4">
                  {/* Content */}
                  {milestone && (
                    <>
                      {milestone.description && (
                        <p className="text-sm text-foreground/80 leading-relaxed">
                          {milestone.description}
                        </p>
                      )}
                      {skills.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                            Competenze acquisite
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((s, i) => (
                              <span
                                key={i}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border"
                                style={{
                                  background: `${color}15`,
                                  borderColor: `${color}40`,
                                  color,
                                }}
                              >
                                <CheckCircle className="w-3 h-3" /> {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {files.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">
                            Risorse e file
                          </p>
                          <div className="space-y-1.5">
                            {files.map((f) => (
                              <div
                                key={f.id}
                                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border bg-secondary/20"
                              >
                                <div className="shrink-0">
                                  {fileIcon(f.mimeType)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold truncate">
                                    {f.fileName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground/60">
                                    {formatFileSize(f.fileSize)}
                                  </p>
                                </div>
                                {f.downloadable ? (
                                  <a
                                    href={f.fileUrl}
                                    download={f.fileName}
                                    className="shrink-0 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                                    title={uiText("auto.ui.bf03edb19e")}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                ) : (
                                  <div
                                    className="shrink-0 p-1.5 rounded-lg bg-secondary/30 text-muted-foreground/30"
                                    title={uiText("auto.ui.c4a952844c")}
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Admin editor */}
                  {isAdmin && editing && (
                    <MilestoneEditor
                      level={level}
                      milestone={milestone}
                      files={files}
                      onClose={() => setEditing(false)}
                    />
                  )}
                  {isAdmin && !editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors w-full justify-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {milestone
                        ? "Modifica contenuto traguardo"
                        : "Aggiungi contenuto a questo traguardo"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Milestones() {
  const { data: profile } = useGetProfile();
  const currentLevel = profile?.level ?? 1;

  const { data: certificates = [] } = useQuery<Certificate[]>({
    queryKey: ["my-certificates"],
    queryFn: () => apiJSON("milestones/certificates/me"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: adminStatus } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-status"],
    queryFn: () => apiJSON("milestones/admin/status"),
    staleTime: 60_000,
  });
  const isAdmin = adminStatus?.isAdmin ?? false;

  const maxLevel = Math.max(20, currentLevel + 3);
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-6">
        <PageHeader
          title={uiText("auto.ui.689daf8e42")}
          subtitle={uiText("auto.ui.f1e28afebb")}
          icon={<Trophy className="w-5 h-5 text-primary" />}
        />

        {/* Admin badge */}
        {isAdmin && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <p className="text-xs text-primary font-semibold">
              Modalità Admin — puoi modificare i contenuti di ogni traguardo
            </p>
          </div>
        )}

        {/* Progress bar */}
        {profile && (
          <div className="rounded-2xl border border-border bg-card/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">
                  {getLevelName(currentLevel)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Livello {currentLevel} · {profile.xp.toLocaleString()} XP
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground/60">
                  Prossimo livello
                </p>
                <p className="text-xs font-bold text-primary">
                  {profile.xpToNextLevel.toLocaleString()} XP mancanti
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500"
                style={{
                  width: `${Math.round(((XP_PER_LEVEL - profile.xpToNextLevel) / XP_PER_LEVEL) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Certificates gallery */}
        {certificates.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-400" />
              <h3 className="text-sm font-bold">{uiText("auto.ui.4314491bc5")}</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                {certificates.length}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              {certificates.map((c) => (
                <CertificateCard key={c.id} cert={c} />
              ))}
            </div>
          </div>
        )}

        {certificates.length === 0 && !isAdmin && (
          <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center">
            <Medal className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm font-semibold text-muted-foreground/60">
              Nessun certificato ancora
            </p>
            <p className="text-xs text-muted-foreground/40 mt-1">
              Completa missioni e sali di livello per sbloccare i tuoi
              certificati NFT
            </p>
          </div>
        )}

        {/* Levels list */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-muted-foreground">
              Tutti i livelli
            </h3>
          </div>
          {levels.map((level) => (
            <LevelRow
              key={level}
              level={level}
              currentLevel={currentLevel}
              isAdmin={isAdmin}
              certificates={certificates}
            />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
