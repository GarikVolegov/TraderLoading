import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  CheckCircle2,
  Award,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Sparkles,
  Printer,
  RotateCcw,
  FlaskConical,
  GraduationCap,
  Scale,
  ArrowRight,
  Check,
  Video,
  FileText,
  HelpCircle,
  ExternalLink,
  Crosshair,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  AUREUS_RESEARCH_THESES,
  MENTOR_MASTER_MANUALS,
  MENTOR_BACKTEST_AUDIT_CRITERIA,
  MENTOR_VIDEO_MASTER_LESSON,
  ACADEMIC_DISCLAIMER_TEXT,
  type CurriculumThesis,
  type MentorMasterManual,
} from "../../../../../contracts/academy";

export interface ThesisScoreRecord {
  score: number; // 0..100
  passed: boolean;
  completedAt: string;
}

export interface MentorDoctrineViewerProps {
  onOpenExam?: (tome: any) => void;
  passedExams?: string[];
}

type MainTab = "curriculum" | "manuali" | "audit" | "video";
type ProcessStep = 1 | 2 | 3; // 1: Modello & Intuizione, 2: Protocollo Forgia, 3: Quiz a Punteggio

export function MentorDoctrineViewer({}: MentorDoctrineViewerProps) {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("curriculum");

  // Tesi attiva
  const [selectedThesisId, setSelectedThesisId] = useState<string>(
    AUREUS_RESEARCH_THESES[0]?.id ?? "tesi-1-mindset-statistico"
  );
  const activeThesis =
    AUREUS_RESEARCH_THESES.find((t) => t.id === selectedThesisId) ??
    AUREUS_RESEARCH_THESES[0]!;

  // Step di processo della Tesi attiva (1, 2 o 3)
  const [currentStep, setCurrentStep] = useState<ProcessStep>(1);

  // Manuale attivo per la sezione trattati
  const [selectedManualId, setSelectedManualId] = useState<string>(
    MENTOR_MASTER_MANUALS[0]?.id ?? "manuale-guida-integrata"
  );
  const activeManual =
    MENTOR_MASTER_MANUALS.find((m) => m.id === selectedManualId) ??
    MENTOR_MASTER_MANUALS[0]!;

  // Tracciamento Punteggi Esami (0..100) salvati nello storage locale
  const [thesisScores, setThesisScores] = useState<Record<string, ThesisScoreRecord>>(() => {
    try {
      const stored = localStorage.getItem("aureus_thesis_exam_scores");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Stato Quiz per la singola domanda attiva (0..4)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState<boolean>(false);

  // Reset dello step e delle risposte quando si cambia tesi
  useEffect(() => {
    setCurrentStep(1);
    setCurrentQuestionIndex(0);
    setQuizAnswers({});
    setIsQuizSubmitted(false);
  }, [selectedThesisId]);

  const handleSelectOption = (optionIndex: number) => {
    if (isQuizSubmitted) return;
    setQuizAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionIndex,
    }));
  };

  const calculateScore = () => {
    let score = 0;
    activeThesis.quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correctIndex) {
        score += q.points;
      }
    });
    return score;
  };

  const handleSubmitQuiz = () => {
    const finalScore = calculateScore();
    const passed = finalScore >= 80;

    const newRecord: ThesisScoreRecord = {
      score: finalScore,
      passed,
      completedAt: new Date().toISOString(),
    };

    setThesisScores((prev) => {
      const updated = { ...prev, [activeThesis.id]: newRecord };
      try {
        localStorage.setItem("aureus_thesis_exam_scores", JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });

    setIsQuizSubmitted(true);
  };

  const handleResetQuiz = () => {
    setQuizAnswers({});
    setCurrentQuestionIndex(0);
    setIsQuizSubmitted(false);
  };

  const handleNextThesis = () => {
    const currentIndex = AUREUS_RESEARCH_THESES.findIndex((t) => t.id === activeThesis.id);
    if (currentIndex >= 0 && currentIndex < AUREUS_RESEARCH_THESES.length - 1) {
      const nextThesis = AUREUS_RESEARCH_THESES[currentIndex + 1]!;
      setSelectedThesisId(nextThesis.id);
    }
  };

  // Metriche Accademiche Globali
  const academicMetrics = useMemo(() => {
    const totalTheses = AUREUS_RESEARCH_THESES.length;
    let validatedCount = 0;
    let sumScores = 0;
    let completedCount = 0;

    AUREUS_RESEARCH_THESES.forEach((thesis) => {
      const record = thesisScores[thesis.id];
      if (record) {
        completedCount += 1;
        sumScores += record.score;
        if (record.passed) {
          validatedCount += 1;
        }
      }
    });

    const averageScore = completedCount > 0 ? Math.round(sumScores / completedCount) : 0;
    const globalMasteryPct = Math.round((validatedCount / totalTheses) * 100);

    return {
      totalTheses,
      validatedCount,
      averageScore,
      globalMasteryPct,
    };
  }, [thesisScores]);

  // Stato Audit di Backtest
  const [auditChecked, setAuditChecked] = useState<Record<string, boolean>>({
    "audit-macro": true,
    "audit-scompensi": true,
    "audit-wyckoff-ciclo": true,
    "audit-wyckoff-schema": false,
    "audit-volume-profile": true,
    "audit-sessione-asiatica": false,
    "audit-inefficienza": true,
  });
  const [copiedAudit, setCopiedAudit] = useState(false);

  const toggleAuditCriterion = (id: string) => {
    setAuditChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const auditConvergenceScore = useMemo(() => {
    let total = 0;
    let earned = 0;
    MENTOR_BACKTEST_AUDIT_CRITERIA.forEach((crit) => {
      total += crit.probabilityWeight;
      if (auditChecked[crit.id]) {
        earned += crit.probabilityWeight;
      }
    });
    return Math.round((earned / total) * 100);
  }, [auditChecked]);

  const handleCopyAuditLog = () => {
    const lines = [
      "AUREUS PROTOCOL // PROTOCOLLO DI AUDIT STATISTICO PER IL BACKTEST",
      `Data Audit: ${new Date().toLocaleDateString("it-IT")} ore ${new Date().toLocaleTimeString("it-IT")}`,
      `Indice di Convergenza delle Variabili: ${auditConvergenceScore}%`,
      `Idoneità al Campionamento Storico: ${auditConvergenceScore >= 70 ? "CAMPIONE IDONEO AL TEST NELLA FORGIA (≥ 70%)" : "CAMPIONE AMBIGUO / DISCORDANTE (< 70%)"}`,
      "",
      "VARIABILI TESTATE:",
      ...MENTOR_BACKTEST_AUDIT_CRITERIA.map(
        (c) =>
          `[${auditChecked[c.id] ? "X" : " "}] ${c.variableName} (Peso ${c.probabilityWeight}%) -> ${c.forgeTestProtocol}`
      ),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 2000);
  };

  const currentQ = activeThesis.quizQuestions[currentQuestionIndex];
  const isCurrentQAnswered = quizAnswers[currentQuestionIndex] !== undefined;
  const isAllAnswered = Object.keys(quizAnswers).length === activeThesis.quizQuestions.length;

  return (
    <div className="w-full space-y-6">
      {/* ─── BANNER DISCLAIMER ACCADEMICO (NITIDO & LEGGIBILE) ─── */}
      <div className="rounded-xl border border-[#C5A059]/40 bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] p-4 text-sm flex items-start gap-3.5 shadow-lg">
        <Scale className="w-5 h-5 text-[#C5A059] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#E8C56A] block">
            Finalità Accademica &amp; Ricerca Quantitativa // Nessun Consiglio Finanziario
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            {ACADEMIC_DISCLAIMER_TEXT}
          </p>
        </div>
      </div>

      {/* ─── HEADER MAESTOSO & TELEMETRIA KPI SPAZIOSA ─── */}
      <div className="relative overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-gradient-to-b from-[#141622] via-[#0d0f14] to-[#07080b] p-6 md:p-8 shadow-2xl">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-[#C5A059]/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C5A059]/40 bg-[#C5A059]/10 text-[#E8C56A] font-mono text-xs font-bold tracking-widest">
              <GraduationCap className="w-4 h-4 text-[#E8C56A]" />
              Laboratorio Didattico del Mentore · 7 Tesi da Testare
            </div>
            <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-100 tracking-wide">
              Il Curriculum Accademico della Dottrina
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Un percorso scientifico sequenziale e verificabile: formulazione dell'ipotesi, protocollo di simulazione nella Forgia del Passato e verifica di comprensione a punteggio numerico.
            </p>
          </div>

          {/* Console Telemetrica Spaziosa */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="rounded-xl border border-[#C5A059]/35 bg-[#0d0f14] p-4 text-center min-w-[120px] shadow-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Padronanza Globale
              </span>
              <span className="font-mono text-2xl font-bold text-[#E8C56A]">
                {academicMetrics.globalMasteryPct}%
              </span>
            </div>

            <div className="rounded-xl border border-[#C5A059]/35 bg-[#0d0f14] p-4 text-center min-w-[120px] shadow-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Tesi Convalidate
              </span>
              <span className="font-mono text-2xl font-bold text-emerald-400">
                {academicMetrics.validatedCount} / {academicMetrics.totalTheses}
              </span>
            </div>

            <div className="rounded-xl border border-[#C5A059]/35 bg-[#0d0f14] p-4 text-center min-w-[120px] shadow-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                Media Esami
              </span>
              <span className="font-mono text-2xl font-bold text-slate-100">
                {academicMetrics.averageScore} <span className="text-xs text-[#C5A059]">pt</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── NAVIGAZIONE A TAB PRINCIPALI ─── */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-[#C5A059]/20 pb-3">
        <button
          onClick={() => setActiveMainTab("curriculum")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all ${
            activeMainTab === "curriculum"
              ? "bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/25 scale-[1.02]"
              : "border border-[#C5A059]/20 bg-[#0d0f14] text-slate-300 hover:text-[#E8C56A] hover:border-[#C5A059]/40"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>01 · Le 7 Tesi da Testare ({academicMetrics.validatedCount}/{academicMetrics.totalTheses})</span>
        </button>

        <button
          onClick={() => setActiveMainTab("manuali")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all ${
            activeMainTab === "manuali"
              ? "bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/25 scale-[1.02]"
              : "border border-[#C5A059]/20 bg-[#0d0f14] text-slate-300 hover:text-[#E8C56A] hover:border-[#C5A059]/40"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>02 · Trattati Teorici ({MENTOR_MASTER_MANUALS.length})</span>
        </button>

        <button
          onClick={() => setActiveMainTab("audit")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all ${
            activeMainTab === "audit"
              ? "bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/25 scale-[1.02]"
              : "border border-[#C5A059]/20 bg-[#0d0f14] text-slate-300 hover:text-[#E8C56A] hover:border-[#C5A059]/40"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>03 · Scheda di Audit Backtest ({auditConvergenceScore}%)</span>
        </button>

        <button
          onClick={() => setActiveMainTab("video")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-xs font-bold tracking-wider uppercase transition-all ${
            activeMainTab === "video"
              ? "bg-[#C5A059] text-black shadow-lg shadow-[#C5A059]/25 scale-[1.02]"
              : "border border-[#C5A059]/20 bg-[#0d0f14] text-slate-300 hover:text-[#E8C56A] hover:border-[#C5A059]/40"
          }`}
        >
          <Video className="w-4 h-4" />
          <span>04 · Video di Laboratorio</span>
        </button>
      </div>

      {/* ─── TAB 1: CURRICULUM GUIDATO A STEP DI PROCESSO ─── */}
      {activeMainTab === "curriculum" && (
        <div className="space-y-6">
          {/* STEPPER ORIZZONTALE DELLE 7 TESI */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {AUREUS_RESEARCH_THESES.map((thesis) => {
              const isSelected = thesis.id === activeThesis.id;
              const record = thesisScores[thesis.id];
              const isPassed = record?.passed ?? false;

              return (
                <button
                  key={thesis.id}
                  onClick={() => setSelectedThesisId(thesis.id)}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between min-h-[105px] ${
                    isSelected
                      ? "bg-[#11131c] border-[#C5A059] shadow-xl shadow-[#C5A059]/20 ring-1 ring-[#C5A059]/50"
                      : isPassed
                      ? "bg-[#0d0f14] border-emerald-500/50 hover:border-emerald-500"
                      : "bg-[#0d0f14]/80 border-[#C5A059]/25 hover:border-[#C5A059]/50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-mono text-xs font-bold text-[#E8C56A] uppercase tracking-wider">
                      {thesis.roman}
                    </span>
                    {isPassed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-mono text-[10px] font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/40">
                        <CheckCircle2 className="w-3 h-3" />
                        {record.score} pt
                      </span>
                    ) : record ? (
                      <span className="text-rose-400 font-mono text-[10px] font-bold">
                        {record.score} pt
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-slate-400">Da Testare</span>
                    )}
                  </div>

                  <div className="text-xs font-serif font-bold text-slate-100 line-clamp-1 leading-snug">
                    {thesis.title.split("&")[0]?.trim()}
                  </div>

                  <div className="mt-2 flex items-center justify-between w-full pt-1.5 border-t border-[#C5A059]/15 text-[10px] font-mono text-slate-400">
                    <span className="whitespace-nowrap">{thesis.associatedGradeTitle.split(" ")[0]}</span>
                    <span>{thesis.timeframeFocus.split(" ")[0]}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ─── WORKFLOW A 3 STEP DELLA TESI ATTIVA ─── */}
          <div className="rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14] overflow-hidden shadow-2xl">
            {/* BARRA SUPERIORE DEI 3 STEP DI PROCESSO */}
            <div className="border-b border-[#C5A059]/25 bg-[#11131c] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35">
                  {activeThesis.roman}
                </span>
                <div>
                  <h3 className="text-lg font-serif font-bold text-slate-100">
                    {activeThesis.title}
                  </h3>
                  <p className="text-xs text-slate-400">{activeThesis.subtitle}</p>
                </div>
              </div>

              {/* Bottoni Step 1 - 2 - 3 */}
              <div className="flex items-center gap-1.5 bg-[#07080b] p-1.5 rounded-xl border border-[#C5A059]/30">
                <button
                  onClick={() => setCurrentStep(1)}
                  className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
                    currentStep === 1
                      ? "bg-[#C5A059] text-black shadow-md"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <span>1. Modello</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

                <button
                  onClick={() => setCurrentStep(2)}
                  className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
                    currentStep === 2
                      ? "bg-[#C5A059] text-black shadow-md"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <span>2. Protocollo Forgia</span>
                </button>

                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />

                <button
                  onClick={() => setCurrentStep(3)}
                  className={`px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${
                    currentStep === 3
                      ? "bg-[#C5A059] text-black shadow-md"
                      : "text-slate-400 hover:text-slate-100"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>3. Quiz a Punteggio</span>
                </button>
              </div>
            </div>

            {/* CONTENUTO DELLO STEP SELEZIONATO CON ANIMAZIONE FLUIDA */}
            <div className="p-6 md:p-8">
              <AnimatePresence mode="wait">
                {/* ─── STEP 1: L'INTUIZIONE & IL MODELLO TEORICO ─── */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
                  >
                    {/* Colonna Sinistra (7 col): Definizione e Pillole Chiave */}
                    <div className="lg:col-span-7 space-y-6">
                      {/* Box Filo Conduttore */}
                      <div className="p-5 rounded-xl border border-[#C5A059]/25 bg-[#11131c] space-y-2">
                        <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] block">
                          Il Filo Conduttore nel Percorso:
                        </span>
                        <p className="text-sm text-slate-200 leading-relaxed font-sans">
                          {activeThesis.logicalThread}
                        </p>
                      </div>

                      {/* 3 Pillole Chiave Senza Muri di Testo */}
                      <div className="space-y-3">
                        <span className="font-mono text-xs uppercase font-bold tracking-widest text-slate-400 block">
                          I 3 Punti Cardinali dell'Ipotesi:
                        </span>

                        <div className="grid grid-cols-1 gap-3">
                          <div className="p-4 rounded-xl border border-[#C5A059]/30 bg-[#11131c]/80 flex items-start gap-3.5">
                            <div className="p-2 rounded-lg bg-[#C5A059]/15 text-[#E8C56A] shrink-0 mt-0.5">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-mono font-bold uppercase text-[#E8C56A]">
                                1. Il Modello Teorico
                              </div>
                              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                                {activeThesis.theoreticalCore}
                              </p>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border border-[#C5A059]/30 bg-[#11131c]/80 flex items-start gap-3.5">
                            <div className="p-2 rounded-lg bg-[#C5A059]/15 text-[#E8C56A] shrink-0 mt-0.5">
                              <Crosshair className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-mono font-bold uppercase text-[#E8C56A]">
                                2. La Coordinata di Studio
                              </div>
                              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                                Timeframe di riferimento: <span className="font-mono text-[#E8C56A] font-bold">{activeThesis.timeframeFocus}</span>. Campione minimo di laboratorio suggerito: <span className="font-mono text-[#E8C56A] font-bold">{activeThesis.suggestedSampleSize}</span>.
                              </p>
                            </div>
                          </div>

                          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/15 flex items-start gap-3.5">
                            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-300 shrink-0 mt-0.5">
                              <ShieldAlert className="w-4 h-4" />
                            </div>
                            <div className="space-y-1">
                              <div className="text-xs font-mono font-bold uppercase text-rose-300">
                                3. Principio di Invalidazione
                              </div>
                              <p className="text-sm text-slate-200 leading-relaxed font-sans">
                                L'ipotesi si considera confutata ogni qualvolta l'evento non si manifesti entro i limiti di deviazione previsti, senza forzare interpretazioni col senno di poi.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Button
                          size="lg"
                          onClick={() => setCurrentStep(2)}
                          className="bg-[#C5A059] text-black hover:bg-[#E8C56A] font-mono text-xs font-bold uppercase tracking-wider px-6 py-5 shadow-lg shadow-[#C5A059]/20"
                        >
                          Avanza al Protocollo di Test nella Forgia
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>

                    {/* Colonna Destra (5 col): Schema Grafico Ingrandito */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="rounded-xl border border-[#C5A059]/35 bg-[#11131c] p-5 space-y-3 shadow-xl">
                        <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5">
                          <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#C5A059]" />
                            Mappa Concettuale Visiva
                          </span>
                          <span className="font-mono text-xs text-slate-400">Modello 1</span>
                        </div>

                        {/* Rendering Schema Ampio */}
                        <div className="rounded-xl border border-[#C5A059]/30 bg-[#07080b] p-6 flex flex-col items-center justify-center min-h-[220px]">
                          {activeThesis.diagramType === "mindset_bias" && (
                            <div className="w-full text-center space-y-4 py-2">
                              <span className="font-mono text-sm text-[#E8C56A] font-bold uppercase block">
                                Il Ciclo del Metodo Scientifico
                              </span>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="p-3 rounded-lg border border-[#C5A059]/30 bg-[#11131c] font-mono text-xs text-slate-200">
                                  1. Ipotesi Cieca
                                </div>
                                <div className="p-3 rounded-lg border border-[#C5A059]/30 bg-[#11131c] font-mono text-xs text-slate-200">
                                  2. Replay 50 Test
                                </div>
                                <div className="p-3 rounded-lg border border-emerald-500/50 bg-emerald-950/40 font-mono text-xs text-emerald-300">
                                  3. Misura MFE
                                </div>
                              </div>
                              <p className="text-xs text-slate-400">
                                Nessun trade con denaro: isolamento rigoroso delle variabili
                              </p>
                            </div>
                          )}

                          {activeThesis.diagramType === "soglie_50" && (
                            <div className="w-full max-w-sm space-y-3 text-center py-2">
                              <span className="font-mono text-xs text-slate-400 uppercase">
                                Fair Value Gap (M15)
                              </span>
                              <div className="h-28 border-2 border-dashed border-[#C5A059]/50 bg-[#C5A059]/10 rounded-xl flex flex-col justify-between p-3">
                                <span className="font-mono text-xs text-slate-400 text-left">Ombra Candela 1</span>
                                <div className="w-full border-t-2 border-[#C5A059] flex items-center justify-between px-2">
                                  <span className="font-mono text-xs font-bold text-[#E8C56A] bg-[#07080b] px-2 -mt-2.5">
                                    LINEA 50% MEDIANA
                                  </span>
                                  <span className="font-mono text-xs font-bold text-emerald-400 bg-[#07080b] px-2 -mt-2.5">
                                    .00 / .50 Round
                                  </span>
                                </div>
                                <span className="font-mono text-xs text-slate-400 text-left">Ombra Candela 3</span>
                              </div>
                            </div>
                          )}

                          {activeThesis.diagramType === "volume_profile_shapes" && (
                            <div className="w-full grid grid-cols-3 gap-3 text-center py-2">
                              <div className="border border-[#C5A059]/30 bg-[#11131c] rounded-xl p-3">
                                <span className="font-mono text-xs font-bold text-[#E8C56A]">P-Shape</span>
                                <div className="h-20 w-8 mx-auto my-2 flex flex-col items-center">
                                  <div className="w-8 h-10 bg-emerald-500/30 border border-emerald-400 rounded-t" />
                                  <div className="w-2.5 h-10 bg-slate-600/30" />
                                </div>
                                <span className="text-[10px] font-mono text-emerald-400">POC Alto</span>
                              </div>

                              <div className="border border-[#C5A059]/30 bg-[#11131c] rounded-xl p-3">
                                <span className="font-mono text-xs font-bold text-[#E8C56A]">D-Shape</span>
                                <div className="h-20 w-8 mx-auto my-2 flex flex-col items-center justify-center">
                                  <div className="w-4 h-4 bg-slate-600/30" />
                                  <div className="w-8 h-12 bg-[#C5A059]/40 border border-[#C5A059]" />
                                  <div className="w-4 h-4 bg-slate-600/30" />
                                </div>
                                <span className="text-[10px] font-mono text-[#E8C56A]">Rotazione</span>
                              </div>

                              <div className="border border-[#C5A059]/30 bg-[#11131c] rounded-xl p-3">
                                <span className="font-mono text-xs font-bold text-[#E8C56A]">b-Shape</span>
                                <div className="h-20 w-8 mx-auto my-2 flex flex-col items-center">
                                  <div className="w-2.5 h-10 bg-slate-600/30" />
                                  <div className="w-8 h-10 bg-rose-500/30 border border-rose-400 rounded-b" />
                                </div>
                                <span className="text-[10px] font-mono text-rose-400">POC Basso</span>
                              </div>
                            </div>
                          )}

                          {activeThesis.diagramType === "asian_range_sweep" && (
                            <div className="w-full max-w-sm space-y-3 py-2 text-center">
                              <div className="h-24 border border-[#C5A059]/50 bg-[#C5A059]/10 rounded-xl flex items-center justify-between px-3 relative">
                                <span className="absolute -top-3 left-3 bg-[#07080b] px-2 font-mono text-xs text-[#E8C56A]">
                                  Asia High (Stop Retail)
                                </span>
                                <span className="w-full font-mono text-sm text-slate-200">
                                  Tokyo Range (00:00–08:00 UTC)
                                </span>
                                <span className="absolute -bottom-3 left-3 bg-[#07080b] px-2 font-mono text-xs text-[#E8C56A]">
                                  Asia Low (Target)
                                </span>
                              </div>
                              <span className="text-xs font-mono text-emerald-400 block">
                                {"Falsa rottura a Londra verso 1.27 → Rientro nel box"}
                              </span>
                            </div>
                          )}

                          {activeThesis.diagramType === "wyckoff_phases" && (
                            <div className="w-full text-center space-y-3 py-2">
                              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                                <span>A: Climax</span>
                                <span>B: Consenso</span>
                                <span>C: Spring</span>
                                <span>D: LPS</span>
                                <span>E: Espansione</span>
                              </div>
                              <div className="h-20 w-full border border-[#C5A059]/40 rounded-xl bg-[#11131c] flex items-center justify-center p-3">
                                <span className="font-mono text-sm text-[#E8C56A] font-bold">
                                  Sequenza Ciclica Istituzionale di Maturazione
                                </span>
                              </div>
                            </div>
                          )}

                          {activeThesis.diagramType === "brics_gold_macro" && (
                            <div className="w-full text-center space-y-3 py-2">
                              <div className="grid grid-cols-2 gap-3 text-left">
                                <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-950/25 text-xs font-mono text-slate-200">
                                  Treasury USA (Debito)
                                </div>
                                <div className="p-3 rounded-lg border border-[#C5A059]/50 bg-[#C5A059]/15 text-xs font-mono text-[#E8C56A]">
                                  XAU/USD (Oro Fisico)
                                </div>
                              </div>
                              <span className="text-xs font-mono text-[#E8C56A] block">
                                Divergenza strutturale da accumulazione sovrana
                              </span>
                            </div>
                          )}

                          {activeThesis.diagramType === "confluence_audit" && (
                            <div className="w-full text-center space-y-3 py-2">
                              <span className="font-mono text-sm text-[#E8C56A] font-bold block">
                                Soglia Minima di Convergenza: 70%
                              </span>
                              <div className="h-16 w-full border border-emerald-500/40 bg-emerald-950/30 rounded-xl flex items-center justify-center p-2">
                                <span className="font-mono text-xs text-emerald-300">
                                  Solo campioni con 5+ variabili concordi ammessi al backtest
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-400 italic leading-snug">
                          {activeThesis.diagramCaption}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 2: IL PROTOCOLLO DELLA FORGIA (BACKTEST) ─── */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C5A059]/20 pb-4">
                      <div>
                        <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] block">
                          Protocollo di Simulazione Storica nella Forgia
                        </span>
                        <h4 className="text-xl font-serif font-bold text-slate-100">
                          Come Testare la {activeThesis.roman} a Barre Coperte
                        </h4>
                      </div>

                      <Link
                        href="/backtest"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/25 font-mono text-xs font-bold transition-all shadow-sm"
                      >
                        <FlaskConical className="w-4 h-4 text-[#C5A059]" />
                        <span>Apri La Forgia del Passato</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-1" />
                      </Link>
                    </div>

                    {/* Le 3 Fasi del Protocollo di Backtest */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {activeThesis.forgeTestingProtocol.map((step) => (
                        <div
                          key={step.stepNumber}
                          className="p-5 rounded-xl border border-[#C5A059]/30 bg-[#11131c] space-y-2 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="w-7 h-7 rounded-full border border-[#C5A059]/50 bg-[#C5A059]/15 font-mono text-xs font-bold text-[#E8C56A] flex items-center justify-center">
                                {step.stepNumber}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 uppercase">
                                Fase {step.stepNumber}
                              </span>
                            </div>
                            <h5 className="text-sm font-serif font-bold text-slate-100">
                              {step.title}
                            </h5>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans">
                              {step.directive}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Metriche da Registrare */}
                    <div className="p-5 rounded-xl border border-[#C5A059]/30 bg-[#11131c] space-y-3">
                      <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] block">
                        Parametri di Misurazione da Annotare nel Diario:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {activeThesis.metricsToRecord.map((m, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-lg border border-[#C5A059]/20 bg-[#07080b] space-y-1"
                          >
                            <span className="font-mono text-xs font-bold text-[#E8C56A] block">
                              {m.metricName}
                            </span>
                            <p className="text-xs text-slate-400 leading-snug">
                              {m.purpose}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#C5A059]/20">
                      <Button
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                        className="border-[#C5A059]/30 text-slate-300 hover:text-slate-100 font-mono text-xs"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Torna al Modello
                      </Button>

                      <Button
                        onClick={() => setCurrentStep(3)}
                        className="bg-[#C5A059] text-black hover:bg-[#E8C56A] font-mono text-xs font-bold uppercase tracking-wider px-6 py-5 shadow-lg shadow-[#C5A059]/20"
                      >
                        Avvia la Prova a Punteggio (5 Quesiti)
                        <Award className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                )}

                {/* ─── STEP 3: CONSOLE QUIZ A PUNTEGGIO (1 DOMANDA ALLA VOLTA) ─── */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="max-w-3xl mx-auto space-y-6"
                  >
                    {!isQuizSubmitted ? (
                      <div className="space-y-6">
                        {/* Header con Barra di Progresso Animata */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between font-mono text-xs">
                            <span className="text-[#E8C56A] font-bold">
                              Quesito {currentQuestionIndex + 1} di {activeThesis.quizQuestions.length}
                            </span>
                            <span className="text-slate-400">
                              Valore: 20 pt · Soglia idoneità: 80/100 pt
                            </span>
                          </div>

                          <div className="h-2 w-full bg-slate-900 rounded-full border border-[#C5A059]/30 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#C5A059] to-[#FFE8A3] transition-all duration-300"
                              style={{
                                width: `${((currentQuestionIndex + 1) / activeThesis.quizQuestions.length) * 100}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Singola Domanda Spaziosa */}
                        {currentQ && (
                          <div className="p-6 md:p-8 rounded-2xl border border-[#C5A059]/35 bg-[#11131c] space-y-6 shadow-xl">
                            <h4 className="text-base md:text-lg font-serif font-bold text-slate-100 leading-snug">
                              {currentQuestionIndex + 1}. {currentQ.question}
                            </h4>

                            {/* Opzioni Spaziose a Card */}
                            <div className="space-y-3">
                              {currentQ.options.map((opt, optIdx) => {
                                const isSelected = quizAnswers[currentQuestionIndex] === optIdx;

                                return (
                                  <button
                                    key={optIdx}
                                    onClick={() => handleSelectOption(optIdx)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${
                                      isSelected
                                        ? "bg-[#C5A059]/20 border-[#C5A059] text-slate-100 shadow-md shadow-[#C5A059]/10 ring-1 ring-[#C5A059]"
                                        : "bg-[#07080b]/70 border-[#C5A059]/20 text-slate-300 hover:border-[#C5A059]/40 hover:bg-[#11131c]"
                                    }`}
                                  >
                                    <span
                                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                                        isSelected
                                          ? "bg-[#C5A059] text-black"
                                          : "bg-slate-800 text-slate-400"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>
                                    <span className="text-sm font-sans leading-relaxed mt-0.5">
                                      {opt}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Footer di Navigazione tra le Domande */}
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            variant="outline"
                            disabled={currentQuestionIndex === 0}
                            onClick={() => setCurrentQuestionIndex((p) => Math.max(0, p - 1))}
                            className="border-[#C5A059]/30 text-slate-300 hover:text-slate-100 font-mono text-xs"
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Precedente
                          </Button>

                          {currentQuestionIndex < activeThesis.quizQuestions.length - 1 ? (
                            <Button
                              disabled={!isCurrentQAnswered}
                              onClick={() => setCurrentQuestionIndex((p) => p + 1)}
                              className="bg-[#C5A059] text-black hover:bg-[#E8C56A] font-mono text-xs font-bold uppercase tracking-wider px-6 py-2"
                            >
                              Successiva
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          ) : (
                            <Button
                              disabled={!isAllAnswered}
                              onClick={handleSubmitQuiz}
                              className="bg-emerald-500 text-black hover:bg-emerald-400 font-mono text-xs font-bold uppercase tracking-wider px-6 py-2 shadow-lg shadow-emerald-500/20"
                            >
                              Concludi Esame &amp; Calcola Punteggio
                              <CheckCircle2 className="w-4 h-4 ml-1.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ─── SCHERMATA RISULTATI ANIMATA ─── */
                      <div className="p-6 md:p-8 rounded-2xl border border-[#C5A059]/35 bg-[#11131c] space-y-6 shadow-2xl">
                        {(() => {
                          const finalScore = calculateScore();
                          const passed = finalScore >= 80;

                          return (
                            <div className="text-center space-y-3 py-3">
                              <div className="inline-flex p-4 rounded-full bg-[#07080b] border-2 border-[#C5A059]/50 shadow-xl">
                                {passed ? (
                                  <ShieldCheck className="w-14 h-14 text-emerald-400" />
                                ) : (
                                  <ShieldAlert className="w-14 h-14 text-rose-400" />
                                )}
                              </div>

                              <div>
                                <span className="font-mono text-xs uppercase font-bold tracking-widest text-[#E8C56A] block">
                                  {passed ? "Tesi Convalidata con Onore" : "Idoneità Non Raggiunta"}
                                </span>
                                <h4 className="text-3xl font-mono font-bold text-slate-100 mt-1">
                                  Punteggio:{" "}
                                  <span className={passed ? "text-emerald-400" : "text-rose-400"}>
                                    {finalScore} / 100 pt
                                  </span>
                                </h4>
                              </div>

                              <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed font-sans">
                                {passed
                                  ? `Hai dimostrato piena comprensione teorica e metodologica per la ${activeThesis.roman}. Il Sigillo di Rango è registrato con successo nel Dossier dell'Operatore.`
                                  : `La soglia minima di superamento è 80 pt (4 risposte esatte su 5). Esamina la rassegna delle spiegazioni sotto riportata e ripeti la prova.`}
                              </p>
                            </div>
                          );
                        })()}

                        {/* Rassegna Risposte & Spiegazioni Dottrinali */}
                        <div className="space-y-3 pt-4 border-t border-[#C5A059]/20">
                          <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] block">
                            Cronaca Metodologica delle Risposte:
                          </span>

                          <div className="space-y-2.5">
                            {activeThesis.quizQuestions.map((q, idx) => {
                              const userAns = quizAnswers[idx];
                              const isCorrect = userAns === q.correctIndex;

                              return (
                                <div
                                  key={q.id}
                                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                                    isCorrect
                                      ? "bg-emerald-950/20 border-emerald-500/40 text-slate-200"
                                      : "bg-rose-950/20 border-rose-500/40 text-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-between font-semibold">
                                    <span className="text-sm">{idx + 1}. {q.question}</span>
                                    <span className="font-mono text-xs font-bold shrink-0 ml-2">
                                      {isCorrect ? (
                                        <span className="text-emerald-400">+20 pt (Esatto)</span>
                                      ) : (
                                        <span className="text-rose-400">0 pt (Errato)</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-300 italic bg-[#07080b]/60 p-2.5 rounded-lg border-l-2 border-[#C5A059]">
                                    Dottrina: {q.explanation}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Pulsanti Azione Finale */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#C5A059]/20">
                          <Button
                            variant="outline"
                            onClick={handleResetQuiz}
                            className="w-full sm:w-auto border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/15 font-mono text-xs"
                          >
                            <RotateCcw className="w-4 h-4 mr-1.5" />
                            Ripeti Esame
                          </Button>

                          {calculateScore() >= 80 && (
                            <Button
                              onClick={handleNextThesis}
                              className="w-full sm:w-auto bg-[#C5A059] text-black hover:bg-[#E8C56A] font-mono text-xs font-bold uppercase tracking-wider px-6"
                            >
                              Passa alla Tesi Successiva
                              <ArrowRight className="w-4 h-4 ml-1.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: I GRANDI TRATTATI TEORICI INTEGRALI ─── */}
      {activeMainTab === "manuali" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {MENTOR_MASTER_MANUALS.map((manual) => {
              const isSelected = manual.id === activeManual.id;
              return (
                <button
                  key={manual.id}
                  onClick={() => setSelectedManualId(manual.id)}
                  className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between min-h-[110px] ${
                    isSelected
                      ? "bg-[#11131c] border-[#C5A059] shadow-xl shadow-[#C5A059]/15 ring-1 ring-[#C5A059]/50"
                      : "bg-[#0d0f14]/90 border-[#C5A059]/20 hover:border-[#C5A059]/50 hover:bg-[#11131c]/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-mono text-xs uppercase font-bold text-[#E8C56A]">
                      {manual.manualCode}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#C5A059]/15 text-[#E8C56A] border border-[#C5A059]/30">
                      {manual.badge}
                    </span>
                  </div>

                  <div className="text-xs font-serif font-bold text-slate-100 line-clamp-2 leading-snug">
                    {manual.title}
                  </div>

                  <div className="mt-2 flex items-center justify-between w-full pt-1.5 border-t border-[#C5A059]/15 text-[10px] font-mono text-slate-400">
                    <span>{manual.chaptersCount} Capitoli</span>
                    <span>{manual.readingTime}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14] p-6 md:p-8 space-y-6 shadow-xl">
            <div className="border-b border-[#C5A059]/20 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#E8C56A] px-2.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35">
                    {activeManual.manualCode} · {activeManual.badge}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Fonte di Ricerca: {activeManual.sourceDocument}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-100">
                  {activeManual.title}
                </h3>
                <p className="text-sm text-slate-300 mt-1">{activeManual.subtitle}</p>
              </div>

              {activeManual.probabilityWeight && (
                <div className="bg-[#11131c] border border-[#C5A059]/35 px-4 py-2.5 rounded-xl text-right shrink-0">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">
                    Rilevanza Statistica del Modello
                  </span>
                  <span className="font-mono text-base font-bold text-[#E8C56A]">
                    {activeManual.probabilityWeight}
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border-l-4 border-[#C5A059] bg-[#11131c] text-sm text-slate-200 leading-relaxed font-sans">
              <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] block mb-1">
                Tesi Magistrale del Trattato:
              </span>
              {activeManual.coreThesis}
            </div>

            <div className="space-y-4">
              <span className="text-xs font-mono uppercase font-bold text-[#E8C56A] tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C5A059]" />
                Capitoli &amp; Compendi Teorici ({activeManual.chapters.length})
              </span>

              <div className="grid grid-cols-1 gap-4">
                {activeManual.chapters.map((chap) => (
                  <div
                    key={chap.id}
                    className="rounded-xl border border-[#C5A059]/25 bg-[#11131c] p-5 space-y-3"
                  >
                    <div className="flex items-center gap-2.5 border-b border-[#C5A059]/15 pb-2.5">
                      <span className="w-7 h-7 rounded-full border border-[#C5A059]/50 bg-[#C5A059]/15 font-mono text-xs font-bold text-[#E8C56A] flex items-center justify-center">
                        {chap.chapterNumber}
                      </span>
                      <h4 className="text-base font-serif font-bold text-slate-100">
                        {chap.title}
                      </h4>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed font-sans">
                      {chap.summary}
                    </p>

                    <div className="bg-[#07080b]/80 p-4 rounded-xl border border-[#C5A059]/20 space-y-2">
                      <span className="text-xs font-mono uppercase tracking-widest text-[#E8C56A] font-bold block">
                        Punti Dottrinali Chiave:
                      </span>
                      <ul className="space-y-1.5">
                        {chap.keyTakeaways.map((t, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-slate-300 flex items-start gap-2 leading-snug"
                          >
                            <span className="text-[#C5A059] font-mono mt-0.5">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: SCHEDA DI AUDIT DEL BACKTEST (ISOLAMENTO VARIABILI) ─── */}
      {activeMainTab === "audit" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14] p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#C5A059]/20 pb-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 font-mono text-xs uppercase font-bold text-[#E8C56A] px-3 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35">
                  <FlaskConical className="w-4 h-4 text-[#C5A059]" />
                  Protocollo di Ricerca Statistica per la Forgia del Passato
                </div>
                <h3 className="text-2xl font-serif font-bold text-slate-100">
                  Scheda di Audit del Backtest (7 Variabili)
                </h3>
                <p className="text-sm text-slate-300 max-w-xl">
                  Isola le 7 variabili statistiche per verificare se il campione retrospettivo presenta la convergenza minima (≥ 70%) richiesta per l'inclusione nella serie di simulazione.
                </p>
              </div>

              <div className="flex items-center gap-4 bg-[#11131c] border border-[#C5A059]/40 p-4 rounded-xl shadow-inner">
                <div>
                  <span className="block font-mono text-[10px] uppercase text-slate-400">
                    Indice di Convergenza
                  </span>
                  <span
                    className={`font-mono text-3xl font-bold tracking-tight ${
                      auditConvergenceScore >= 70
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}
                  >
                    {auditConvergenceScore}%
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyAuditLog}
                  className="border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/15 font-mono text-xs"
                >
                  {copiedAudit ? (
                    <>
                      <Check className="w-4 h-4 mr-1.5 text-emerald-400" />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1.5" />
                      Copia Audit
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Barra Visuale di Convergenza */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Soglia Minima di Idoneità: 70%</span>
                <span
                  className={
                    auditConvergenceScore >= 70
                      ? "text-emerald-400 font-bold"
                      : "text-amber-400 font-bold"
                  }
                >
                  {auditConvergenceScore >= 70
                    ? "✓ CAMPIONE IDONEO AL TEST STORICO NELLA FORGIA"
                    : "✗ CONVERGENZA INSUFFICIENTE — CAMPIONE DA SCARTARE"}
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-900 rounded-full border border-[#C5A059]/30 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    auditConvergenceScore >= 70
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                      : "bg-gradient-to-r from-amber-500 to-amber-300"
                  }`}
                  style={{ width: `${auditConvergenceScore}%` }}
                />
              </div>
            </div>

            {/* Griglia Criteri Spaziosa */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {MENTOR_BACKTEST_AUDIT_CRITERIA.map((crit) => {
                const checked = auditChecked[crit.id] ?? false;
                return (
                  <button
                    key={crit.id}
                    onClick={() => toggleAuditCriterion(crit.id)}
                    className={`text-left p-4 rounded-xl border transition-all flex items-start gap-4 ${
                      checked
                        ? "bg-[#11131c] border-[#C5A059] shadow-lg shadow-[#C5A059]/10"
                        : "bg-[#07080b]/80 border-[#C5A059]/15 text-slate-400 hover:border-[#C5A059]/30"
                    }`}
                  >
                    <div className="mt-1">
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          checked
                            ? "bg-[#C5A059] border-[#C5A059] text-black"
                            : "border-slate-600 bg-transparent"
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs uppercase font-bold text-[#E8C56A] px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30">
                          {crit.code}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-300">
                          Peso: {crit.probabilityWeight}%
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-100">
                        {crit.variableName}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        {crit.hypothesisDescription}
                      </p>

                      <div className="text-xs font-mono text-[#E8C56A]/90 italic pt-1">
                        Protocollo: {crit.forgeTestProtocol}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: TRASMISSIONE VIDEO DI LABORATORIO ─── */}
      {activeMainTab === "video" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#C5A059]/35 bg-[#0d0f14] p-6 md:p-8 space-y-6 shadow-2xl">
            <div className="border-b border-[#C5A059]/20 pb-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#E8C56A] px-2.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/35">
                  Archivio Didattico Audio-Visivo
                </span>
                <h3 className="text-2xl font-serif font-bold text-slate-100 mt-1">
                  {MENTOR_VIDEO_MASTER_LESSON.title}
                </h3>
                <p className="text-sm text-slate-300">{MENTOR_VIDEO_MASTER_LESSON.subtitle}</p>
              </div>
              <span className="font-mono text-xs text-[#E8C56A] border border-[#C5A059]/40 bg-[#11131c] px-3 py-1.5 rounded-lg">
                {MENTOR_VIDEO_MASTER_LESSON.duration}
              </span>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[#C5A059]/35 bg-black aspect-video flex items-center justify-center shadow-2xl">
              <video
                src={MENTOR_VIDEO_MASTER_LESSON.videoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              >
                Il tuo browser non supporta la riproduzione video HTML5.
              </video>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-[#C5A059]/25 bg-[#11131c] space-y-2">
                <span className="text-xs font-mono uppercase font-bold text-[#E8C56A] block">
                  Sintesi della Lezione:
                </span>
                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  {MENTOR_VIDEO_MASTER_LESSON.operationalSummary}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-[#C5A059]/25 bg-[#11131c] space-y-2">
                <span className="text-xs font-mono uppercase font-bold text-[#E8C56A] block">
                  Concetti da Sottoporre a Simulazione:
                </span>
                <ul className="space-y-1.5">
                  {MENTOR_VIDEO_MASTER_LESSON.keyConcepts.map((c, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-slate-300 flex items-start gap-2 leading-snug"
                    >
                      <span className="text-[#C5A059] font-mono">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
