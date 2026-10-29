import { useState, useRef, useMemo } from "react";
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
  Activity,
  Info,
  Link2,
  Check,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useGetProfile, useGetJournalEntries } from "@workspace/api-client-react";
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
import {
  MENTOR_DOCTRINE_TOMES,
  type MentorDoctrineTome,
} from "../../../../contracts/academy";
import { DoctrineExamModal } from "@/components/milestones/DoctrineExamModal";
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
  buildShareableCertificateUrl,
  downloadCertificatePng,
  printCertificate,
  type CertificateData,
} from "@/components/milestones/certificateExport";
import {
  MasteryRadarChart,
  type MasteryPillarData,
} from "@/components/milestones/MasteryRadarChart";

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
      title: "Uniforme Riservata AUREUS",
      desc: "Accesso preliminare ai capi sartoriali del Grado III",
    },
    {
      title: "Supervisione Iniziati",
      desc: "Ruolo di mentore operativo per i nuovi ammessi",
    },
  ],
  4: [
    {
      title: "AUREUS B2B Rete Imprenditoriale",
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
      title: "Cerchia Interna AUREUS",
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

const DEFAULT_GRADE_MILESTONE_CONTENT: Record<
  number,
  { title: string; description: string; skills: string[]; requirementBadge: string }
> = {
  1: {
    title: "Protocollo d'Iniziazione & Custodia del Rischio",
    description:
      "Fondamenta operative del Protocollo AUREUS: allineamento al Patto dell'1%, compilazione rigorosa del Libro della Verità e validazione storica nella Forgia del Passato.",
    skills: [
      "Patto di Salvaguardia 1%",
      "Compilazione Libro della Verità",
      "Esecuzione Forgia del Passato",
      "Filtro Pre-Trade Custode della Soglia",
    ],
    requirementBadge: "Sblocco Iniziale",
  },
  2: {
    title: "Presidio d'Integrità & Disciplina Incorruttibile",
    description:
      "Consolidamento di 30 sessioni integre consecutive al 100% di conformità. Accesso al Tempio Fisico, alle Prove del Fuoco d'Élite e al Mandato di Espansione.",
    skills: [
      "30 Sessioni Consecutive Integre",
      "Protocollo Biologico Tempio Fisico",
      "Prove del Fuoco d'Élite",
      "Mandato di Espansione (20% Royalty)",
    ],
    requirementBadge: "30 Sessioni · 100%",
  },
  3: {
    title: "Maestria del Tempo & Visione Istituzionale",
    description:
      "Padronanza assoluta dell'attesa chirurgica su 60 sessioni con integrità ≥ 95%. Diritto di parola nel Concilio della Domenica e supervisione degli Iniziati.",
    skills: [
      "60 Sessioni con Integrità ≥ 95%",
      "Diritto di Parola al Concilio",
      "Negoziazione Avanzata Straight Line",
      "Mentoring Operativo Iniziati",
    ],
    requirementBadge: "60 Sessioni · ≥ 95%",
  },
  4: {
    title: "Architettura Esecutiva & Leadership di Divisione",
    description:
      "120 sessioni di disciplina sovrana e guida attiva nella Fratellanza. Accesso alla rete imprenditoriale B2B ad alto ticket e ruolo di Garante Seniore.",
    skills: [
      "120 Sessioni con Integrità ≥ 95%",
      "Rete Imprenditoriale AUREUS B2B",
      "Garante Seniore & Capitale Allocato",
      "Comando Divisioni Esecutive",
    ],
    requirementBadge: "120 Sessioni · ≥ 95%",
  },
  5: {
    title: "Sovranità Totale & Vertice della Cerchia Interna",
    description:
      "Custode supremo del Protocollo AUREUS. Diritto di nomina e veto sui Gradi I–IV, accesso incondizionato all'Archivio Arcano e governo strategico dell'Ordine.",
    skills: [
      "Seggio Permanente Cerchia Interna",
      "Sovranità Operativa Totale",
      "Diritto di Nomina, Sigillo & Veto",
      "Accesso Archivio Arcano & Riserve",
    ],
    requirementBadge: "Investitura Sovrana",
  },
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
                title="Visualizza Sigillo di Investitura"
                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 transition-colors"
              >
                <Eye className="w-3 h-3 text-primary" />
                <span>Sigillo di Grado</span>
              </button>
              <button
                type="button"
                onClick={onDownload}
                title="Scarica Certificato PNG HD"
                className="p-1 rounded-sm bg-white/5 hover:bg-white/15 text-primary border border-border transition-colors"
                aria-label="Scarica Sigillo di Investitura"
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
  const fallback = DEFAULT_GRADE_MILESTONE_CONTENT[level];
  const [title, setTitle] = useState(milestone?.title || fallback?.title || "");
  const [description, setDescription] = useState(
    milestone?.description || fallback?.description || "",
  );
  const [skillInput, setSkillInput] = useState("");
  const parsedExistingSkills = parseSkills(milestone?.skills);
  const [skills, setSkills] = useState<string[]>(
    parsedExistingSkills.length > 0 ? parsedExistingSkills : [...(fallback?.skills ?? [])],
  );
  const [badgeEmoji, setBadgeEmoji] = useState(
    milestone?.badgeEmoji ?? BADGE_EMOJIS[(level - 1) % BADGE_EMOJIS.length] ?? "I",
  );
  const [badgeColor, setBadgeColor] = useState(
    milestone?.badgeColor ?? "#C5A059",
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
      className="mt-3 border border-primary/40 rounded-lg bg-[#0d0f14] p-4 space-y-4 shadow-[0_0_20px_rgba(197,160,89,0.12)]"
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
          Configurazione Dotazioni &amp; Contenuti — {LIMEN_GRADES[level - 1]?.code ?? `GRADO ${level}`}
        </span>
        <button
          onClick={() => { if (!busyRef.current) onClose(); }}
          disabled={busy}
          aria-label={uiText("common.close")}
          className="p-1 rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {errorMessage && <p role="alert" className="text-xs font-mono text-destructive">{errorMessage}</p>}
      <fieldset disabled={busy} aria-busy={busy} className="space-y-3.5 border-0 p-0">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label htmlFor={`milestone-${level}-title`} className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Titolo del Protocollo / Modulo di Grado
            </label>
            <input
              id={`milestone-${level}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Protocollo d'Iniziazione & Custodia del Rischio"
              className="w-full h-9 px-3 rounded-sm border border-border bg-background/80 text-xs font-mono focus:outline-none focus:border-primary/60"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`milestone-${level}-description`} className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Direttiva Operativa &amp; Descrizione Dotazioni
            </label>
            <textarea
              id={`milestone-${level}-description`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Inserisci le istruzioni operative, i privilegi sbloccati e i materiali riservati a questo Grado..."
              rows={3}
              className="w-full px-3 py-2 rounded-sm border border-border bg-background/80 text-xs focus:outline-none focus:border-primary/60 resize-none leading-relaxed"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`milestone-${level}-skill`} className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Privilegi, Competenze &amp; Strumenti Concessi
            </label>
            <div className="flex gap-2">
              <input
                id={`milestone-${level}-skill`}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addSkill())
                }
                placeholder="Aggiungi privilegio o competenza (premi Invio)..."
                className="flex-1 h-9 px-3 rounded-sm border border-border bg-background/80 text-xs font-mono focus:outline-none focus:border-primary/60"
              />
              <button
                type="button"
                onClick={addSkill}
                className="h-9 px-3 rounded-sm bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Aggiungi</span>
              </button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {skills.map((s, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-sm bg-primary/10 text-primary font-mono text-[10px] font-semibold border border-primary/30"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => setSkills(skills.filter((_, j) => j !== i))}
                      className="text-primary/70 hover:text-destructive ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* File section */}
        <div className="space-y-2 pt-1 border-t border-border/50">
          <div className="flex items-center justify-between">
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Documenti, Dispense PDF, Video &amp; Allegati del Grado
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-mono text-[10px] font-bold uppercase tracking-wider bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              {uploading ? "Caricamento..." : "Carica File / PDF"}
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
                  className="flex items-center gap-2 p-2 rounded-sm border border-border bg-background/80 group"
                >
                  <div className="shrink-0">{fileIcon(f.mimeType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-semibold truncate">{f.fileName}</p>
                    <p className="text-[10px] font-mono text-muted-foreground">
                      {formatFileSize(f.fileSize)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleDownloadable(f.id, f.downloadable)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-sm font-mono text-[9px] font-bold border transition-all ${f.downloadable ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}
                  >
                    {f.downloadable ? (
                      <ToggleRight className="w-3 h-3" />
                    ) : (
                      <ToggleLeft className="w-3 h-3" />
                    )}
                    {f.downloadable ? "SCARICABILE" : "BLOCCATO"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFile(f.id)}
                    aria-label={uiText("common.delete")}
                    className="p-1.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {files.length === 0 && (
            <p className="font-mono text-[10px] text-muted-foreground/60 text-center py-2.5 border border-dashed border-border/70 rounded-sm">
              Nessun documento allegato. Usa &quot;Carica File / PDF&quot; per allegare dispense o strumenti a questo Grado.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => { if (!busyRef.current) onClose(); }}
            disabled={busy}
            className="px-3 py-1.5 rounded-sm border border-border bg-background/80 text-muted-foreground hover:text-foreground font-mono text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-sm bg-primary text-primary-foreground font-mono text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? "Salvataggio..." : "Salva Contenuti Grado"}
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
  defaultExpanded = true,
}: {
  level: number;
  currentLevel: number;
  isAdmin: boolean;
  certificates: Certificate[];
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [editing, setEditing] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const editingBusyRef = useRef(false);
  const isUnlocked = isAdmin || currentLevel >= level;
  const isCurrent = currentLevel === level;
  const hasCert = certificates.some((c) => c.level === level);
  const gradeDef = LIMEN_GRADES[level - 1];
  const levelName = gradeDef?.fullTitle ?? getLevelName(level);
  const color = BADGE_COLORS[(level - 1) % BADGE_COLORS.length];
  const fallbackContent = DEFAULT_GRADE_MILESTONE_CONTENT[level];

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
  const parsedSkills = parseSkills(milestone?.skills);
  const effectiveTitle = milestone?.title || fallbackContent?.title || "";
  const effectiveDescription = milestone?.description || fallbackContent?.description || "";
  const effectiveSkills = parsedSkills.length > 0 ? parsedSkills : (fallbackContent?.skills ?? []);

  return (
    <div
      className={`rounded-lg border transition-all duration-200 overflow-hidden ${
        isCurrent
          ? "border-primary/60 bg-primary/[0.03]"
          : isUnlocked
            ? "border-border/80 bg-[#0d0f14] hover:border-primary/40"
            : "border-border/40 bg-[#0d0f14]/60 opacity-75"
      }`}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => { if (!editingBusyRef.current) setExpanded(s => !s); }}
          disabled={editingBusy}
          className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-secondary/10 transition-colors"
        >
          {/* Badge */}
          <div className="shrink-0 relative">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden p-0.5"
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
                <Lock className="w-4 h-4 text-muted-foreground/40" />
              )}
            </div>
            {hasCert && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#C5A059] flex items-center justify-center shadow-sm">
                <Star className="w-2.5 h-2.5 text-black fill-black" />
              </div>
            )}
          </div>

          {/* Grade info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-mono text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
                style={{ color: isUnlocked ? color : "rgba(255,255,255,0.4)" }}
              >
                {gradeDef?.code ?? `GRADO ${level}`}
              </span>
              {isCurrent && (
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[8.5px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/40 whitespace-nowrap">
                  Attuale
                </span>
              )}
              {hasCert && (
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[8.5px] font-bold uppercase tracking-wider bg-[#C5A059]/20 text-[#E8C56A] border border-[#C5A059]/40 whitespace-nowrap">
                  Sigillato
                </span>
              )}
            </div>
            <p
              className={`text-xs sm:text-sm font-bold leading-snug ${isUnlocked ? "text-foreground" : "text-muted-foreground/50"}`}
            >
              {levelName}
            </p>
            {effectiveTitle && (
              <p className="font-mono text-[10px] text-primary/90 mt-0.5">
                {effectiveTitle}
              </p>
            )}
          </div>

          {/* Requirement badge instead of XP */}
          <div className="shrink-0 text-right mr-2 hidden sm:block">
            <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              Requisito d&apos;Onore
            </p>
            <p className="font-mono text-[10px] font-bold text-foreground whitespace-nowrap">
              {fallbackContent?.requirementBadge ?? gradeDef?.requirementSummary}
            </p>
          </div>

          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </button>

        {/* Admin edit button */}
        {isAdmin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (editingBusyRef.current) return;
              setExpanded(true);
              setEditing((s) => !s);
            }}
            className="mr-3.5 shrink-0 p-2 rounded-sm border border-primary/30 bg-primary/10 hover:bg-primary/25 text-primary transition-colors"
            disabled={editingBusy}
            title="Configura Contenuti & Documenti del Grado"
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
            <div className="border-t border-border/40 px-4 pb-4">
              {loadingDetail ? (
                <div className="flex justify-center py-5">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : detailError ? (
                <div role="alert" className="pt-3"><QueryErrorState onRetry={() => void refetchDetail()} /></div>
              ) : (
                <div className="pt-3.5 space-y-3.5">
                  {/* Description & Competencies */}
                  {effectiveDescription && (
                    <p className="text-xs text-foreground/90 leading-relaxed border-l-2 border-primary/50 pl-3 py-0.5">
                      {effectiveDescription}
                    </p>
                  )}

                  {effectiveSkills.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                        Dotazioni &amp; Competenze Concesse dal Grado
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {effectiveSkills.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm font-mono text-[10px] font-semibold border border-primary/25 bg-primary/[0.06] text-foreground"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {files.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                        Documentazione &amp; File Allegati ({files.length})
                      </p>
                      <div className="space-y-1.5">
                        {files.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center gap-2.5 p-2 rounded-sm border border-border/80 bg-background/80"
                          >
                            <div className="shrink-0">
                              {fileIcon(f.mimeType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono font-semibold truncate">
                                {f.fileName}
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground">
                                {formatFileSize(f.fileSize)}
                              </p>
                            </div>
                            {f.downloadable ? (
                              <a
                                href={f.fileUrl}
                                download={f.fileName}
                                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-sm font-mono text-[9.5px] font-bold uppercase tracking-wider bg-primary/15 hover:bg-primary/25 border border-primary/40 text-primary transition-colors"
                                title="Scarica Documento"
                              >
                                <Download className="w-3 h-3" />
                                <span>Scarica</span>
                              </a>
                            ) : (
                              <div
                                className="shrink-0 p-1.5 rounded-sm bg-secondary/30 text-muted-foreground/30"
                                title="Download riservato"
                              >
                                <Lock className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
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
                      type="button"
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-sm border border-dashed border-primary/40 bg-primary/[0.04] hover:bg-primary/10 text-primary font-mono text-[10px] font-bold uppercase tracking-wider transition-colors w-full justify-center"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Personalizza Contenuti, Competenze o Carica File (PDF / Video)</span>
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
    serverIntegrity && serverIntegrity.currentGrade
      ? serverIntegrity
      : computeLimenIntegritySnapshot({
          legacyLevel: currentLevel,
          consecutiveIntegralSessions: profile?.streak ?? 0,
          isAdmin,
        });

  const { data: journalEntries } = useGetJournalEntries();
  const calmTradesCount = useMemo(() => {
    if (!journalEntries || !Array.isArray(journalEntries)) return 0;
    return journalEntries.filter((e) => {
      const tags = (e.tags ?? "").toLowerCase();
      const content = (e.content ?? "").toLowerCase();
      return (
        tags.includes("respiro") ||
        tags.includes("calma") ||
        content.includes("respiro tattico")
      );
    }).length;
  }, [journalEntries]);

  const [selectedCert, setSelectedCert] = useState<CertificateData | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [isDocumentsModalOpen, setIsDocumentsModalOpen] = useState(false);
  const [inspectingCharacter, setInspectingCharacter] = useState<GradeCharacterData | null>(null);
  const [inspectingPerksGrade, setInspectingPerksGrade] = useState<LimenGradeDefinition | null>(null);
  const [showRadarModal, setShowRadarModal] = useState(false);
  const [copiedCertLink, setCopiedCertLink] = useState(false);

  // Stato Esami di Padronanza Dottrinale
  const [activeDoctrineTome, setActiveDoctrineTome] = useState<MentorDoctrineTome | null>(null);
  const [passedDoctrineExams, setPassedDoctrineExams] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("aureus_passed_doctrine_exams");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handlePassDoctrineExam = (tomeId: string) => {
    setPassedDoctrineExams((prev) => {
      if (prev.includes(tomeId)) return prev;
      const updated = [...prev, tomeId];
      try {
        localStorage.setItem("aureus_passed_doctrine_exams", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    toast.success("Sigillo di Padronanza Dottrinale Convalidato!", {
      description: "Il traguardo è stato registrato ed integrato nel Dossier dell'Operatore.",
    });
  };

  const computedPillars = useMemo<MasteryPillarData[]>(() => {
    const baseIntegrity = integrity.integrityIndex ?? 100;
    const violationsPenalty = (integrity.recentViolationsCount ?? 0) * 15;
    const riskScore = Math.max(30, Math.min(100, 100 - violationsPenalty));
    const patienceScore = Math.max(40, Math.min(100, baseIntegrity - (integrity.driftDetected ? 20 : 0)));
    const techniqueScore = Math.max(50, Math.min(100, Math.round((baseIntegrity * 0.9) + (integrity.currentGrade.grade * 2))));
    const composureScore = Math.max(
      40,
      Math.min(
        100,
        Math.min(100, 70 + Math.min(20, calmTradesCount * 2) + (integrity.consecutiveIntegralSessions * 2))
      )
    );
    const truthScore = Math.max(30, Math.min(100, (integrity.daysSinceLastTruthEntry ?? 0) === 0 ? 98 : Math.max(50, 100 - (integrity.daysSinceLastTruthEntry ?? 0) * 10)));

    return [
      {
        id: "patience",
        name: "Pazienza nell'Attesa",
        score: patienceScore,
        description: "Attesa della finestra temporale e del contesto HTF conforme",
      },
      {
        id: "risk",
        name: "Rispetto del Rischio",
        score: riskScore,
        description: "Presenza inderogabile dello stop loss e rischio unitario ≤ 1%",
      },
      {
        id: "technique",
        name: "Precisione Tecnica",
        score: techniqueScore,
        description: "Allineamento rigoroso alle 4 Fasi del Custode della Soglia",
      },
      {
        id: "composure",
        name: "Fermezza Emotiva",
        score: composureScore,
        description: "Assenza di overtrading, controllo del drawdown e respiro tattico",
      },
      {
        id: "integrity",
        name: "Integrità del Registro",
        score: truthScore,
        description: "Compilazione sistematica del Libro della Verità con schematica",
      },
    ];
  }, [integrity]);

  const openCertModal = (cert: CertificateData) => {
    setSelectedCert(cert);
    setIsCertModalOpen(true);
  };

  const closeCertModal = () => {
    setIsCertModalOpen(false);
    setSelectedCert(null);
  };

  const buildCurrentGradeCert = (): CertificateData => {
    const currentG = integrity.currentGrade;
    const existingCert = certificates.find((c) => c.level === currentG.grade);
    const effectiveUserName = (profile?.name && profile.name.trim()) || "Operatore";
    return existingCert
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
  };

  const handleCopyShareableCertLink = () => {
    const targetCert = buildCurrentGradeCert();
    const url = buildShareableCertificateUrl(targetCert);
    navigator.clipboard.writeText(url);
    setCopiedCertLink(true);
    toast.success("Link condivisibile del Certificato copiato negli appunti!");
    setTimeout(() => setCopiedCertLink(false), 2500);
  };

  return (
    <PageLayout quiet>
      <div className="flex flex-col lg:h-[calc(100vh-100px)] lg:min-h-0 lg:overflow-hidden pt-1">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-3.5 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
          {/* ─── PANNELLO SINISTRO: RANGO ATTUALE, INTEGRITÀ & SIGILLI ─── */}
          <aside className="space-y-2.5 flex flex-col lg:h-full lg:overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-primary/20">
            {/* Operator Sovereign Cockpit: Current Grade, Integrity & Telemetry Panel */}
            <div className="limen-panel-surface p-3 space-y-2.5 border border-border/80">
              {/* Header with Medallion & Title (No overlapping badge, full-width subtitle) */}
              <div className="flex items-center gap-3 border-b border-border pb-2.5">
                <div className="relative shrink-0">
                  <LimenMedallion grade={integrity.currentGrade.grade} size={50} glow animate={false} />
                </div>
                <div className="min-w-0 flex-1 w-full">
                  <p className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em] text-primary whitespace-nowrap">
                    Rango Attuale dell&apos;Operatore
                  </p>
                  <h2
                    className="text-sm sm:text-base font-bold uppercase tracking-[0.06em] text-foreground leading-snug whitespace-nowrap"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {integrity.currentGrade.code}
                  </h2>
                  <p className="w-full text-[10.5px] text-muted-foreground leading-snug mt-0.5">
                    {integrity.currentGrade.subtitle}
                  </p>
                </div>
              </div>

              {/* Drift Warning Alert Banner if drift is active */}
              {integrity.driftDetected && (
                <div
                  role="alert"
                  className="border border-destructive bg-destructive/15 p-2 rounded-sm text-foreground"
                >
                  <div className="flex items-start gap-2">
                    <SigilIcon variant="drift-warning" size={15} className="mt-0.5 text-destructive shrink-0" />
                    <div>
                      <p className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-destructive">
                        {DRIFT_ALERT_TITLE}
                      </p>
                      <p className="mt-0.5 text-[9.5px] leading-tight text-foreground/85">
                        {integrity.driftAlertMessage ?? DRIFT_ALERT_DESCRIPTION}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 4 Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 gap-1.5 text-center">
                <div className="border border-border/80 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">
                    Indice di Integrità
                  </p>
                  <p className="mt-0.5 font-mono text-base font-bold text-primary whitespace-nowrap">
                    {integrity.integrityIndex}%
                  </p>
                </div>
                <div className="border border-border/80 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">
                    Sessioni Integre
                  </p>
                  <p className="mt-0.5 font-mono text-base font-bold text-foreground whitespace-nowrap">
                    {integrity.consecutiveIntegralSessions}
                    {integrity.nextGrade && !integrity.nextGrade.adminOnly
                      ? ` / ${integrity.nextGrade.requiredConsecutiveSessions}`
                      : ""}
                  </p>
                </div>
                <div className="border border-border/80 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">
                    Violazioni
                  </p>
                  <p className={`mt-0.5 font-mono text-base font-bold whitespace-nowrap ${integrity.recentViolationsCount > 0 ? "text-destructive" : "text-emerald-400"}`}>
                    {integrity.recentViolationsCount > 0 ? `${integrity.recentViolationsCount}` : "0"}
                  </p>
                </div>
                <div className="border border-border/80 bg-background/80 p-1.5 rounded-sm">
                  <p className="font-mono text-[7.5px] uppercase tracking-wider text-muted-foreground">
                    Ultimo Diario
                  </p>
                  <p className={`mt-0.5 font-mono text-base font-bold whitespace-nowrap ${(integrity.daysSinceLastTruthEntry ?? 0) > 5 ? "text-amber-400" : "text-primary"}`}>
                    {integrity.daysSinceLastTruthEntry === 0 ? "Oggi" : `${integrity.daysSinceLastTruthEntry ?? 0}g`}
                  </p>
                </div>
              </div>

              {/* Monitoraggio Ascesa / Stato Supremo */}
              <div className="border border-primary/20 bg-primary/[0.03] p-2 rounded-sm space-y-1">
                <div className="flex items-center justify-between font-mono text-[8.5px]">
                  <span className="text-muted-foreground uppercase tracking-wider truncate pr-1">
                    {integrity.nextGrade ? `Ascesa verso ${integrity.nextGrade.code}` : "Stato Supremo"}
                  </span>
                  <span className="text-primary font-bold shrink-0 whitespace-nowrap">
                    {integrity.progressToNextGradePct}%
                  </span>
                </div>
                <p className="font-mono text-[9px] text-foreground font-semibold leading-tight truncate">
                  {integrity.nextGrade ? integrity.nextGrade.title : "Cerchia Interna AUREUS"}
                </p>
                <div className="h-1 bg-background border border-border overflow-hidden rounded-full mt-1">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${integrity.progressToNextGradePct}%` }}
                  />
                </div>
              </div>

              {/* I Tre Vincoli di Salvaguardia */}
              <div className="space-y-0.5 pt-1 border-t border-border/50 font-mono text-[8px]">
                <div className="flex items-start gap-1.5 text-muted-foreground leading-tight">
                  <span className="text-primary font-bold shrink-0">I.</span>
                  <span><strong className="text-foreground/90 font-semibold">Patto 1%:</strong> Max 1% rischio per trade.</span>
                </div>
                <div className="flex items-start gap-1.5 text-muted-foreground leading-tight">
                  <span className="text-primary font-bold shrink-0">II.</span>
                  <span><strong className="text-foreground/90 font-semibold">Diario Verità:</strong> Compilazione obbligatoria.</span>
                </div>
                <div className="flex items-start gap-1.5 text-muted-foreground leading-tight">
                  <span className="text-primary font-bold shrink-0">III.</span>
                  <span><strong className="text-foreground/90 font-semibold">Retrocessione:</strong> Caduta di grado se violi.</span>
                </div>
              </div>

              {/* Direct Download/Print Certificate for Current Grade */}
              <button
                type="button"
                onClick={() => openCertModal(buildCurrentGradeCert())}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-sm font-mono text-[9.5px] font-bold uppercase tracking-wider border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-all shadow-sm whitespace-nowrap"
              >
                <Award className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Certificato &amp; Sigillo ({integrity.currentGrade.code})</span>
              </button>

              {/* Dossier Modals: 5 Pilastri & Condividi Link Certificato */}
              <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowRadarModal(true)}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-sm font-mono text-[8.5px] font-bold uppercase tracking-wider border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary hover:text-foreground transition-all shadow-sm cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3 text-primary shrink-0" />
                  <span>5 Pilastri ↗</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareableCertLink}
                  className="flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-sm font-mono text-[8.5px] font-bold uppercase tracking-wider border border-[#C5A059]/40 bg-gradient-to-r from-[#C5A059]/15 to-[#E8C56A]/15 hover:from-[#C5A059]/25 hover:to-[#E8C56A]/25 text-[#E8C56A] hover:text-white transition-all shadow-[0_0_10px_rgba(197,160,89,0.15)] cursor-pointer whitespace-nowrap"
                  title="Copia il link pubblico condivisibile del tuo Certificato Ufficiale"
                >
                  {copiedCertLink ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400">Link Copiato!</span>
                    </>
                  ) : (
                    <>
                      <Link2 className="w-3 h-3 text-[#E8C56A] shrink-0" />
                      <span>Condividi Link 🔗</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sigillo di Investitura (3D Card Showcase) */}
            <div className="limen-panel-surface p-3 space-y-2 border border-border/80 flex flex-col justify-between flex-1 min-h-0">
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
                <div className="flex justify-center py-0.5 my-auto">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5 flex-1 min-h-0 overflow-y-auto">
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
                          animate={isCurrent}
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

                      {/* Tasto Prova Dottrinale del Grado (Tomi del Mentore) */}
                      {gradeDef.associatedTomeId && (() => {
                        const tome = MENTOR_DOCTRINE_TOMES.find(t => t.id === gradeDef.associatedTomeId);
                        const isDocPassed = passedDoctrineExams.includes(gradeDef.associatedTomeId);
                        if (!tome) return null;

                        return (
                          <button
                            type="button"
                            onClick={() => setActiveDoctrineTome(tome)}
                            className={`w-full h-7 flex items-center justify-between px-2.5 my-0.5 rounded-sm border transition-all group shrink-0 shadow-sm ${
                              isDocPassed
                                ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40"
                                : "border-[#C5A059]/40 bg-[#C5A059]/10 text-[#E8C56A] hover:bg-[#C5A059]/20"
                            }`}
                          >
                            <span className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
                              {isDocPassed ? (
                                <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                              ) : (
                                <BookOpen className="w-3 h-3 text-[#C5A059] shrink-0 group-hover:scale-110 transition-transform" />
                              )}
                              <span>{tome.roman} {isDocPassed ? "Doc. OK" : "Dottrina"}</span>
                            </span>
                            <span className="font-mono text-[7.5px] font-bold uppercase tracking-wider whitespace-nowrap">
                              {isDocPassed ? "Convalidato ✓" : "Esame ↗"}
                            </span>
                          </button>
                        );
                      })()}

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

      {/* Modal Dossier: Il Pentagramma della Maestria AUREUS */}
      {showRadarModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setShowRadarModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg flex flex-col rounded-2xl border border-[#C5A059]/40 bg-[#07080b] shadow-[0_0_50px_rgba(197,160,89,0.2)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#0d0f14]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E8C56A]" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#E8C56A]">
                  Dossier dell'Operatore · I 5 Pilastri
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRadarModal(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <MasteryRadarChart
                pillars={computedPillars}
                overallScore={integrity.integrityIndex}
              />
            </div>
          </div>
        </div>
      )}

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
            className="relative w-full max-w-2xl flex flex-col rounded-lg border border-primary/50 bg-[#0E0F14] text-foreground shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-[#14151C]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-foreground">
                    {inspectingPerksGrade.code} // DOTAZIONI, CONTENUTI &amp; PRIVILEGI
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

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto max-h-[80vh]">
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
                  Privilegi Istituzionali del Rango
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

              {/* Contenuti Documentali, Competenze & File Personalizzabili per questo Grado */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-primary px-0.5">
                  Contenuti Operativi, Dispense &amp; Documenti Allegati
                </p>
                <LevelRow
                  level={inspectingPerksGrade.grade}
                  currentLevel={integrity.currentGrade.grade}
                  isAdmin={isAdmin}
                  certificates={certificates}
                  defaultExpanded={true}
                />
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

      {/* ─── MODALE PROVA DI PADRONANZA DOTTRINALE ─── */}
      <DoctrineExamModal
        isOpen={Boolean(activeDoctrineTome)}
        onClose={() => setActiveDoctrineTome(null)}
        tome={activeDoctrineTome}
        onPassExam={handlePassDoctrineExam}
        isAlreadyPassed={activeDoctrineTome ? passedDoctrineExams.includes(activeDoctrineTome.id) : false}
      />
    </PageLayout>
  );
}
