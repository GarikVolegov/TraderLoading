import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Award,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  MentorDoctrineTome,
  MentorDoctrineQuestion,
} from "../../../../../contracts/academy";

export interface DoctrineExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  tome: MentorDoctrineTome | null;
  onPassExam: (tomeId: string) => void;
  isAlreadyPassed?: boolean;
}

export function DoctrineExamModal({
  isOpen,
  onClose,
  tome,
  onPassExam,
  isAlreadyPassed = false,
}: DoctrineExamModalProps) {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  if (!isOpen || !tome) return null;

  const questions: MentorDoctrineQuestion[] = tome.examQuestions;
  const currentQ = questions[currentQuestionIdx];

  const handleSelectOption = (optionIdx: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIdx]: optionIdx,
    }));
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctIndex) {
        correct += 1;
      }
    });
    return correct;
  };

  const handleFinish = () => {
    setIsSubmitted(true);
    const score = calculateScore();
    if (score === questions.length) {
      onPassExam(tome.id);
    }
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setCurrentQuestionIdx(0);
    setIsSubmitted(false);
  };

  const score = calculateScore();
  const passed = score === questions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-xl border border-[#C5A059]/40 bg-[#0d0f14] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header Modale */}
        <div className="border-b border-[#C5A059]/20 bg-[#11131c] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A]">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#E8C56A] font-bold">
                Prova di Padronanza Dottrinale · {tome.roman}
              </div>
              <h3 className="text-base font-serif font-bold text-slate-100">
                {tome.title}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Modale */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!isSubmitted ? (
            <>
              {/* Progress Tracker */}
              <div className="flex items-center justify-between border-b border-[#C5A059]/15 pb-3">
                <span className="font-mono text-xs text-slate-300">
                  Quesito{" "}
                  <span className="text-[#E8C56A] font-bold">
                    {currentQuestionIdx + 1}
                  </span>{" "}
                  di {questions.length}
                </span>
                <div className="flex items-center gap-1.5">
                  {questions.map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-1.5 w-6 rounded-full transition-all ${
                        idx === currentQuestionIdx
                          ? "bg-[#C5A059]"
                          : selectedAnswers[idx] !== undefined
                          ? "bg-[#C5A059]/40"
                          : "bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Domanda Attuale */}
              {currentQ && (
                <div className="space-y-4">
                  <div className="text-sm md:text-base font-serif text-slate-100 leading-snug">
                    {currentQ.question}
                  </div>

                  {/* Opzioni */}
                  <div className="space-y-2.5">
                    {currentQ.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[currentQuestionIdx] === optIdx;
                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(optIdx)}
                          className={`w-full text-left p-3.5 rounded-lg border transition-all text-xs font-sans leading-relaxed flex items-start gap-3 ${
                            isSelected
                              ? "bg-[#C5A059]/15 border-[#C5A059] text-slate-100 shadow-md shadow-[#C5A059]/10"
                              : "bg-[#11131c]/70 border-[#C5A059]/20 text-slate-300 hover:border-[#C5A059]/50 hover:bg-[#11131c]"
                          }`}
                        >
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                              isSelected
                                ? "bg-[#C5A059] text-black"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="flex-1 mt-0.5">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Schermata Risultati */
            <div className="space-y-6 text-center py-4">
              <div className="inline-flex p-4 rounded-full bg-[#11131c] border-2 border-[#C5A059]/40 shadow-inner">
                {passed ? (
                  <ShieldCheck className="w-12 h-12 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-rose-400" />
                )}
              </div>

              <div className="space-y-2">
                <div className="font-mono text-xs uppercase font-bold tracking-widest text-[#E8C56A]">
                  {passed ? "Sigillo di Conformità Dottrinale Rilasciato" : "Verifica Non Soddisfatta"}
                </div>
                <h4 className="text-xl font-serif font-bold text-slate-100">
                  Punteggio:{" "}
                  <span className={passed ? "text-emerald-400" : "text-rose-400"}>
                    {score} / {questions.length} Corrette
                  </span>
                </h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  {passed
                    ? `Hai dimostrato piena conformità con i canoni operativi di ${tome.roman}. Questo traguardo convalida la tua preparazione verso il Grado di ${tome.targetGradeName}.`
                    : "Il Protocollo AUREUS richiede la precisione assoluta (3/3). Esamina la spiegazione dettagliata degli errori e ripeti la prova."}
                </p>
              </div>

              {/* Rassegna Spiegazioni */}
              <div className="text-left space-y-3 pt-3 border-t border-[#C5A059]/20">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#E8C56A] font-bold">
                  Cronaca delle Risposte & Chiarimento del Mentore:
                </div>
                {questions.map((q, idx) => {
                  const userAns = selectedAnswers[idx];
                  const isCorrect = userAns === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        isCorrect
                          ? "bg-emerald-950/20 border-emerald-500/30 text-slate-200"
                          : "bg-rose-950/20 border-rose-500/30 text-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">
                          {idx + 1}. {q.question}
                        </span>
                        <span className="font-mono text-[10px] uppercase font-bold">
                          {isCorrect ? (
                            <span className="text-emerald-400">Esatto</span>
                          ) : (
                            <span className="text-rose-400">Errato</span>
                          )}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 italic bg-[#07080b]/50 p-2 rounded border-l-2 border-[#C5A059]">
                        Dottrina: {q.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigazione */}
        <div className="border-t border-[#C5A059]/20 bg-[#11131c] px-6 py-4 flex items-center justify-between">
          {!isSubmitted ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={currentQuestionIdx === 0}
                onClick={() => setCurrentQuestionIdx((p) => Math.max(0, p - 1))}
                className="border-[#C5A059]/30 text-slate-300 hover:text-slate-100 text-xs font-mono"
              >
                Precedente
              </Button>

              {currentQuestionIdx < questions.length - 1 ? (
                <Button
                  size="sm"
                  disabled={selectedAnswers[currentQuestionIdx] === undefined}
                  onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                  className="bg-[#C5A059] text-black hover:bg-[#E8C56A] text-xs font-mono font-bold"
                >
                  Successivo
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={selectedAnswers[currentQuestionIdx] === undefined}
                  onClick={handleFinish}
                  className="bg-emerald-500 text-black hover:bg-emerald-400 text-xs font-mono font-bold"
                >
                  Concludi Esame
                  <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                </Button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              {!passed ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/15 text-xs font-mono"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Riprova Esame
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                  <Sparkles className="w-4 h-4 text-[#E8C56A]" />
                  Sigillo Registrato nel Dossier dell'Operatore
                </div>
              )}

              <Button
                size="sm"
                onClick={onClose}
                className="bg-[#C5A059] text-black hover:bg-[#E8C56A] text-xs font-mono font-bold ml-auto"
              >
                Chiudi
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
