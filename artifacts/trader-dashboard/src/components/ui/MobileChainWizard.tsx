import React from "react";
import { ChevronLeft, ChevronRight, Check, Sparkles, Compass } from "lucide-react";
import { synestheticClick } from "@/lib/soundFx";

export interface ChainStepMeta {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  completed?: boolean;
}

interface MobileChainWizardProps {
  steps: ChainStepMeta[];
  activeStepIndex: number;
  onSelectStep: (index: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  canProceed?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  finalActionLabel?: string;
  onFinalAction?: () => void;
  isSubmitting?: boolean;
  onOpenTutorial?: () => void;
  tutorialLabel?: string;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Motore di navigazione a pagine concatenate (AUREUS MOBILE CHAIN).
 * Garantisce un flusso multi-livello progressivo senza muri di input verticali.
 */
export function MobileChainWizard({
  steps,
  activeStepIndex,
  onSelectStep,
  onPrev,
  onNext,
  canProceed = true,
  nextLabel,
  prevLabel = "Indietro",
  finalActionLabel = "Sigilla & Conferma",
  onFinalAction,
  isSubmitting = false,
  onOpenTutorial,
  tutorialLabel = "Tutorial Sistema",
  children,
  className = "",
  compact = false,
}: MobileChainWizardProps) {
  const safeIndex = Math.max(0, Math.min(activeStepIndex, steps.length - 1));
  const currentStep = steps[safeIndex];
  const nextStep = safeIndex < steps.length - 1 ? steps[safeIndex + 1] : null;
  const isLastStep = safeIndex === steps.length - 1;
  const progressPct = steps.length > 1 ? Math.round(((safeIndex + 1) / steps.length) * 100) : 100;

  const handleStepClick = (idx: number) => {
    synestheticClick();
    onSelectStep(idx);
  };

  const handlePrev = () => {
    synestheticClick();
    if (onPrev) {
      onPrev();
    } else if (safeIndex > 0) {
      onSelectStep(safeIndex - 1);
    }
  };

  const handleNext = () => {
    synestheticClick();
    if (isLastStep) {
      onFinalAction?.();
    } else if (onNext) {
      onNext();
    } else {
      onSelectStep(safeIndex + 1);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl border border-[#C5A059]/25 bg-[#07080b]/95 shadow-[0_12px_36px_rgba(0,0,0,0.65)] overflow-hidden ${className}`}
      data-testid="mobile-chain-wizard"
    >
      {/* ── TESTATA PROGRESSIVA DELLA CATENA ── */}
      <div className="border-b border-[#C5A059]/20 bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-[#E8C56A] whitespace-nowrap shrink-0">
              <Compass className="w-2.5 h-2.5 text-[#C5A059]" />
              PASSO {String(safeIndex + 1).padStart(2, "0")}/{String(steps.length).padStart(2, "0")}
            </span>
            <h4 className="font-display text-xs sm:text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              {currentStep?.title}
            </h4>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenTutorial && (
              <button
                type="button"
                onClick={() => {
                  synestheticClick();
                  onOpenTutorial();
                }}
                className="inline-flex items-center gap-1 rounded-md border border-[#C5A059]/35 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-[#E8C56A] transition-all whitespace-nowrap cursor-pointer"
                data-testid="chain-open-tutorial-btn"
              >
                <Sparkles className="w-2.5 h-2.5 text-[#C5A059]" />
                <span>{tutorialLabel}</span>
              </button>
            )}
            <span className="font-mono text-[10px] font-bold text-[#C5A059] whitespace-nowrap">
              {progressPct}%
            </span>
          </div>
        </div>

        {/* Barra di avanzamento continua Ossidiana & Oro */}
        <div className="h-1 w-full rounded-full bg-[#181B24] overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-[#C5A059] to-[#E8C56A] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Pillole dei Nodi della Catena */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {steps.map((step, idx) => {
            const isCurrent = idx === safeIndex;
            const isDone = Boolean(step.completed) || idx < safeIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(idx)}
                data-testid={`chain-step-pill-${idx}`}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isCurrent
                    ? "bg-[#C5A059] text-[#07080b] font-bold shadow-[0_0_12px_rgba(197,160,89,0.3)]"
                    : isDone
                      ? "border border-[#10b981]/35 bg-[#10b981]/10 text-[#10b981] font-semibold"
                      : "border border-[#26262E] bg-[#07080b]/80 text-[#94a3b8] hover:border-[#C5A059]/30 hover:text-[#F4F4F6]"
                }`}
              >
                {isDone && !isCurrent ? (
                  <Check className="w-2.5 h-2.5 text-[#10b981] shrink-0" />
                ) : (
                  <span className="opacity-80">{step.code}</span>
                )}
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>

        {currentStep?.subtitle && !compact && (
          <p className="mt-1.5 text-[11px] text-[#94a3b8] leading-snug">
            {currentStep.subtitle}
          </p>
        )}
      </div>

      {/* ── CONTENUTO DEL LIVELLO ATTIVO ── */}
      <div className={compact ? "p-3" : "p-3.5 sm:p-4"}>
        {children}
      </div>

      {/* ── BARRA INFERIORE DI CONCATENAZIONE ── */}
      <div className="border-t border-[#C5A059]/20 bg-[#0d0f14]/95 px-3 py-2.5 sm:px-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={safeIndex === 0 && !onPrev}
          data-testid="chain-prev-btn"
          className="inline-flex items-center gap-1 rounded-lg border border-[#C5A059]/25 bg-[#11131c] hover:border-[#C5A059]/50 hover:text-[#F4F4F6] disabled:opacity-35 disabled:pointer-events-none px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] transition-all whitespace-nowrap cursor-pointer min-h-[38px]"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>{prevLabel}</span>
        </button>

        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[9.5px] text-[#94a3b8] whitespace-nowrap">
          <span>Anello {safeIndex + 1} di {steps.length}</span>
          {nextStep && (
            <span className="text-[#C5A059]/80">· Prossimo: {nextStep.title}</span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={!canProceed || isSubmitting}
          data-testid="chain-next-btn"
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 font-mono text-[10.5px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer min-h-[38px] ${
            isLastStep
              ? "bg-[#10b981] hover:bg-[#10b981]/90 text-[#07080b] shadow-[0_0_16px_rgba(16,185,129,0.3)]"
              : "bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.25)]"
          } disabled:opacity-40 disabled:pointer-events-none`}
        >
          <span>
            {isLastStep
              ? finalActionLabel
              : nextLabel ?? `Avanti: ${nextStep?.title ?? "Continua"}`}
          </span>
          {!isLastStep && <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
        </button>
      </div>
    </div>
  );
}

interface QuickSelectChipBarProps {
  label?: string;
  options: readonly string[];
  currentValue: string;
  onSelect: (newValue: string) => void;
  mode?: "append" | "replace";
  separator?: string;
}

/**
 * Barra di chip rapide toccabili per compilare campi su mobile con un solo tap,
 * evitando digitazioni lunghe sulla tastiera virtuale.
 */
export function QuickSelectChipBar({
  label,
  options,
  currentValue,
  onSelect,
  mode = "append",
  separator = ", ",
}: QuickSelectChipBarProps) {
  const handlePick = (item: string) => {
    synestheticClick();
    if (mode === "replace") {
      onSelect(item);
      return;
    }
    const trimmed = currentValue.trim();
    if (!trimmed) {
      onSelect(item);
      return;
    }
    if (trimmed.toLowerCase().includes(item.toLowerCase())) {
      return;
    }
    onSelect(`${trimmed}${separator}${item}`);
  };

  return (
    <div className="space-y-1 pt-1">
      {label && (
        <span className="block font-mono text-[9px] uppercase tracking-wider text-[#C5A059]/85">
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const isSelected =
            mode === "replace"
              ? currentValue.trim().toLowerCase() === option.toLowerCase()
              : currentValue.toLowerCase().includes(option.toLowerCase());
          return (
            <button
              key={option}
              type="button"
              onClick={() => handlePick(option)}
              className={`rounded border px-2 py-1 font-mono text-[9.5px] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                isSelected
                  ? "border-[#C5A059] bg-[#C5A059]/20 text-[#E8C56A]"
                  : "border-[#C5A059]/20 bg-[#0d0f14] text-[#94a3b8] hover:border-[#C5A059]/45 hover:text-[#F4F4F6]"
              }`}
            >
              {isSelected ? `✓ ${option}` : `+ ${option}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
