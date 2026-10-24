import { useState, useCallback, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  analyzeVarcoVision,
  type VarcoVisionRequest,
  type VarcoVisionResponse,
  type VarcoSetupPlan,
  type VarcoChecklistAudit,
} from "@workspace/api-client-react";

export interface ScanVarcoOptions {
  symbol: string;
  interval: string;
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>;
  chartCanvas?: HTMLCanvasElement | null;
  chartImage?: string | null;
  currentPhase?: number;
  accountCapital?: number;
  riskPercent?: number;
  silent?: boolean;
  activeSetup?: VarcoSetupPlan | null;
  enforceSessionWindows?: boolean;
  operativeMemory?: VarcoVisionRequest["operativeMemory"];
}

export function useVarcoVisionSentinel() {
  const { toast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [analysis, setAnalysis] = useState<VarcoVisionResponse | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [liveSentinelEnabled, setLiveSentinelEnabled] = useState(false);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      inFlightAbortRef.current?.abort();
    };
  }, []);

  const scan = useCallback(
    async (params: ScanVarcoOptions) => {
      // Abort previous in-flight request to prevent queuing delays
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }
      const controller = new AbortController();
      inFlightAbortRef.current = controller;

      setIsScanning(true);
      try {
        let chartImage: string | undefined = params.chartImage || undefined;
        if (!chartImage && params.chartCanvas) {
          try {
            chartImage = params.chartCanvas.toDataURL("image/png");
          } catch (e) {
            console.warn("[useVarcoVisionSentinel] Errore estrazione canvas immagine:", e);
          }
        }

        const payload: VarcoVisionRequest = {
          symbol: params.symbol,
          interval: params.interval,
          chartImage,
          candles: params.candles,
          currentPhase: params.currentPhase ?? 1,
          accountCapital: params.accountCapital ?? 100000,
          riskPercent: params.riskPercent ?? 1.0,
          activeSetup: params.activeSetup ?? undefined,
          enforceSessionWindows: params.enforceSessionWindows,
          operativeMemory: params.operativeMemory,
        };

        const res = await analyzeVarcoVision(payload, { signal: controller.signal });
        setAnalysis(res);
        setShowOverlay(true);

        // Se non siamo in modalità silente (es. scansione automatica continua), mostra il toast informativo
        if (!params.silent) {
          if (res.setup) {
            toast({
              title: `Sentinella AI: Setup ${res.setup.direction.toUpperCase()} Rilevato`,
              description: `Entry: ${res.setup.entryPrice} · SL: ${res.setup.stopLossPrice} · R:R 1:${res.setup.riskRewardRatio} · BE a ${res.setup.breakEvenPrice}`,
            });
          } else {
            toast({
              title: "Sentinella AI: Analisi Varco Completata",
              description: res.summary,
            });
          }
        }
        return res;
      } catch (err: any) {
        if (err?.name === "AbortError" || err?.name === "CanceledError" || controller.signal.aborted) {
          // Richiesta interrotta intenzionalmente per lasciare spazio alla nuova barra
          return null;
        }
        console.error("[useVarcoVisionSentinel] Errore chiamata API:", err);
        if (!params.silent) {
          toast({
            title: "Errore Scansione Visiva",
            description: err instanceof Error ? err.message : "Impossibile completare la scansione del Varco.",
            variant: "destructive",
          });
        }
        return null;
      } finally {
        if (inFlightAbortRef.current === controller) {
          inFlightAbortRef.current = null;
          setIsScanning(false);
        }
      }
    },
    [toast],
  );

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  const updateSetup = useCallback((setup: VarcoSetupPlan) => {
    setAnalysis((prev) => (prev ? { ...prev, setup } : null));
  }, []);

  return {
    isScanning,
    analysis,
    setup: analysis?.setup ?? null,
    checklistAudit: analysis?.checklistAudit ?? null,
    showOverlay,
    setShowOverlay,
    liveSentinelEnabled,
    setLiveSentinelEnabled,
    scan,
    clearAnalysis,
    updateSetup,
  };
}
