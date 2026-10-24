import { useState, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
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
  ShieldCheck,
  Eye,
  Printer,
  BookOpen,
  Flame,
  Activity,
  Info,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetProfile } from "@workspace/api-client-react";
import { PageLayout } from "@/components/PageLayout";
import { apiJSON } from "@/lib/apiFetch";
import { reportClientError, getClientErrorMessage } from "@/lib/clientErrorReporter";
import { formatFileSize } from "@/lib/fileFormatting";
import { uiText, useLanguage } from "@/contexts/LanguageContext";
import { parseSkills } from "./Milestones.helpers";
import { QueryErrorState } from "@/components/QueryErrorState";
import {
  LIMEN_GRADES,
  computeLimenIntegritySnapshot,
  DRIFT_ALERT_TITLE,
  DRIFT_ALERT_DESCRIPTION,
  type LimenIntegritySnapshot,
  type LimenGradeDefinition,
} from "../../../../contracts/limenGrades";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { LimenMedallion } from "@/components/milestones/LimenMedallion";
import { getGradeMotto } from "@/components/milestones/LimenGradeSigil";
import { LimenCertificateModal } from "@/components/milestones/LimenCertificateModal";
import {
  GradeCharacter3DViewer,
  GRADE_CHARACTERS_DATA,
  type GradeCharacterData,
} from "@/components/milestones/GradeCharacter3DViewer";
import {
  downloadCertificatePng,
  printCertificate,
  type CertificateData,
} from "@/components/milestones/certificateExport";

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 500;

const _LEVEL_NAME_KEYS: Record<number, string> = {
  1: "auto.ui.4559a17b5e",
  2: "auto.ui.2caa1da9b9",
  3: "auto.ui.e498ae1a14",
  4: "auto.ui.64eeac7848",
  5: "auto.ui.20000353da",
  6: "auto.ui.4834240463",
  7: "auto.ui.ed854bfbb4",
  8: "auto.ui.0fe1013fcc",
  9: "auto.ui.428726eb20",
  10: "auto.ui.2c80fd1a95",
  11: "auto.ui.c2e7ae2034",
  12: "auto.ui.02e0a648b7",
  13: "auto.ui.f982b763ec",
  14: "auto.ui.01c01c665c",
  15: "auto.ui.f10db535d1",
  16: "auto.ui.b1d38a66f0",
  17: "auto.ui.130ee38a83",
  18: "auto.ui.4d60c4ebda",
  19: "auto.ui.94c1e9a613",
  20: "auto.ui.d3ba7cadf3",
};

function getLevelName(level: number): string {
  const idx = Math.max(0, Math.min(LIMEN_GRADES.length - 1, level - 1));
  return LIMEN_GRADES[idx]?.fullTitle ?? "GRADO I — Novizio Consapevole";
}

const BADGE_COLORS = [
  "#C5A059",
  "#D4B475",
  "#A88948",
  "#E2C78E",
  "#8B1E1E",
];
const BADGE_EMOJIS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
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
    return <ImageIcon className="w-4 h-4 text-primary" />;
  if (mimeType === "application/pdf")
    return <FileText className="w-4 h-4 text-red-400" />;
  if (mimeType.startsWith("video/"))
    return <File className="w-4 h-4 text-amber-400" />;
  if (
    mimeType.includes("sheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return <File className="w-4 h-4 text-emerald-400" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

// ─── LIMEN Seal of Investiture Card ───────────────────────────────────────────

const SYNTHESIZED_GRADE_PRIVILEGES: Record<number, { requirement: string; privileges: string[] }> = {
  1: {
    requirement: "Patto di Ingresso alla Soglia",
    privileges: [
      "La Forgia del Passato (Simulatore)",
      "Il Libro della Verità & Varco",
      "La Dottrina del Tempo",
    ],
  },
  2: {
    requirement: "30 Sessioni Integre al 100%",
    privileges: [
      "Mandato di Espansione (Royalty 20%)",
      "Il Tempio Fisico (Protocollo Bio)",
      "Prove del Fuoco d'Élite",
    ],
  },
  3: {
    requirement: "90 Giorni di Costanza Verificata",
    privileges: [
      "Diritto di Parola al Concilio Domenicale",
      "Moduli Negoziazione Straight Line",
      "Accesso Riservato Capi Uniforme",
    ],
  },
  4: {
    requirement: "3 Trimestri Continui di Integrità",
    privileges: [
      "Accademia Sandbox & Masterclass",
      "Capitale Allocato & Syndication",
      "Strumenti Istituzionali Avanzati",
    ],
  },
  5: {
    requirement: "Investitura Cerchia Interna (Comando)",
    privileges: [
      "Governance & Comando Supremo Ordine",
      "Diritto di Investitura Grado I – IV",
      "Accesso Illimitato ad Ogni Risorsa",
    ],
  },
};

const GRADE_KPI_CONFIG: Record<
  number,
  {
    targetLabel: string;
    requirementShort: string;
    kpiLeftLabel: string;
    getKpiLeftValue: (snap: LimenIntegritySnapshot) => string;
    kpiRightLabel: string;
    kpiRightValue: string;
    focusMandate: string;
    getProgressPct: (snap: LimenIntegritySnapshot) => number;
  }
> = {
  1: {
    targetLabel: "Requisito d'Ingresso",
    requirementShort: "Sottoscrizione Patto di Ingresso alla Soglia",
    kpiLeftLabel: "Patto Soglia",
    getKpiLeftValue: () => "Attivo",
    kpiRightLabel: "Vincolo Rischio",
    kpiRightValue: "Max ≤ 1%",
    focusMandate: "Fondamenti Operativi & Varco",
    getProgressPct: () => 100,
  },
  2: {
    targetLabel: "Requisito di Ascesa",
    requirementShort: "30 Sessioni Integre ne Il Libro della Verità",
    kpiLeftLabel: "Sessioni",
    getKpiLeftValue: (snap) =>
      snap.currentGrade.grade >= 2
        ? "30 / 30"
        : `${Math.min(30, snap.consecutiveIntegralSessions)} / 30`,
    kpiRightLabel: "Integrità Min.",
    kpiRightValue: "≥ 85%",
    focusMandate: "Mandato Royalty 20% (30€/m)",
    getProgressPct: (snap) =>
      snap.currentGrade.grade >= 2
        ? 100
        : Math.min(100, Math.round((snap.consecutiveIntegralSessions / 30) * 100)),
  },
  3: {
    targetLabel: "Requisito di Ascesa",
    requirementShort: "90 Giorni di Costanza Operativa e Fisica",
    kpiLeftLabel: "Costanza",
    getKpiLeftValue: (snap) =>
      snap.currentGrade.grade >= 3
        ? "90 / 90g"
        : `${Math.min(90, snap.consecutiveIntegralSessions)} / 90g`,
    kpiRightLabel: "Integrità Min.",
    kpiRightValue: "≥ 90%",
    focusMandate: "Concilio & Straight Line",
    getProgressPct: (snap) =>
      snap.currentGrade.grade >= 3
        ? 100
        : Math.min(100, Math.round((snap.consecutiveIntegralSessions / 90) * 100)),
  },
  4: {
    targetLabel: "Requisito di Ascesa",
    requirementShort: "120 Sessioni Integre & Profit Factor ≥ 1.5",
    kpiLeftLabel: "Sessioni",
    getKpiLeftValue: (snap) =>
      snap.currentGrade.grade >= 4
        ? "120 / 120"
        : `${Math.min(120, snap.consecutiveIntegralSessions)} / 120`,
    kpiRightLabel: "Target Tecnico",
    kpiRightValue: "PF ≥ 1.5 · 92%",
    focusMandate: "Rete B2B & Capitale Allocato",
    getProgressPct: (snap) =>
      snap.currentGrade.grade >= 4
        ? 100
        : Math.min(100, Math.round((snap.consecutiveIntegralSessions / 120) * 100)),
  },
  5: {
    targetLabel: "Requisito di Comando",
    requirementShort: "Investitura Diretta dalla Cerchia Interna",
    kpiLeftLabel: "Anzianità",
    getKpiLeftValue: (snap) =>
      snap.currentGrade.grade >= 5 ? "Comando" : "180+ Sess.",
    kpiRightLabel: "Integrità Min.",
    kpiRightValue: "≥ 95%",
    focusMandate: "Cerchia Interna Sovrana",
    getProgressPct: (snap) => (snap.currentGrade.grade >= 5 ? 100 : 0),
  },
};

export interface GradePerkDetail {
  readonly title: string;
  readonly desc: string;
}

const GRADE_RICH_PERKS: Record<number, readonly GradePerkDetail[]> = {
  1: [
    {
      title: "La Forgia del Passato",
      desc: "Simulatore di mercato per validazione storica",
    },
    {
      title: "Il Libro della Verità",
      desc: "Diario immutabile di sessione e Varco",
    },
    {
      title: "La Dottrina del Tempo",
      desc: "Disciplina d'esecuzione: Assedio & Duello",
    },
    {
      title: "L'Ordine Giornaliero",
      desc: "Presidio della Soglia e salvaguardia del capitale (1%)",
    },
  ],
  2: [
    {
      title: "Il Tempio Fisico",
      desc: "Protocollo biologico, biohacking e nutrizione d'élite",
    },
    {
      title: "Mandato di Espansione",
      desc: "Codice di Chiamata con royalty ricorrente 20% (30€/m)",
    },
    {
      title: "Prove del Fuoco d'Élite",
      desc: "Test di tenuta emotiva e disciplina sui mercati",
    },
    {
      title: "Custodia del Codice",
      desc: "Autorizzazione sessioni e presidio di integrità",
    },
  ],
  3: [
    {
      title: "Il Concilio della Domenica",
      desc: "Accesso prioritario e diritto di parola al tavolo strategico",
    },
    {
      title: "Moduli Negoziazione Avanzata",
      desc: "Sistema Straight Line applicato alle negoziazioni",
    },
    {
      title: "Uniforme Riservata LIMEN",
      desc: "Accesso preliminare ai capi sartoriali del Grado III",
    },
    {
      title: "Supervisione Iniziati",
      desc: "Ruolo di mentore operativo per i nuovi ammessi",
    },
  ],
  4: [
    {
      title: "LIMEN B2B Rete Imprenditoriale",
      desc: "Segnalazione e chiusura contratti d'impresa alto ticket",
    },
    {
      title: "Capitale Allocato & Garante",
      desc: "Rango di Garante Seniore ne La Fratellanza & syndication",
    },
    {
      title: "Uniforme di Rango Superiore",
      desc: "Insegne e capi cerimoniali esclusivi del Grado IV",
    },
    {
      title: "Divisioni Esecutive",
      desc: "Leadership di desk operativi e coordinamento strategico",
    },
  ],
  5: [
    {
      title: "Cerchia Interna LIMEN",
      desc: "Membro permanente del vertice sovrano e decisionale",
    },
    {
      title: "Sovranità Operativa Totale",
      desc: "Pieno comando su tutte le divisioni dell'Ecosistema",
    },
    {
      title: "Diritto di Nomina & Veto",
      desc: "Apposizione del sigillo supremo e investitura Gradi I–IV",
    },
    {
      title: "Archivio Arcano & Risorse",
      desc: "Accesso incondizionato all'eredità tecnologica e riserve",
    },
  ],
};

const RARITY_TIERS = [
  { min: 5, label: "GRADO V · CERCHIA INTERNA", holo: ["#E2C78E", "#C5A059", "#8B1E1E", "#D4B475"] },
  { min: 4, label: "GRADO IV · SOVRANO",        holo: ["#E2C78E", "#D4B475", "#C5A059", "#A88948"] },
  { min: 3, label: "GRADO III · ARCHITETTO",    holo: ["#D4B475", "#C5A059", "#A88948", "#8B733B"] },
  { min: 2, label: "GRADO II · CUSTODE",        holo: ["#C5A059", "#A88948", "#8B733B", "#D4B475"] },
  { min: 1, label: "GRADO I · NEOFITA",         holo: ["#A88948", "#8B733B", "#C5A059", "#6E5A2F"] },
];
function rarityFor(level: number) {
  return RARITY_TIERS.find((t) => level >= t.min) ?? RARITY_TIERS[RARITY_TIERS.length - 1];
}
// Deterministic FNV-1a hash → unique on-chain-style id per certificate.
function certHash(cert: { id: number; level: number; userId: string }): string {
  let h = 2166136261;
  const s = `${cert.userId}:${cert.level}:${cert.id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function CertificateCard({
  cert,
  onInspect,
  onDownload,
  onPrint,
}: {
  cert: Certificate;
  onInspect?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
}) {
  const { language } = useLanguage();
  const date = new Date(cert.awardedAt).toLocaleDateString(language, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const color = BADGE_COLORS[(cert.level - 1) % BADGE_COLORS.length];
  const tier = rarityFor(cert.level);
  const hash = certHash(cert);
  const holo = `linear-gradient(115deg, ${tier.holo[0]}, ${tier.holo[1]}, ${tier.holo[2]}, ${tier.holo[3]}, ${tier.holo[0]})`;

  // Pointer-driven 3D tilt + burnished gold sheen.
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [10, -10]), { stiffness: 160, damping: 16 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-10, 10]), { stiffness: 160, damping: 16 });
  const sheenX = useTransform(px, [0, 1], ["-10%", "110%"]);
  const sheenBg = useTransform(sheenX, (x) => `linear-gradient(105deg, transparent 35%, rgba(197,160,89,0.35) ${x}, transparent 65%)`);
  const sheenOpacity = useMotionValue(0);

  return (
    <div className="shrink-0" style={{ perspective: 1100 }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        onClick={onInspect}
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
        className="relative w-full max-w-[270px] rounded-sm cursor-pointer select-none group"
      >
        {/* Animated burnished gold foil border */}
        <motion.div
          aria-hidden
          className="absolute -inset-px rounded-sm opacity-75 group-hover:opacity-100 transition-opacity"
          style={{ background: holo, backgroundSize: "300% 300%" }}
          animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />

        {/* Card body */}
        <div
          className="relative rounded-sm overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #0A0A0C 0%, #141418 48%, #0A0A0C 100%)",
            boxShadow: `0 18px 40px -12px rgba(0,0,0,0.85), 0 0 24px rgba(197,160,89,0.18)`,
          }}
        >
          {/* Per-certificate obsidian & gold wash */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.14]"
            style={{ background: `radial-gradient(120% 80% at 50% 0%, #C5A059, transparent 65%)` }}
          />
          {/* Guilloché security grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#fff 0 1px,transparent 1px 7px),repeating-linear-gradient(-45deg,#fff 0 1px,transparent 1px 7px)",
            }}
          />
          {/* Pointer-following sheen */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none mix-blend-overlay"
            style={{ opacity: sheenOpacity, background: sheenBg }}
          />

          <div className="relative p-4 sm:p-5" style={{ transform: "translateZ(40px)" }}>
            {/* Header: rarity tier + serial */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="px-2 py-0.5 rounded-sm font-mono text-[8px] font-bold uppercase tracking-[0.18em]"
                style={{ background: `${tier.holo[1]}1f`, color: tier.holo[0], border: `1px solid ${tier.holo[1]}55` }}
              >
                {tier.label}
              </span>
              <span className="text-[9px] text-white/40 font-mono">#{cert.id.toString().padStart(4, "0")}</span>
            </div>

            {/* Floating badge with detailed Grade Sigil */}
            <div className="flex justify-center mb-3">
              <motion.div
                className="relative"
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 rounded-full blur-xl opacity-60" style={{ background: tier.holo[1] }} />
                <div
                  className="relative w-[5.5rem] h-[5.5rem] rounded-full flex items-center justify-center p-1"
                  style={{
                    background: `radial-gradient(circle, #181920 0%, #0A0A0E 100%)`,
                    border: `2px solid ${tier.holo[1]}99`,
                    boxShadow: `0 0 20px ${tier.holo[1]}33, inset 0 0 15px ${tier.holo[1]}22`,
                  }}
                >
                  <LimenMedallion grade={cert.level} size={76} glow={true} animate={false} />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-[#06101d] border border-black/50 shadow-md"
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

            <div className="h-px mb-2.5" style={{ background: `linear-gradient(to right, transparent, ${tier.holo[1]}66, transparent)` }} />

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
              <p className="mt-0.5 text-[8px] font-mono text-white/30 flex items-center justify-center gap-1">
                <Sparkles className="w-2.5 h-2.5" style={{ color: tier.holo[0] }} />
                0x{hash}
              </p>
            </div>

            {/* Actions Toolbar */}
            <div
              className="mt-3 pt-2 border-t border-white/10 flex items-center justify-center gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onInspect}
                title="Visualizza Certificato NFT"
                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 transition-colors"
              >
                <Eye className="w-3 h-3 text-primary" />
                <span>Certificato</span>
              </button>
              <button
                type="button"
                onClick={onDownload}
                title="Scarica Certificato PNG HD"
                className="p-1 rounded-sm bg-white/5 hover:bg-white/15 text-primary border border-border transition-colors"
                aria-label="Scarica NFT"
              >
                <Download className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={onPrint}
                title="Stampa Certificato"
                className="p-1 rounded-sm bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-foreground border border-white/10 transition-colors"
                aria-label="Stampa"
              >
                <Printer className="w-3 h-3" />
              </button>
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
  onBusyChange,
}: {
  level: number;
  milestone: Milestone | null;
  files: MilestoneFile[];
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(milestone?.title ?? "");
  const [description, setDescription] = useState(milestone?.description ?? "");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>(parseSkills(milestone?.skills));
  const [badgeEmoji, setBadgeEmoji] = useState(milestone?.badgeEmoji ?? "🏆");
  const [badgeColor, setBadgeColor] = useState(
    milestone?.badgeColor ?? "#22c55e",
  );
  const [operation, setOperation] = useState<"save" | "upload" | "file" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const busy = operation !== null;
  const saving = operation === "save";
  const uploading = operation === "upload";

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills([...skills, s]);
    setSkillInput("");
  };

  const runOperation = async (kind: "save" | "upload" | "file", task: () => Promise<void>, context: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    onBusyChange(true);
    setOperation(kind);
    setErrorMessage(null);
    try { await task(); }
    catch (error) {
      setErrorMessage(getClientErrorMessage(error, uiText("common.error")));
      reportClientError(error, { context, notify: false });
    } finally {
      busyRef.current = false;
      onBusyChange(false);
      setOperation(null);
    }
  };

  const save = () => {
    const submitted = { title, description, skills: [...skills], badgeEmoji, badgeColor };
    return runOperation("save", async () => {
      await apiJSON(`milestones/${level}`, { method: "PUT", body: JSON.stringify(submitted) });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["milestones"] }),
        qc.invalidateQueries({ queryKey: ["milestone-detail", level] }),
      ]);
      onClose();
    }, "milestone save");
  };

  const uploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    return runOperation("upload", async () => {
      try {
        const form = new FormData(); form.append("file", file);
        await apiJSON(`milestones/${level}/files`, { method: "POST", body: form });
        await qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
      } finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
    }, "milestone file upload");
  };

  const toggleDownloadable = (fileId: number, current: boolean) => runOperation("file", async () => {
    await apiJSON(`milestones/files/${fileId}/downloadable`, { method: "PATCH", body: JSON.stringify({ downloadable: !current }) });
    await qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
  }, "milestone file downloadable toggle");

  const deleteFile = (fileId: number) => runOperation("file", async () => {
    await apiJSON(`milestones/files/${fileId}`, { method: "DELETE" });
    await qc.invalidateQueries({ queryKey: ["milestone-detail", level] });
  }, "milestone file delete");

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 border border-primary/30 rounded-2xl bg-card/80 backdrop-blur-sm p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-primary">
          {uiText("auto.ui.6ddd3bca3c", { level })}
        </span>
        <button
          onClick={() => { if (!busyRef.current) onClose(); }}
          disabled={busy}
          aria-label={uiText("common.close")}
          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {errorMessage && <p role="alert" className="text-sm text-destructive">{errorMessage}</p>}
      <fieldset disabled={busy} aria-busy={busy} className="space-y-4 border-0 p-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor={`milestone-${level}-title`} className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {uiText("auto.ui.259cbd5e44")}
            </label>
            <input
              id={`milestone-${level}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={uiText("auto.ui.5a8bc536be")}
              className="w-full h-9 px-3 rounded-xl border border-border bg-secondary/30 text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5 flex-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {uiText("auto.ui.633288e36d")}
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
              {uiText("auto.ui.6062c61902")}
            </label>
            <div className="flex flex-wrap gap-2">
              {BADGE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBadgeColor(c)}
                  aria-label={c}
                  aria-pressed={badgeColor === c}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${badgeColor === c ? "scale-110 border-white" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`milestone-${level}-description`} className="text-[10px] text-muted-foreground uppercase tracking-wider">{uiText("auto.ui.07dfa30eec")}</label>
            <textarea
              id={`milestone-${level}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={uiText("auto.ui.7a0349621f")}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/30 text-sm focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`milestone-${level}-skill`} className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {uiText("auto.ui.2b7a7f86e7")}
            </label>
            <div className="flex gap-2">
              <input
                id={`milestone-${level}-skill`}
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
              {uiText("auto.ui.1ccd55f663")}
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
              {uploading ? uiText("common.loading") : uiText("auto.ui.6cdd9c8c78")}
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
                    aria-label={uiText("common.delete")}
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {files.length === 0 && (
            <p className="text-[11px] text-muted-foreground/50 text-center py-3 border border-dashed border-border rounded-xl">
              {uiText("auto.ui.133509ea5d")}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? uiText("auto.ui.7760459f96") : uiText("auto.ui.157ad75db3")}
          </button>
        </div>
      </fieldset>
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
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const editingBusyRef = useRef(false);
  const isUnlocked = currentLevel >= level;
  const isCurrent = currentLevel === level;
  const hasCert = certificates.some((c) => c.level === level);
  const levelName = getLevelName(level);
  const color = BADGE_COLORS[(level - 1) % BADGE_COLORS.length];
  const emoji = BADGE_EMOJIS[(level - 1) % BADGE_EMOJIS.length];

  const { data: detail, isLoading: loadingDetail, isError: detailError, refetch: refetchDetail } = useQuery<{
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
  const skills: string[] = parseSkills(milestone?.skills);

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
        isCurrent
          ? "border-primary/50"
          : isUnlocked
            ? "border-border hover:border-border/80"
            : "border-border/30 opacity-60"
      } bg-card/40 backdrop-blur-sm`}
    >
      <div className="flex items-center">
        <button
          onClick={() => { if (!editingBusyRef.current) setExpanded(s => !s); }}
          disabled={editingBusy}
          className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/10 transition-colors"
        >
          {/* Badge */}
          <div className="shrink-0 relative">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl overflow-hidden p-0.5"
              style={{
                background: isUnlocked
                  ? `radial-gradient(circle, ${color}25 0%, ${color}08 100%)`
                  : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${isUnlocked ? color + "50" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {isUnlocked ? (
                <LimenMedallion grade={level} size={34} glow animate={false} />
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
                  {uiText("auto.ui.a1991c83d4")}
                </span>
              )}
              {hasCert && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  {uiText("auto.ui.8a14d6fe3e")}
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


          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Admin edit */}
        {isAdmin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (editingBusyRef.current) return;
              setExpanded(true);
              setEditing((s) => !s);
            }}
            className="mr-4 shrink-0 p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            disabled={editingBusy}
            title={uiText("auto.ui.d24714bb3d")}
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

      </div>

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
              ) : detailError ? (
                <div role="alert"><QueryErrorState onRetry={() => void refetchDetail()} /></div>
              ) : !milestone && !isAdmin ? (
                <p className="text-sm text-muted-foreground/50 text-center py-6">
                  {isUnlocked
                    ? uiText("auto.ui.8a1c12312a")
                    : uiText("auto.ui.4def9897d2")}
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
                            {uiText("auto.ui.af5851ff1f")}
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
                      onBusyChange={value => { editingBusyRef.current = value; setEditingBusy(value); }}
                    />
                  )}
                  {isAdmin && !editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors w-full justify-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {milestone
                        ? uiText("auto.ui.8fc65674bd")
                        : uiText("auto.ui.891575ec6a")}
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

  const { data: certificates = [], isLoading: certificatesLoading } = useQuery<Certificate[]>({
    queryKey: ["my-certificates"],
    queryFn: () => apiJSON("milestones/certificates/me"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: adminStatus, isLoading: adminStatusLoading } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["admin-status"],
    queryFn: () => apiJSON("milestones/admin/status"),
    staleTime: 60_000,
  });
  const isAdmin = adminStatus?.isAdmin ?? false;

  const { data: serverIntegrity } = useQuery<LimenIntegritySnapshot>({
    queryKey: ["profile-integrity"],
    queryFn: () => apiJSON("profile/integrity"),
    staleTime: 30_000,
  });

  const integrity =
    serverIntegrity ??
    computeLimenIntegritySnapshot({
      legacyLevel: currentLevel,
      consecutiveIntegralSessions: profile?.streak ?? 0,
      isAdmin,
    });

  const [selectedCert, setSelectedCert] = useState<CertificateData | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [inspectingCharacter, setInspectingCharacter] = useState<GradeCharacterData | null>(null);
  const [inspectingPerksGrade, setInspectingPerksGrade] = useState<LimenGradeDefinition | null>(null);

  const openCertModal = (cert: CertificateData) => {
    setSelectedCert(cert);
    setIsCertModalOpen(true);
  };

  const closeCertModal = () => {
    setIsCertModalOpen(false);
    setSelectedCert(null);
  };

  return (
    <PageLayout quiet>
      <div className="flex flex-col lg:h-[calc(100vh-100px)] lg:min-h-0 lg:overflow-hidden pt-1">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-3.5 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          {/* ─── PANNELLO SINISTRO: RANGO ATTUALE, INTEGRITÀ, DERIVA & SIGILLI ─── */}
          <aside className="space-y-2.5 flex flex-col lg:h-full lg:overflow-y-auto pr-0.5">
            {/* Operator Integrity & Current Grade Status Panel */}
            <div className="limen-panel-surface p-3.5 space-y-2.5 border border-border/80">
              <div className="flex items-center gap-3 border-b border-border pb-2.5">
                <div className="relative shrink-0">
                  <LimenMedallion grade={integrity.currentGrade.grade} size={54} glow animate={false} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">
                    Rango Attuale dell&apos;Operatore
                  </p>
                  <h2
                    className="text-sm font-bold uppercase tracking-[0.06em] text-foreground leading-snug"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {integrity.currentGrade.fullTitle}
                  </h2>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {integrity.currentGrade.subtitle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="border border-border/80 bg-background/80 p-2 text-center">
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
                    Indice di Integrità
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-primary">
                    {integrity.integrityIndex}%
                  </p>
                </div>
                <div className="border border-border/80 bg-background/80 p-2 text-center">
                  <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
                    Sessioni Integre
                  </p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-foreground">
                    {integrity.consecutiveIntegralSessions}
                    {integrity.nextGrade && !integrity.nextGrade.adminOnly
                      ? ` / ${integrity.nextGrade.requiredConsecutiveSessions}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between font-mono text-[9.5px]">
                  <span className="text-muted-foreground truncate pr-2">
                    {integrity.nextGrade
                      ? `Ascesa verso ${integrity.nextGrade.code}`
                      : "Grado Supremo Raggiunto"}
                  </span>
                  <span className="font-bold text-primary">{integrity.progressToNextGradePct}%</span>
                </div>
                <div className="h-1.5 bg-background border border-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${integrity.progressToNextGradePct}%` }}
                  />
                </div>
              </div>

              {/* Direct Download/Print Certificate for Current Grade */}
              <button
                type="button"
                onClick={() => {
                  const currentG = integrity.currentGrade;
                  const existingCert = certificates.find((c) => c.level === currentG.grade);
                  const effectiveUserName = (profile?.name && profile.name.trim()) || "Operatore";
                  const targetCert: CertificateData = existingCert
                    ? {
                        ...existingCert,
                        level: currentG.grade,
                        levelName: currentG.fullTitle,
                        userName: effectiveUserName,
                      }
                    : {
                        id: currentG.grade,
                        userId: String(profile?.id ?? "trader"),
                        userName: effectiveUserName,
                        avatarUrl: profile?.avatarUrl || null,
                        level: currentG.grade,
                        levelName: currentG.fullTitle,
                        milestoneTitle: currentG.subtitle,
                        awardedAt: new Date().toISOString(),
                      };
                  openCertModal(targetCert);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-sm font-mono text-[10px] font-bold uppercase tracking-wider border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-all shadow-sm"
              >
                <Award className="w-3.5 h-3.5 text-primary" />
                <span>Certificato &amp; Sigillo ({integrity.currentGrade.code})</span>
              </button>
            </div>

            {/* Disciplina & Deriva Status (Compact indicator with tooltip) */}
            {integrity.driftDetected ? (
              <div
                role="alert"
                className="border border-destructive bg-destructive/15 p-2 text-foreground"
              >
                <div className="flex items-start gap-2">
                  <SigilIcon variant="drift-warning" size={15} className="mt-0.5 text-destructive shrink-0" />
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-destructive">
                      {DRIFT_ALERT_TITLE}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-tight text-foreground/85">
                      {integrity.driftAlertMessage ?? DRIFT_ALERT_DESCRIPTION}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="limen-panel-surface border-border/80 px-3 py-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                    Disciplina: Integra
                  </span>
                </div>
                <span
                  className="font-mono text-[9px] text-muted-foreground uppercase cursor-help"
                  title="Legge di Retrocessione: la violazione delle regole di rischio o l'interruzione del diario comporta il decadimento dell'Indice di Integrità."
                >
                  Regola Attiva
                </span>
              </div>
            )}

            {/* Sigillo di Investitura (3D Card Showcase) */}
            <div className="limen-panel-surface p-3 space-y-2.5 border border-border/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  <h3 className="font-mono text-[10.5px] font-bold uppercase tracking-wider">Sigillo di Investitura</h3>
                </div>
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[9px] font-bold bg-primary/15 text-primary border border-primary/30">
                  {certificates.length}
                </span>
              </div>

              {certificatesLoading || adminStatusLoading ? (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              ) : certificates.length > 0 ? (
                <div className="flex justify-center py-0.5">
                  {certificates.slice(0, 1).map((c) => {
                    const personalizedCert: Certificate = {
                      ...c,
                      userName: (profile?.name && profile.name.trim()) ? profile.name.trim() : (c.userName || "Operatore"),
                    };
                    return (
                      <CertificateCard
                        key={c.id}
                        cert={personalizedCert}
                        onInspect={() => openCertModal(personalizedCert)}
                        onDownload={() => downloadCertificatePng(personalizedCert)}
                        onPrint={() => printCertificate(personalizedCert)}
                      />
                    );
                  })}
                </div>
              ) : certificates.length === 0 && !isAdmin && !certificatesLoading && !adminStatusLoading ? (
                <div className="border border-dashed border-border/80 p-3 text-center my-auto">
                  <Medal className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1" />
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    In attesa di primo sigillo
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-snug">
                    Mantieni l&apos;Indice al 100% per 30 sessioni per sbloccare il Grado II.
                  </p>
                </div>
              ) : null}

              {/* Secondary button to open Document Endowments modal */}
              <button
                type="button"
                onClick={() => setIsDocumentsModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-2 rounded-sm font-mono text-[9.5px] font-bold uppercase tracking-wider border border-border/70 bg-background/70 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Archivio Dotazioni (I – V)</span>
              </button>
            </div>

            {/* ─── MODULO ASSETTO DISCIPLINA & PRESERVAZIONE DEL RANGO ─── */}
            <div className="limen-panel-surface p-3 space-y-2.5 border border-border/80">
              <div className="flex items-center justify-between border-b border-border/70 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-foreground">
                    Assetto Disciplina &amp; Rango
                  </h3>
                </div>
                <span className="flex items-center gap-1 font-mono text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  AUDIT ATTIVO
                </span>
              </div>

              {/* 3 Metric Pills */}
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="border border-border/70 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">Sessioni Integre</p>
                  <p className="font-mono text-xs font-bold text-foreground mt-0.5">
                    {integrity.consecutiveIntegralSessions}
                  </p>
                </div>
                <div className="border border-border/70 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">Violazioni</p>
                  <p className={`font-mono text-xs font-bold mt-0.5 ${integrity.recentViolationsCount > 0 ? "text-destructive" : "text-emerald-400"}`}>
                    {integrity.recentViolationsCount > 0 ? `${integrity.recentViolationsCount}` : "0"}
                  </p>
                </div>
                <div className="border border-border/70 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">Ultimo Diario</p>
                  <p className={`font-mono text-xs font-bold mt-0.5 ${(integrity.daysSinceLastTruthEntry ?? 0) > 5 ? "text-amber-400" : "text-primary"}`}>
                    {integrity.daysSinceLastTruthEntry === 0 ? "Oggi" : `${integrity.daysSinceLastTruthEntry ?? 0}g`}
                  </p>
                </div>
              </div>

              {/* Monitoraggio Prossimo Obiettivo */}
              <div className="border border-primary/20 bg-primary/[0.03] p-2 rounded-sm space-y-1">
                <div className="flex items-center justify-between font-mono text-[8.5px]">
                  <span className="text-muted-foreground uppercase tracking-wider truncate pr-1">
                    {integrity.nextGrade ? `Obiettivo: ${integrity.nextGrade.code}` : "Stato Supremo"}
                  </span>
                  <span className="text-primary font-bold shrink-0">
                    {integrity.progressToNextGradePct}%
                  </span>
                </div>
                <p className="font-mono text-[9.5px] text-foreground font-semibold leading-tight">
                  {integrity.nextGrade ? integrity.nextGrade.title : "Cerchia Interna LIMEN"}
                </p>
                <div className="h-1 bg-background border border-border overflow-hidden rounded-full mt-1">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${integrity.progressToNextGradePct}%` }}
                  />
                </div>
              </div>

              {/* I Tre Vincoli di Salvaguardia */}
              <div className="space-y-1 pt-1 border-t border-border/50 font-mono text-[8.5px]">
                <div className="flex items-start gap-1.5 text-muted-foreground leading-tight">
                  <span className="text-primary font-bold shrink-0">I.</span>
                  <span><strong className="text-foreground/90 font-semibold">Patto 1%:</strong> Max 1% di rischio per operazione.</span>
                </div>
                <div className="flex items-start gap-1.5 text-muted-foreground leading-tight">
                  <span className="text-primary font-bold shrink-0">II.</span>
                  <span><strong className="text-foreground/90 font-semibold">Diario Verità:</strong> Compilazione obbligatoria per convalidare.</span>
                </div>
                <div className="flex items-start gap-1.5 text-muted-foreground leading-tight">
                  <span className="text-primary font-bold shrink-0">III.</span>
                  <span><strong className="text-foreground/90 font-semibold">Retrocessione:</strong> Caduta di grado se violi il codice.</span>
                </div>
              </div>

              {/* Azioni Rapide Esecutive */}
              <div className="pt-1 grid grid-cols-2 gap-1.5">
                <Link
                  href="/journal"
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider border border-border/80 bg-background/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all shadow-sm"
                >
                  <BookOpen className="w-3 h-3 text-primary" />
                  <span>Diario Verità ↗</span>
                </Link>
                <Link
                  href="/backtest"
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider border border-border/80 bg-background/80 hover:bg-secondary/40 text-muted-foreground hover:text-foreground transition-all shadow-sm"
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Forgia Passato ↗</span>
                </Link>
              </div>
            </div>
          </aside>

          {/* ─── PANNELLO PRINCIPALE: I 5 GRADI DI ASCESA (5 COLONNE SIDE-BY-SIDE FIT VIEWPORT) ─── */}
          <section className="flex flex-col lg:h-full lg:min-h-0 space-y-2">
            {/* Header compatto */}
            <div className="limen-panel-surface px-4 py-2 flex items-center justify-between border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Medal className="w-4 h-4 text-primary" />
                <h3
                  className="text-xs sm:text-sm font-bold uppercase tracking-[0.16em] text-foreground"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Architettura de I 5 Gradi di Ascesa
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
                  Sblocco per Merito ed Integrità
                </span>
                <span className="border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-primary">
                  {integrity.currentGrade.code} ATTIVO
                </span>
              </div>
            </div>

            {/* Griglia a 5 Colonne */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5 flex-1 min-h-0 overflow-y-auto">
              {LIMEN_GRADES.map((gradeDef) => {
                const unlocked = isAdmin || integrity.currentGrade.grade >= gradeDef.grade;
                const isCurrent = integrity.currentGrade.grade === gradeDef.grade;
                const kpi = GRADE_KPI_CONFIG[gradeDef.grade] ?? {
                  targetLabel: "Requisito di Ascesa",
                  requirementShort: gradeDef.requirementSummary,
                  kpiLeftLabel: "Sessioni",
                  getKpiLeftValue: () => `${gradeDef.requiredConsecutiveSessions}`,
                  kpiRightLabel: "Integrità",
                  kpiRightValue: `≥ ${gradeDef.minIntegrityPct}%`,
                  focusMandate: gradeDef.title,
                  getProgressPct: () => (unlocked ? 100 : 0),
                };
                const kpiProgress = kpi.getProgressPct(integrity);
                const kpiLeftVal = kpi.getKpiLeftValue(integrity);
                const perks = GRADE_RICH_PERKS[gradeDef.grade] ?? [];

                return (
                  <div
                    key={gradeDef.grade}
                    className={`flex flex-col justify-between p-2.5 sm:p-3 rounded-sm border transition-all duration-300 relative overflow-hidden ${
                      isCurrent
                        ? "border-primary bg-primary/[0.04] shadow-[0_0_24px_rgba(197,160,89,0.15)]"
                        : unlocked
                          ? "border-border/80 bg-card/60 hover:border-primary/40"
                          : "border-border/40 bg-background/40 opacity-75"
                    }`}
                  >
                    {/* Top Section */}
                    <div className="flex flex-col flex-1 min-h-0">
                      <div className="h-6 flex items-center justify-between shrink-0 mb-0.5">
                        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary whitespace-nowrap">
                          {gradeDef.code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isCurrent ? (
                            <span className="border border-primary/50 bg-primary/20 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-primary whitespace-nowrap">
                              Attuale
                            </span>
                          ) : unlocked ? (
                            <span className="border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-primary/80 whitespace-nowrap">
                              Sbloccato
                            </span>
                          ) : (
                            <span className="border border-border/60 bg-background px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                              <Lock className="w-2.5 h-2.5" /> Bloccato
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingPerksGrade(gradeDef);
                            }}
                            title="Informazioni Dotazioni &amp; Privilegi"
                            className="p-1 rounded-sm border border-primary/30 bg-primary/10 hover:bg-primary/25 text-primary transition-all flex items-center justify-center shadow-sm"
                          >
                            <Info className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* 3D Medallion Centerpiece */}
                      <div className="h-[88px] flex items-center justify-center shrink-0 my-0.5">
                        <LimenMedallion
                          grade={gradeDef.grade}
                          size={gradeDef.grade === 5 ? 72 : 78}
                          glow={isCurrent || unlocked}
                          animate={true}
                          alt={gradeDef.title}
                        />
                      </div>

                      {/* Title & Complete Operational Subtitle (Zero truncation) */}
                      <div className="flex flex-col items-center justify-center text-center shrink-0 my-1 px-0.5 h-[66px]">
                        <h4
                          className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.06em] text-foreground leading-tight"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          {gradeDef.title}
                        </h4>
                        <p className="text-[8px] sm:text-[8.5px] text-muted-foreground/90 leading-tight mt-1 italic font-serif">
                          {gradeDef.subtitle}
                        </p>
                      </div>

                      {/* Modulo Requisito & Parametri Operativi di Rango */}
                      <div className="border border-primary/30 bg-gradient-to-b from-[#14151C]/95 to-[#0D0E13]/95 p-2 rounded-sm shrink-0 my-1 shadow-[inset_0_1px_0_rgba(197,160,89,0.16)] flex flex-col justify-between h-[166px]">
                        <div className="h-6 flex items-center justify-between gap-1 font-mono text-[7.5px] uppercase tracking-wider shrink-0">
                          <span className="font-bold text-primary flex items-center gap-1 min-w-0">
                            <ShieldCheck className="w-2.5 h-2.5 text-primary shrink-0" />
                            <span className="leading-tight">{kpi.targetLabel}</span>
                          </span>
                          <span className="font-mono text-[8px] font-bold text-primary bg-primary/15 border border-primary/40 px-1.5 py-0.5 rounded-sm shadow-[0_0_8px_rgba(197,160,89,0.25)] shrink-0">
                            {kpiProgress}%
                          </span>
                        </div>

                        {/* Full Requirement Description (Uniform height for 2-3 lines) */}
                        <div className="h-[36px] flex flex-col justify-center shrink-0">
                          <p className="font-mono text-[8.5px] font-semibold text-foreground/95 leading-snug">
                            {kpi.requirementShort}
                          </p>
                        </div>

                        {/* Glowing Gold Progress Bar */}
                        <div className="h-1 bg-black/70 border border-primary/25 rounded-full overflow-hidden p-[0.5px] shrink-0">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-[#FFE8A3] shadow-[0_0_8px_rgba(197,160,89,0.6)] transition-all duration-500"
                            style={{ width: `${kpiProgress}%` }}
                          />
                        </div>

                        {/* 2-Column Operational KPI Grid */}
                        <div className="grid grid-cols-2 gap-1 shrink-0">
                          <div className="h-[38px] flex flex-col justify-center border border-border/60 bg-background/70 px-1.5 py-0.5 rounded-sm">
                            <span className="block font-mono text-[7px] uppercase tracking-wider text-muted-foreground leading-none">
                              {kpi.kpiLeftLabel}
                            </span>
                            <span className="block font-mono text-[9px] font-bold text-foreground mt-0.5 leading-tight">
                              {kpiLeftVal}
                            </span>
                          </div>
                          <div className="h-[38px] flex flex-col justify-center border border-border/60 bg-background/70 px-1.5 py-0.5 rounded-sm">
                            <span className="block font-mono text-[7px] uppercase tracking-wider text-muted-foreground leading-none">
                              {kpi.kpiRightLabel}
                            </span>
                            <span className="block font-mono text-[8.5px] font-bold text-primary mt-0.5 leading-tight">
                              {kpi.kpiRightValue}
                            </span>
                          </div>
                        </div>

                        {/* Focus Mandato del Rango */}
                        <div className="h-[26px] flex items-center justify-between pt-1 border-t border-border/40 font-mono text-[7.5px] shrink-0">
                          <span className="uppercase tracking-wider text-muted-foreground shrink-0">Mandato:</span>
                          <span className="font-semibold text-foreground/90 text-right leading-tight min-w-0 pl-1">{kpi.focusMandate}</span>
                        </div>
                      </div>

                      {/* Dedicated Full-Width Button for Dotazioni & Privilegi Dossier */}
                      <button
                        type="button"
                        onClick={() => setInspectingPerksGrade(gradeDef)}
                        className="w-full h-7 flex items-center justify-between px-2.5 my-0.5 rounded-sm border border-primary/30 bg-primary/[0.06] hover:bg-primary/15 hover:border-primary/50 text-foreground/90 hover:text-primary transition-all group shrink-0 shadow-sm"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[8.5px] font-bold uppercase tracking-wider whitespace-nowrap">
                          <Info className="w-3 h-3 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                          <span>Dotazioni ({perks.length})</span>
                        </span>
                        <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-primary whitespace-nowrap">
                          Info ↗
                        </span>
                      </button>

                      {/* 3D Character Viewport — Clean Figurine without background, blending into app */}
                      <GradeCharacter3DViewer
                        grade={gradeDef.grade}
                        unlocked={unlocked}
                        isCurrent={isCurrent}
                        onInspect={(c) => setInspectingCharacter(c)}
                      />
                    </div>

                    {/* Action Button at Bottom (Aligned) */}
                    <div className="pt-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const existingCert = certificates.find((c) => c.level === gradeDef.grade);
                          const targetCert: CertificateData = existingCert
                            ? {
                                ...existingCert,
                                userName:
                                  profile?.name && profile.name.trim()
                                    ? profile.name.trim()
                                    : existingCert.userName || "Operatore",
                              }
                            : {
                                id: gradeDef.grade,
                                userId: String(profile?.id ?? "trader"),
                                userName:
                                  profile?.name && profile.name.trim()
                                    ? profile.name.trim()
                                    : "Operatore",
                                avatarUrl: profile?.avatarUrl || null,
                                level: gradeDef.grade,
                                levelName: gradeDef.fullTitle,
                                milestoneTitle: gradeDef.subtitle,
                                awardedAt: new Date().toISOString(),
                              };
                          openCertModal(targetCert);
                        }}
                        className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-sm font-mono text-[9.5px] font-bold uppercase tracking-wider transition-all ${
                          isCurrent || unlocked
                            ? "border border-primary/50 bg-primary/15 hover:bg-primary/25 text-primary shadow-sm"
                            : "border border-border bg-secondary/20 hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Award className="w-3.5 h-3.5 text-primary" />
                        <span>Sigillo &amp; Certificato NFT</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* Interactive NFT Certificate Inspection Modal */}
      <LimenCertificateModal
        cert={selectedCert}
        isOpen={isCertModalOpen}
        onClose={closeCertModal}
      />

      {/* Modal / Drawer for Secondary Document Endowments */}
      {isDocumentsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setIsDocumentsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-lg border border-primary/40 bg-[#0E0F14] text-foreground shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-[#14151C]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                  Dotazioni Documentali per Grado (I – V)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDocumentsModalOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {[1, 2, 3, 4, 5].map((level) => (
                <LevelRow
                  key={level}
                  level={level}
                  currentLevel={integrity.currentGrade.grade}
                  isAdmin={isAdmin}
                  certificates={certificates}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3D Character & Diorama Inspection Modal */}
      {inspectingCharacter && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectingCharacter(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg border border-primary/50 bg-[#0B0C10] text-foreground shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-[#101218]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">
                    {inspectingCharacter.code} — {inspectingCharacter.title}
                  </h3>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                    Modello 3D // Blender &amp; Gemini Image
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingCharacter(null)}
                className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="relative max-h-[500px] w-full flex items-center justify-center rounded-md overflow-hidden border border-primary/30 shadow-2xl bg-black p-3">
                <img
                  src={inspectingCharacter.src}
                  alt={inspectingCharacter.characterName}
                  className="max-h-[460px] w-auto max-w-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.9)]"
                />
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none">
                  <span className="px-2 py-0.5 rounded-sm font-mono text-[8px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/40">
                    {inspectingCharacter.characterName}
                  </span>
                  <p className="text-xs font-bold mt-1 text-white/90">
                    {inspectingCharacter.caption}
                  </p>
                </div>
              </div>

              <div className="space-y-2 border border-border/70 bg-background/80 p-3.5 rounded-sm">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  Dettagli della Rappresentazione Iniziatica
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {inspectingCharacter.details}
                </p>
              </div>

              <div className="space-y-1.5">
                <h5 className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  Elementi Salienti dell&apos;Armatura &amp; Scena:
                </h5>
                <div className="grid grid-cols-1 gap-1.5">
                  {inspectingCharacter.highlights.map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-sm bg-background/50 border border-border/40 text-xs text-foreground/90 font-mono"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dossier: Dotazioni Sbloccate & Privilegi del Grado */}
      {inspectingPerksGrade && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectingPerksGrade(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg flex flex-col rounded-lg border border-primary/50 bg-[#0E0F14] text-foreground shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-[#14151C]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                    {inspectingPerksGrade.code} // DOTAZIONI SBLOCCATE &amp; PRIVILEGI
                  </h3>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-primary">
                    {inspectingPerksGrade.fullTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingPerksGrade(null)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto max-h-[75vh]">
              {/* Medallion & Lore summary */}
              <div className="flex items-center gap-3.5 p-3 rounded-sm border border-primary/25 bg-primary/[0.04]">
                <LimenMedallion grade={inspectingPerksGrade.grade} size={56} glow animate={false} />
                <div className="min-w-0 flex-1">
                  <h4
                    className="text-sm font-bold uppercase text-foreground leading-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {inspectingPerksGrade.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground italic font-serif leading-snug mt-0.5">
                    {inspectingPerksGrade.subtitle}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] text-primary">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{inspectingPerksGrade.requirementSummary}</span>
                  </div>
                </div>
              </div>

              {/* 4 Rich Privileges */}
              <div className="space-y-2 pt-1">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-0.5">
                  Dotazioni &amp; Privilegi Concessi dal Rango
                </p>
                {(GRADE_RICH_PERKS[inspectingPerksGrade.grade] ?? []).map((perk, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-sm bg-background/80 border border-border/70 hover:border-primary/40 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] font-bold text-foreground">
                        {perk.title}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground leading-snug mt-0.5 font-sans">
                        {perk.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border bg-[#14151C] flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingPerksGrade(null)}
                className="px-3 py-1.5 rounded-sm font-mono text-[10px] font-bold uppercase tracking-wider border border-border/70 bg-background/80 hover:bg-secondary/40 text-foreground transition-all"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
