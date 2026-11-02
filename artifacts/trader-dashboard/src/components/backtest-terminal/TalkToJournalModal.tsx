// ─── AUREUS PROTOCOL — Talk to Journal (AI Voice Notes) ─────────────────────
// Ispirato ad FX Replay ma elevato ai canoni monastici AUREUS:
// Permette al trader di verbalizzare i propri pensieri ad alta voce durante il replay.
// Trascrive in tempo reale e collega la nota alla specifica candela e al Libro della Verità.

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  Save,
  Trash2,
  Tag,
  Clock,
  Layers,
  Flame,
  Volume2,
} from "lucide-react";
import { LimenResponsiveDrawer } from "@/components/ui/LimenResponsiveDrawer";
import { useToast } from "@/hooks/use-toast";
import { synestheticClick, synestheticSealOfAction } from "@/lib/soundFx";
import { formatPrice } from "./format";
import {
  saveSessionNote,
  type ReplaySessionNote,
} from "@/lib/replay/sessionNotes";
import type { ReplayEngine } from "./useReplayEngine";

export interface TalkToJournalModalProps {
  isOpen: boolean;
  onClose: () => void;
  engine: ReplayEngine;
  sessionKey: string;
}

const PRESET_TAGS = [
  "Liquidity Sweep",
  "Wyckoff Spring",
  "Order Flow Imbalance",
  "Break of Structure",
  "Fair Value Gap",
  "Disciplina & Varco",
];

export function TalkToJournalModal({
  isOpen,
  onClose,
  engine,
  sessionKey,
}: TalkToJournalModalProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Candela e contesto corrente
  const currentCandle = engine.candles[engine.cursor];
  const currentPrice = currentCandle?.close ?? 0;
  const currentTimestamp = currentCandle?.time ?? Math.floor(Date.now() / 1000);
  const formattedReplayTime = new Date(currentTimestamp * 1000).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }) + " UTC";

  const hasActivePosition = engine.positions.length > 0;
  const activeDirection = hasActivePosition ? engine.positions[0].direction : undefined;

  // Inizializza o arresta il riconoscimento vocale
  const startRecording = async () => {
    try {
      synestheticClick();
      audioChunksRef.current = [];

      // 1. Web Audio API per animazione onda sonora
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser.fftSize = 64;
        source.connect(analyser);
        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((acc, v) => acc + v, 0) / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 255) * 100)));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }

      // 2. MediaRecorder per memorizzazione blob
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;

      // 3. SpeechRecognition per trascrizione testuale
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "it-IT";

        recognition.onresult = (event: any) => {
          let liveTranscript = "";
          for (let i = 0; i < event.results.length; i++) {
            liveTranscript += event.results[i][0].transcript + " ";
          }
          setTranscript(liveTranscript.trim());
        };

        recognition.onerror = (event: any) => {
          console.warn("[TalkToJournal] Speech recognition event:", event.error);
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      setIsRecording(true);
    } catch (err) {
      console.error("[TalkToJournal] Errore accesso microfono:", err);
      toast({
        title: "Microfono Non Rilevato",
        description: "Assicurati di aver concesso i permessi microfono al browser.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    synestheticClick();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsRecording(false);
    setAudioLevel(0);
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  const handleSaveNote = () => {
    if (!transcript.trim()) {
      toast({
        title: "Nota Vuota",
        description: "Registra la tua voce o digita una riflessione operativa.",
        variant: "destructive",
      });
      return;
    }

    synestheticSealOfAction();
    const noteId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newNote: ReplaySessionNote = {
      id: noteId,
      timestamp: currentTimestamp,
      createdAt: Date.now(),
      formattedTime: formattedReplayTime,
      symbol: engine.symbol,
      interval: engine.interval,
      price: currentPrice,
      transcript: transcript.trim(),
      direction: activeDirection ?? "neutral",
      openProfit: engine.positions[0]?.realizedPartialProfit ?? undefined,
      tags: selectedTags,
    };

    saveSessionNote(sessionKey, newNote);
    toast({
      title: "Verità Sigillata nel Diario",
      description: `Nota vocale collegata alla candela ${engine.symbol} [${engine.interval}] a ${formatPrice(currentPrice, engine.symbol)}.`,
    });

    stopRecording();
    setTranscript("");
    setSelectedTags([]);
    onClose();
  };

  const toggleTag = (tag: string) => {
    synestheticClick();
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  return (
    <LimenResponsiveDrawer
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          stopRecording();
          onClose();
        }
      }}
      title={
        <div className="flex items-center gap-2">
          <Volume2 size={16} className="text-[#C5A059]" />
          <span className="font-serif uppercase tracking-wider text-[#C5A059] text-sm font-bold">
            Talk to Journal
          </span>
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 uppercase font-bold tracking-wider">
            AI AUDIO NOTE
          </span>
        </div>
      }
      subtitle="Verbalizza la tua intenzione a voce: l'AI collegherà la nota a questa candela nel Libro della Verità."
      desktopClassName="max-w-xl bg-[#07080b]/98 border border-[#C5A059]/30 backdrop-blur-2xl text-slate-100"
      mobileClassName="max-h-[85vh] bg-[#07080b]/98 border-t border-[#C5A059]/30 backdrop-blur-2xl p-4 flex flex-col"
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Telemetria di Contesto Candela Attuale */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#0d0f14] border border-[#C5A059]/20 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 text-[#E8C56A] font-bold">
              {engine.symbol} · {engine.interval}
            </span>
            <span className="text-slate-300 font-bold whitespace-nowrap">
              {formatPrice(currentPrice, engine.symbol)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Clock size={12} className="text-[#C5A059]" />
            <span className="whitespace-nowrap">{formattedReplayTime}</span>
          </div>
        </div>

        {/* Visualizzatore Registrazione Audio / Microfono */}
        <div className="flex flex-col items-center justify-center p-5 rounded-xl bg-gradient-to-b from-[#11131c] to-[#07080b] border border-[#C5A059]/25 shadow-inner">
          <div className="relative mb-3">
            {isRecording && (
              <span
                className="absolute -inset-2 rounded-full bg-rose-500/30 animate-ping pointer-events-none"
                style={{ transform: `scale(${1 + audioLevel / 100})` }}
              />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative z-10 flex h-16 w-16 items-center justify-center rounded-full border-2 transition-transform active:scale-95 shadow-xl ${
                isRecording
                  ? "border-rose-500 bg-rose-950/80 text-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.4)]"
                  : "border-[#C5A059] bg-[#C5A059]/15 text-[#E8C56A] hover:bg-[#C5A059]/25 shadow-[0_0_20px_rgba(197,160,89,0.25)]"
              }`}
              title={isRecording ? "Ferma Registrazione" : "Inizia a Parlare"}
              aria-label={isRecording ? "Ferma Registrazione" : "Inizia a Parlare"}
            >
              {isRecording ? <MicOff size={26} /> : <Mic size={26} />}
            </button>
          </div>

          <div className="text-center">
            <span className="text-xs font-semibold text-slate-200">
              {isRecording ? "In ascolto attivo..." : "Tocca per verbalizzare il pensiero"}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Esprimi ad alta voce setup, confluenze o sensazioni emotive sul trade
            </p>
          </div>

          {/* Audio Wave Visualizer Bars */}
          {isRecording && (
            <div className="flex items-center gap-1 mt-3 h-5">
              {[12, 28, 45, 80, 55, 30, 70, 95, 40, 20, 60, 35].map((base, idx) => (
                <div
                  key={idx}
                  className="w-1 rounded-full bg-gradient-to-t from-emerald-500 to-[#E8C56A] transition-all duration-75"
                  style={{
                    height: `${Math.max(4, (base * (audioLevel + 15)) / 100)}px`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trascrizione Testuale Modificabile */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Trascrizione Live & Riflessione</span>
            {transcript && (
              <button
                type="button"
                onClick={() => setTranscript("")}
                className="text-[10px] text-rose-400 hover:underline cursor-pointer"
              >
                Pulisci
              </button>
            )}
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={3}
            placeholder="Es: 'Candela delle 14:30 con sweep della liquidità asiatica. Entro long su re-test del POC volumetrico...'"
            className="w-full rounded-lg bg-[#0d0f14] border border-[#C5A059]/30 p-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-[#C5A059] resize-none font-sans"
          />
        </div>

        {/* Tag Confluenze Rapide */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Tag size={11} className="text-[#C5A059]" /> Confluenze AUREUS
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2 py-1 rounded text-[10px] font-mono tracking-wider transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-[#C5A059]/25 border border-[#C5A059] text-[#E8C56A] font-bold"
                      : "bg-[#11131c] border border-white/10 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* Azioni del Cockpit */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#C5A059]/20">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-xs text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={!transcript.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg border border-[#C5A059]/60 bg-[#C5A059] text-black font-semibold text-xs hover:bg-[#E8C56A] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(197,160,89,0.3)] cursor-pointer"
          >
            <Save size={13} />
            <span>Sigilla nel Diario</span>
          </button>
        </div>
      </div>
    </LimenResponsiveDrawer>
  );
}
