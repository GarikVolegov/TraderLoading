import { deliverBrowserNotification } from "./notifications";

export const CARDIO_DEBOUNCE_MS = 15 * 60 * 1000; // 15 minuti di cooldown anti-spam

export interface SentinelEvaluationInput {
  isSessionActive: boolean;
  sessionId?: string;
  elapsedSessionMinutes: number;
  currentBpm: number;
  isCriticalDrift: boolean;
  stressReason: string;
  lastNotifiedFatigueSessionId: string | null;
  lastCardioDriftNotificationMs: number;
  nowMs: number;
}

export interface SentinelAlarmAction {
  type: "fatigue_90m" | "cardio_drift";
  title: string;
  body: string;
  tag: string;
  updatedFatigueSessionId?: string;
  updatedCardioTimestampMs?: number;
}

/**
 * Valuta deterministicamente se inviare un'allerta sentinella per affaticamento prolungato o tachicardia da Rischio Deriva.
 */
export function evaluateSentinelAlarms(input: SentinelEvaluationInput): SentinelAlarmAction | null {
  if (!input.isSessionActive) {
    return null;
  }

  // 1. Allerta Affaticamento Continuativo (≥ 90 minuti)
  if (
    input.elapsedSessionMinutes >= 90 &&
    input.sessionId &&
    input.lastNotifiedFatigueSessionId !== input.sessionId
  ) {
    return {
      type: "fatigue_90m",
      title: "AUREUS · Sentinella della Presenza",
      body: "Sessione continuativa di 90 min raggiunta. Rischio affaticamento neocorticale: attiva il Respiro 4-7-8 o prenditi una pausa.",
      tag: `aureus-fatigue-${input.sessionId}`,
      updatedFatigueSessionId: input.sessionId,
    };
  }

  // 2. Allerta Cardio Tachicardia / Rischio Deriva (BPM ≥ 92 o isCriticalDrift)
  if (input.currentBpm >= 92 || input.isCriticalDrift) {
    const elapsedSinceLastNotification = input.nowMs - input.lastCardioDriftNotificationMs;
    if (elapsedSinceLastNotification >= CARDIO_DEBOUNCE_MS) {
      return {
        type: "cardio_drift",
        title: `AUREUS · Allerta Rischio Deriva (${input.currentBpm} BPM)`,
        body: `Frequenza cardiaca elevata (${input.stressReason || "Tachicardia Operativa"}). Attiva 1 ciclo di Respiro Tattico 4-7-8 prima di toccare i mercati.`,
        tag: "aureus-cardio-drift",
        updatedCardioTimestampMs: input.nowMs,
      };
    }
  }

  return null;
}

/**
 * Invia l'allerta al browser e al Service Worker con fallback sul Toast di interfaccia.
 */
export async function dispatchSentinelNotification(
  alarm: SentinelAlarmAction,
  toastFn?: (opts: { title: string; description: string; variant?: "destructive" }) => void,
): Promise<void> {
  try {
    await deliverBrowserNotification({
      title: alarm.title,
      body: alarm.body,
      tag: alarm.tag,
      showToast: toastFn
        ? () => {
            toastFn({
              title: alarm.title,
              description: alarm.body,
              variant: "destructive",
            });
          }
        : undefined,
    });
  } catch {
    // Non blocca l'operatività del cockpit
  }
}
