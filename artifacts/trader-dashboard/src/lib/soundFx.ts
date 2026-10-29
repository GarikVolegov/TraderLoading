/**
 * AUREUS PROTOCOL — Risuonatore Acustico Sovrano (Operational Sound Engine)
 *
 * Ingegneria acustica procedurale sintetizzata in tempo reale via Web Audio API
 * a ZERO byte (nessun file audio esterno). Progettato con principi psicoacustici:
 * - Frequenze di rilassamento e centratura (432 Hz, 528 Hz Solfeggio, 108 Hz)
 * - Micro-battimenti binaurali Alpha (1.2–1.8 Hz) per favorire la concentrazione
 * - Modellazione fisica di micro-transienti d'ossidiana e filtri dinamici esponenziali
 * - Fusione sinestetica perfetta con il Motore Aptico (haptics.ts)
 */

import {
  hapticLight,
  hapticMedium,
  hapticSuccess,
  hapticWarning,
  hapticSovereign,
} from "./haptics.js";

const SFX_MUTED_KEY = "aureus_sfx_muted";
const SFX_VOLUME_KEY = "aureus_sfx_volume";
const DEFAULT_VOLUME = 0.75;

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtxClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtxClass) return null;

  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    try {
      sharedAudioContext = new AudioCtxClass();
    } catch {
      return null;
    }
  }

  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch(() => {});
  }

  return sharedAudioContext;
}

/** Verifica se i suoni operativi sono abilitati dall'Operatore */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return window.localStorage.getItem(SFX_MUTED_KEY) !== "true";
}

/** Abilita o disabilita i suoni operativi */
export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(SFX_MUTED_KEY, enabled ? "false" : "true");
}

/** Recupera il volume operativo (da 0.0 a 1.0) */
export function getSoundVolume(): number {
  if (typeof window === "undefined" || !window.localStorage) return DEFAULT_VOLUME;
  const raw = window.localStorage.getItem(SFX_VOLUME_KEY);
  if (raw == null) return DEFAULT_VOLUME;
  const num = parseFloat(raw);
  return isNaN(num) ? DEFAULT_VOLUME : Math.max(0, Math.min(1, num));
}

/** Imposta il volume operativo (da 0.0 a 1.0) */
export function setSoundVolume(volume: number): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const clamped = Math.max(0, Math.min(1, volume));
  window.localStorage.setItem(SFX_VOLUME_KEY, clamped.toFixed(2));
}

/** Crea il bus di guadagno master proporzionale al volume utente */
function createMasterOut(ctx: AudioContext): GainNode {
  const master = ctx.createGain();
  const vol = getSoundVolume();
  master.gain.setValueAtTime(vol, ctx.currentTime);
  master.connect(ctx.destination);
  return master;
}

/**
 * 1. IL TOCCO D'OSSIDIANA (Micro-Click Meccanico di Manifattura)
 * Simula la rotazione di precisione di una ghiera di cronografo o scatto Leica.
 * Stratificazione: micro-transiente d'impatto passa-banda (1900 Hz, 3ms) +
 * risonanza vellutata d'ossidiana a 540 Hz (18ms).
 * Durata totale: 24ms. Zero latenza, zero affaticamento acustico.
 */
export function soundClick(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    // Strato A: Transiente d'impatto ad altissima definizione (micro-scatto)
    const oscTransient = ctx.createOscillator();
    const gainTransient = ctx.createGain();
    const filterTransient = ctx.createBiquadFilter();

    filterTransient.type = "bandpass";
    filterTransient.frequency.setValueAtTime(1900, t);
    filterTransient.Q.setValueAtTime(4.5, t);

    oscTransient.type = "sine";
    oscTransient.frequency.setValueAtTime(1900, t);
    oscTransient.frequency.exponentialRampToValueAtTime(580, t + 0.005);

    gainTransient.gain.setValueAtTime(0.0001, t);
    gainTransient.gain.linearRampToValueAtTime(0.12, t + 0.0008);
    gainTransient.gain.exponentialRampToValueAtTime(0.0001, t + 0.009);

    oscTransient.connect(filterTransient);
    filterTransient.connect(gainTransient);
    gainTransient.connect(master);

    oscTransient.start(t);
    oscTransient.stop(t + 0.012);

    // Strato B: Risonanza calda e smorzata del corpo d'ossidiana
    const oscBody = ctx.createOscillator();
    const gainBody = ctx.createGain();
    const filterBody = ctx.createBiquadFilter();

    filterBody.type = "lowpass";
    filterBody.frequency.setValueAtTime(1100, t + 0.003);

    oscBody.type = "sine";
    oscBody.frequency.setValueAtTime(540, t + 0.003);
    oscBody.frequency.exponentialRampToValueAtTime(280, t + 0.022);

    gainBody.gain.setValueAtTime(0.0001, t);
    gainBody.gain.setValueAtTime(0.0001, t + 0.003);
    gainBody.gain.linearRampToValueAtTime(0.09, t + 0.005);
    gainBody.gain.exponentialRampToValueAtTime(0.0001, t + 0.024);

    oscBody.connect(filterBody);
    filterBody.connect(gainBody);
    gainBody.connect(master);

    oscBody.start(t + 0.003);
    oscBody.stop(t + 0.025);
  } catch {
    // Web Audio non-blocking guard
  }
}

/**
 * 2. IL RINTOCCO DELL'INTEGRITÀ (Campana di Lucidità a 528 Hz + Battimento Alpha)
 * Risonanza dorata di raccoglimento e lucidità mentale.
 * Stratificazione:
 * - Fondamentale sacra Solfeggio a 528.0 Hz
 * - Battimento Alpha a 529.4 Hz (+1.4 Hz detune per indurre calma e rilassamento)
 * - Armonica cristallina a 1056 Hz (ottava setosa)
 * - Filtro passa-basso dinamico con smorzamento esponenziale naturale (3500 Hz -> 750 Hz)
 * Durata totale: 550ms.
 */
export function soundCheck(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    // Filtro biquad dinamico: si scalda progressivamente simulando il decadimento fisico
    const dynamicFilter = ctx.createBiquadFilter();
    dynamicFilter.type = "lowpass";
    dynamicFilter.frequency.setValueAtTime(3400, t);
    dynamicFilter.frequency.exponentialRampToValueAtTime(720, t + 0.5);
    dynamicFilter.Q.setValueAtTime(1.2, t);
    dynamicFilter.connect(master);

    // 1. Fondamentale 528 Hz (Solfeggio)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(528.0, t);

    gain1.gain.setValueAtTime(0.0001, t);
    gain1.gain.linearRampToValueAtTime(0.14, t + 0.004);
    gain1.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);

    osc1.connect(gain1);
    gain1.connect(dynamicFilter);

    // 2. Oscillatore gemello micro-detunato (+1.4 Hz battimento Alpha rilassante)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(529.4, t);

    gain2.gain.setValueAtTime(0.0001, t);
    gain2.gain.linearRampToValueAtTime(0.11, t + 0.004);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);

    osc2.connect(gain2);
    gain2.connect(dynamicFilter);

    // 3. Ottava superiore pura (1056 Hz, cristallo morbido)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1056.0, t);

    gain3.gain.setValueAtTime(0.0001, t);
    gain3.gain.linearRampToValueAtTime(0.045, t + 0.003);
    gain3.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);

    osc3.connect(gain3);
    gain3.connect(dynamicFilter);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);

    osc1.stop(t + 0.54);
    osc2.stop(t + 0.54);
    osc3.stop(t + 0.54);
  } catch {
    // Guard
  }
}

/**
 * 3. IL SIGILLO DI FUOCO (Fioritura Corale d'Organo a 432 Hz)
 * Accordo solenne aperto basato sull'intonazione aurea naturale a 432 Hz.
 * Voci simultanee a cascata micro-sfalsata (A3 216Hz, E4 324Hz, A4 432Hz, C#5 540Hz).
 * Utilizzato per: salvataggio piano operativo, trade registrato, attivazione Varco.
 * Durata totale: 850ms. Risonanza calda, avvolgente e maestosa.
 */
export function soundSuccess(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, t);
    filter.frequency.exponentialRampToValueAtTime(580, t + 0.8);
    filter.connect(master);

    const voices = [
      { freq: 216.0, delay: 0.000, vol: 0.12, decay: 0.85 }, // A3 Fondamentale calda
      { freq: 324.0, delay: 0.014, vol: 0.10, decay: 0.78 }, // E4 Quinta pura
      { freq: 432.0, delay: 0.028, vol: 0.09, decay: 0.75 }, // A4 Ottava aurea
      { freq: 540.0, delay: 0.044, vol: 0.07, decay: 0.68 }, // C#5 Terza di luce
    ];

    for (const v of voices) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = t + v.delay;

      osc.type = "sine";
      osc.frequency.setValueAtTime(v.freq, startTime);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(v.vol, startTime + 0.010);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + v.decay);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(startTime);
      osc.stop(startTime + v.decay + 0.02);
    }
  } catch {
    // Guard
  }
}

/**
 * 4. L'AVVISO DEL CUSTODE (Gong di Bronzo Monastico a 108 Hz — Arresto della Deriva)
 * Risonanza profonda e solenne volta ad arrestare l'impulsività (La Deriva)
 * e richiamare istantaneamente alla lucidità e alla disciplina stoica.
 * ZERO allarmismo acido da casinò: induce respirazione e presenza mentale.
 * Stratificazione:
 * - Fondamentale a 108 Hz (onda triangolo smorzata)
 * - Sub-armonica di corpo a 54 Hz (peso fisico nelle cuffie/speaker)
 * - Filtro passa-basso risonante a 360 Hz con decadimento a 140 Hz
 * Durata totale: 700ms.
 */
export function soundAlert(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(360, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.65);
    filter.Q.setValueAtTime(2.2, t);
    filter.connect(master);

    // 1. Fondamentale 108 Hz (Bronzo scuro)
    const oscMain = ctx.createOscillator();
    const gainMain = ctx.createGain();
    oscMain.type = "triangle";
    oscMain.frequency.setValueAtTime(108.0, t);

    gainMain.gain.setValueAtTime(0.0001, t);
    gainMain.gain.linearRampToValueAtTime(0.18, t + 0.006);
    gainMain.gain.exponentialRampToValueAtTime(0.0001, t + 0.68);

    oscMain.connect(gainMain);
    gainMain.connect(filter);

    // 2. Sub-corpo 54 Hz (Gravitas nel petto)
    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = "sine";
    oscSub.frequency.setValueAtTime(54.0, t);

    gainSub.gain.setValueAtTime(0.0001, t);
    gainSub.gain.linearRampToValueAtTime(0.14, t + 0.008);
    gainSub.gain.exponentialRampToValueAtTime(0.0001, t + 0.60);

    oscSub.connect(gainSub);
    gainSub.connect(filter);

    oscMain.start(t);
    oscSub.start(t);

    oscMain.stop(t + 0.70);
    oscSub.stop(t + 0.70);
  } catch {
    // Guard
  }
}

/**
 * 5. L'APOTEOSI (Cattedrale Sospesa ad Accordo Espanso)
 * Risonanza monumentale a 6 voci su intervalli puri pitagorici con riverbero simulato.
 * Accordo sospeso (C3, G3, C4, E4, G4, D5) che dona solennità architettonica
 * e celebra l'ascesa di Grado e il trionfo nelle Prove del Fuoco.
 * Durata totale: 1.4s.
 */
export function soundTrophy(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3600, t);
    filter.frequency.exponentialRampToValueAtTime(750, t + 1.3);
    filter.connect(master);

    const cathedralChord = [
      { freq: 130.81, delay: 0.00, vol: 0.13, decay: 1.35 }, // C3 Fondamento
      { freq: 196.00, delay: 0.02, vol: 0.11, decay: 1.30 }, // G3 Quinta
      { freq: 261.63, delay: 0.05, vol: 0.10, decay: 1.25 }, // C4 Centro
      { freq: 329.63, delay: 0.08, vol: 0.09, decay: 1.20 }, // E4 Terza
      { freq: 392.00, delay: 0.11, vol: 0.08, decay: 1.15 }, // G4 Brillantezza
      { freq: 587.33, delay: 0.15, vol: 0.06, decay: 1.05 }, // D5 Nona sospesa di gloria
    ];

    for (const v of cathedralChord) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = t + v.delay;

      osc.type = "sine";
      osc.frequency.setValueAtTime(v.freq, startTime);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(v.vol, startTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + v.decay);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(startTime);
      osc.stop(startTime + v.decay + 0.03);
    }
  } catch {
    // Guard
  }
}

/**
 * 6. IL SIGILLO D'AZIONE (Rintocco d'Oro a 432 Hz & Impatto d'Incudine a 72 Hz)
 * Risonanza monastica definitiva: simula l'apposizione fisica del sigillo
 * sull'ordine o la convalida dell'operazione ne Il Libro della Verità.
 * Convergenza assoluta. Esecuzione priva di esitazione.
 * Stratificazione:
 * - Fondamentale aurea 432.0 Hz (pura, decadimento lungo naturale 950ms)
 * - Micro-transiente di percussione d'incudine a 864 Hz (40ms)
 * - Sub-armonica di ancoraggio e gravitas a 72.0 Hz (radicamento stoico nel petto)
 * - Filtro passa-basso dinamico 2400 Hz -> 380 Hz con Q risonante
 * Durata totale: 980ms.
 */
export function soundSealOfAction(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(380, t + 0.9);
    filter.Q.setValueAtTime(2.0, t);
    filter.connect(master);

    // 1. Fondamentale aurea 432 Hz
    const oscMain = ctx.createOscillator();
    const gainMain = ctx.createGain();
    oscMain.type = "sine";
    oscMain.frequency.setValueAtTime(432.0, t);

    gainMain.gain.setValueAtTime(0.0001, t);
    gainMain.gain.linearRampToValueAtTime(0.18, t + 0.005);
    gainMain.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);

    oscMain.connect(gainMain);
    gainMain.connect(filter);

    // 2. Transiente d'impatto / incudine (864 Hz -> micro-colpo secco)
    const oscImpact = ctx.createOscillator();
    const gainImpact = ctx.createGain();
    oscImpact.type = "triangle";
    oscImpact.frequency.setValueAtTime(864.0, t);
    oscImpact.frequency.exponentialRampToValueAtTime(320.0, t + 0.04);

    gainImpact.gain.setValueAtTime(0.0001, t);
    gainImpact.gain.linearRampToValueAtTime(0.14, t + 0.002);
    gainImpact.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    oscImpact.connect(gainImpact);
    gainImpact.connect(filter);

    // 3. Sub-gravitas profonda 72 Hz
    const oscSub = ctx.createOscillator();
    const gainSub = ctx.createGain();
    oscSub.type = "sine";
    oscSub.frequency.setValueAtTime(72.0, t);

    gainSub.gain.setValueAtTime(0.0001, t);
    gainSub.gain.linearRampToValueAtTime(0.16, t + 0.010);
    gainSub.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);

    oscSub.connect(gainSub);
    gainSub.connect(filter);

    oscMain.start(t);
    oscImpact.start(t);
    oscSub.start(t);

    oscMain.stop(t + 0.98);
    oscImpact.stop(t + 0.06);
    oscSub.stop(t + 0.88);
  } catch {
    // Guard
  }
}

/**
 * 7. IL RINTOCCO DELLE CORRENTI MACRO (Acoustic Macro Sentinel)
 * Risuonatore solenne di pre-allerta macro a 2 stadi:
 * - "warning" (T-5 minuti): doppio rintocco caldo di campana monastica (144 Hz + 216 Hz)
 *   separato da 160ms per segnalare l'approssimarsi di un evento ad alto impatto.
 * - "imminent" (T-1 minuto / 60s): triplice rintocco cristallino aureo (216, 324, 432 Hz)
 *   accompagnato da sub-ancoraggio a 108 Hz che richiama la massima disciplina e presenza.
 */
export function soundMacroAlert(severity: "warning" | "imminent" = "warning"): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    if (severity === "warning") {
      // Doppio rintocco solenne di campana bronzea (144 Hz fondamentale + 216 Hz quinta aurea)
      const chimes = [
        { delay: 0.00, freq: 144.0, harmonic: 288.0, vol: 0.14, decay: 0.95 },
        { delay: 0.16, freq: 216.0, harmonic: 432.0, vol: 0.12, decay: 1.10 },
      ];

      for (const c of chimes) {
        const startTime = t + c.delay;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(650, startTime);
        filter.frequency.exponentialRampToValueAtTime(180, startTime + c.decay);
        filter.connect(master);

        // Fondamentale calda
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(c.freq, startTime);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(c.vol, startTime + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + c.decay);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(startTime);
        osc.stop(startTime + c.decay + 0.02);

        // Armonica superiore
        const oscH = ctx.createOscillator();
        const gainH = ctx.createGain();
        oscH.type = "sine";
        oscH.frequency.setValueAtTime(c.harmonic, startTime);

        gainH.gain.setValueAtTime(0.0001, t);
        gainH.gain.setValueAtTime(0.0001, startTime);
        gainH.gain.linearRampToValueAtTime(c.vol * 0.45, startTime + 0.006);
        gainH.gain.exponentialRampToValueAtTime(0.0001, startTime + c.decay * 0.7);

        oscH.connect(gainH);
        gainH.connect(filter);
        oscH.start(startTime);
        oscH.stop(startTime + c.decay * 0.7 + 0.02);
      }
    } else {
      // "imminent" (T-1m): triplice accordo aureo (216 Hz, 324 Hz, 432 Hz) + sub-ancoraggio 108 Hz
      const strikes = [
        { delay: 0.00, freq: 216.0, vol: 0.15, decay: 0.85 },
        { delay: 0.12, freq: 324.0, vol: 0.13, decay: 0.90 },
        { delay: 0.24, freq: 432.0, vol: 0.11, decay: 1.15 },
      ];

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1200, t);
      filter.frequency.exponentialRampToValueAtTime(260, t + 1.4);
      filter.connect(master);

      // Sub-ancoraggio monastico a 108 Hz
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = "triangle";
      subOsc.frequency.setValueAtTime(108.0, t);
      subGain.gain.setValueAtTime(0.0001, t);
      subGain.gain.linearRampToValueAtTime(0.12, t + 0.015);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      subOsc.connect(subGain);
      subGain.connect(filter);
      subOsc.start(t);
      subOsc.stop(t + 1.4);

      for (const s of strikes) {
        const startTime = t + s.delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(s.freq, startTime);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(s.vol, startTime + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + s.decay);

        osc.connect(gain);
        gain.connect(filter);
        osc.start(startTime);
        osc.stop(startTime + s.decay + 0.02);
      }
    }
  } catch {
    // Guard
  }
}

/**
 * 8. TELEMETRIA ACUSTICA DELLE ARENE: VITTORIA TRADE (432 Hz + 864 Hz)
 * Rintocco armonico cristallino pitagorico all'esecuzione di un trade in profitto.
 * isSelf=true: squillo dorato più brillante con shimmer a 1296 Hz.
 * isSelf=false: rintocco sommesso e nitido a 864 Hz per telemetria avversario (zero distrazione).
 */
export function soundArenaTradeWin(isSelf = false): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const gain = ctx.createGain();
    const vol = isSelf ? 0.22 : 0.08;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (isSelf ? 0.35 : 0.18));
    gain.connect(master);

    // 432 Hz fundamental
    const osc432 = ctx.createOscillator();
    osc432.type = "sine";
    osc432.frequency.setValueAtTime(432.0, t);
    osc432.connect(gain);
    osc432.start(t);
    osc432.stop(t + (isSelf ? 0.36 : 0.19));

    // 864 Hz octave harmonic
    const osc864 = ctx.createOscillator();
    osc864.type = "sine";
    osc864.frequency.setValueAtTime(864.0, t);
    osc864.connect(gain);
    osc864.start(t);
    osc864.stop(t + (isSelf ? 0.36 : 0.19));

    // If self: overtone crystalline 1296 Hz
    if (isSelf) {
      const osc1296 = ctx.createOscillator();
      osc1296.type = "triangle";
      osc1296.frequency.setValueAtTime(1296.0, t);
      const gain1296 = ctx.createGain();
      gain1296.gain.setValueAtTime(0.0001, t);
      gain1296.gain.linearRampToValueAtTime(0.08, t + 0.003);
      gain1296.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc1296.connect(gain1296);
      gain1296.connect(master);
      osc1296.start(t);
      osc1296.stop(t + 0.26);
    }
  } catch {
    // Guard
  }
}

/**
 * 9. TELEMETRIA ACUSTICA DELLE ARENE: PERDITA TRADE / STOP LOSS (216 Hz + 144 Hz)
 * Risonanza stoica a bassa frequenza filtrata per preservare l'equilibrio emotivo dell'Operatore.
 */
export function soundArenaTradeLoss(isSelf = false): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(360, t);
    filter.connect(master);

    const gain = ctx.createGain();
    const vol = isSelf ? 0.20 : 0.07;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + (isSelf ? 0.28 : 0.15));
    gain.connect(filter);

    // 216 Hz + 144 Hz
    const osc216 = ctx.createOscillator();
    osc216.type = "triangle";
    osc216.frequency.setValueAtTime(216.0, t);
    osc216.connect(gain);
    osc216.start(t);
    osc216.stop(t + (isSelf ? 0.30 : 0.16));

    const osc144 = ctx.createOscillator();
    osc144.type = "sine";
    osc144.frequency.setValueAtTime(144.0, t);
    osc144.connect(gain);
    osc144.start(t);
    osc144.stop(t + (isSelf ? 0.30 : 0.16));
  } catch {
    // Guard
  }
}

/**
 * 10. GONG DI GIUDIZIO DELL'ARENA (Squalifica Drawdown / Regola Violata)
 * Gong solenne a 144 Hz con decadimento profondo a 500ms.
 */
export function soundArenaDisqualification(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(480, t);
    filter.frequency.exponentialRampToValueAtTime(160, t + 0.5);
    filter.connect(master);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
    gain.connect(filter);

    const osc144 = ctx.createOscillator();
    osc144.type = "triangle";
    osc144.frequency.setValueAtTime(144.0, t);
    osc144.connect(gain);

    const osc216 = ctx.createOscillator();
    osc216.type = "sine";
    osc216.frequency.setValueAtTime(216.0, t);
    osc216.connect(gain);

    osc144.start(t);
    osc216.start(t);
    osc144.stop(t + 0.55);
    osc216.stop(t + 0.55);
  } catch {
    // Guard
  }
}

/**
 * 11. FANFARA SOVRANA DEL FUOCO (Inizio Battaglia / Lancio Duello)
 * Arpeggio ascendente armonico 216 Hz -> 432 Hz -> 864 Hz.
 */
export function soundArenaLaunch(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const notes = [
      { freq: 216.0, time: 0, dur: 0.12 },
      { freq: 432.0, time: 0.09, dur: 0.14 },
      { freq: 864.0, time: 0.18, dur: 0.35 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, t + note.time);

      gain.gain.setValueAtTime(0.0001, t + note.time);
      gain.gain.linearRampToValueAtTime(0.18, t + note.time + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.time + note.dur);

      osc.connect(gain);
      gain.connect(master);
      osc.start(t + note.time);
      osc.stop(t + note.time + note.dur + 0.02);
    }
  } catch {
    // Guard
  }
}

/**
 * 12. RINTOCCO COUNTDOWN ARENA (3, 2, 1)
 * Risonanza aurea a 432 Hz da 50ms per i secondi di preparazione al varco.
 */
export function soundArenaCountdownTick(secondsLeft: number): void {
  if (secondsLeft <= 0) {
    soundArenaLaunch();
    return;
  }
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    gain.connect(master);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const freq = secondsLeft === 1 ? 540.0 : 432.0;
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.07);
  } catch {
    // Guard
  }
}

// ── SINESTESIA MULTISENSORIALE (Fusione Tattico-Acustica) ───────────────────

/** Tocco sinestetico leggero: micro-scatto d'ossidiana + micro-impulso 10ms */
export function synestheticClick(): void {
  soundClick();
  hapticLight();
}

/** Tocco sinestetico di convalida: campana 528 Hz (Alpha) + conferma aptica */
export function synestheticCheck(): void {
  soundCheck();
  hapticSuccess();
}

/** Conferma sinestetica: fioritura d'organo a 432 Hz + impatto nobile */
export function synestheticConfirm(): void {
  soundSuccess();
  hapticMedium();
}

/** Allerta sinestetica: gong 108 Hz di disciplina + avviso aptico */
export function synestheticAlert(): void {
  soundAlert();
  hapticWarning();
}

/** Apoteosi sinestetica: cattedrale sospesa a 6 voci + impulso regale */
export function synestheticTrophy(): void {
  soundTrophy();
  hapticSovereign();
}

/** Sigillo d'Azione sinestetico: rintocco d'oro 432 Hz con impatto d'incudine + impulso regale */
export function synestheticSealOfAction(): void {
  soundSealOfAction();
  hapticSovereign();
}

/** Allerta Macro sinestetica: rintocco delle correnti macro + avviso aptico calibrato */
export function synestheticMacroAlert(severity: "warning" | "imminent" = "warning"): void {
  soundMacroAlert(severity);
  if (severity === "imminent") {
    hapticWarning();
  } else {
    hapticMedium();
  }
}

/** Segnale sinestetico di trade vincente in Arena (Audio armonico 432/864 Hz + aptica) */
export function synestheticArenaTradeWin(isSelf = false): void {
  soundArenaTradeWin(isSelf);
  if (isSelf) {
    hapticSuccess();
  } else {
    hapticLight();
  }
}

/** Segnale sinestetico di trade perdente in Arena (Audio stoico 216/144 Hz + aptica) */
export function synestheticArenaTradeLoss(isSelf = false): void {
  soundArenaTradeLoss(isSelf);
  if (isSelf) {
    hapticWarning();
  }
}

/** Gong sinestetico di squalifica sfidante (Audio 144 Hz + aptica solenne) */
export function synestheticArenaDisqualification(): void {
  soundArenaDisqualification();
  hapticWarning();
}

/** Lancio della Prova del Fuoco (Fanfara aurea 216->432->864 Hz + impulso sovrano) */
export function synestheticArenaLaunch(): void {
  soundArenaLaunch();
  hapticSovereign();
}

/** Tick countdown arena con impulso tattile leggero */
export function synestheticArenaCountdown(secondsLeft: number): void {
  soundArenaCountdownTick(secondsLeft);
  if (secondsLeft <= 0) {
    hapticSovereign();
  } else {
    hapticLight();
  }
}

// ── ATMOSFERA ACUSTICA CONTINUA: DEEP WORK ZEN (432 Hz + Flusso Alpha) ─────

interface AmbienceNodes {
  ctx: AudioContext;
  masterGain: GainNode;
  oscDrone1: OscillatorNode;
  oscDrone2: OscillatorNode;
  oscDrone3?: OscillatorNode;
  noiseSource: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  mode: AmbienceFrequencyMode;
}

export type AmbienceFrequencyMode = "432hz" | "528hz";

let activeAmbience: AmbienceNodes | null = null;
let ambienceActiveState = false;
let currentAmbienceMode: AmbienceFrequencyMode = "432hz";
let currentRiskResonanceRatio = 0.0;

type AmbienceListener = (active: boolean) => void;
const ambienceListeners = new Set<AmbienceListener>();

function notifyAmbienceListeners() {
  for (const listener of ambienceListeners) {
    try {
      listener(ambienceActiveState);
    } catch {
      // Guard
    }
  }
}

/** Iscrive un componente alla telemetria di attivazione dell'atmosfera acustica Deep Work */
export function subscribeDeepWorkAmbience(listener: AmbienceListener): () => void {
  ambienceListeners.add(listener);
  try {
    listener(ambienceActiveState);
  } catch {
    // Guard
  }
  return () => {
    ambienceListeners.delete(listener);
  };
}

/** Verifica se l'atmosfera acustica Deep Work è attualmente in esecuzione */
export function isDeepWorkAmbienceActive(): boolean {
  return ambienceActiveState;
}

/** Restituisce la frequenza armonica attiva dell'atmosfera acustica */
export function getDeepWorkAmbienceMode(): AmbienceFrequencyMode {
  return currentAmbienceMode;
}

/** Avvia il tappeto acustico continuo per la concentrazione profonda (432 Hz naturale o 528 Hz Solfeggio + Alpha 1.4 Hz + Brown Noise) */
export function startDeepWorkAmbience(mode: AmbienceFrequencyMode = "432hz"): void {
  const ctx = getAudioContext();
  if (!ctx || !isSoundEnabled()) return;

  if (activeAmbience) {
    if (activeAmbience.mode !== mode) {
      currentAmbienceMode = mode;
      activeAmbience.mode = mode;
      try {
        const t = ctx.currentTime;
        const freq1 = mode === "528hz" ? 264.0 : 216.0;
        const freq2 = mode === "528hz" ? 265.4 : 217.4;
        const freq3 = mode === "528hz" ? 396.0 : 324.0;
        activeAmbience.oscDrone1.frequency.exponentialRampToValueAtTime(freq1, t + 1.2);
        activeAmbience.oscDrone2.frequency.exponentialRampToValueAtTime(freq2, t + 1.2);
        if (activeAmbience.oscDrone3) {
          activeAmbience.oscDrone3.frequency.exponentialRampToValueAtTime(freq3, t + 1.2);
        }
        notifyAmbienceListeners();
      } catch {
        // Guard
      }
    }
    return;
  }

  currentAmbienceMode = mode;

  try {
    const t = ctx.currentTime;
    const masterGain = ctx.createGain();
    const targetVol = Math.max(0.001, getSoundVolume() * 0.12);

    masterGain.gain.setValueAtTime(0.0001, t);
    masterGain.gain.exponentialRampToValueAtTime(targetVol, t + 2.5);
    masterGain.connect(ctx.destination);

    const freq1 = mode === "528hz" ? 264.0 : 216.0;
    const freq2 = mode === "528hz" ? 265.4 : 217.4;
    const freq3 = mode === "528hz" ? 396.0 : 324.0;

    // 1. Drone 1: Fondamentale naturale (A3 aureo 216Hz o C4 solfeggio 264Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(freq1, t);
    gain1.gain.setValueAtTime(0.5, t);
    osc1.connect(gain1);
    gain1.connect(masterGain);

    // 2. Drone 2: (+1.4 Hz micro-battimento Alpha continuo)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(freq2, t);
    gain2.gain.setValueAtTime(0.45, t);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    // 3. Drone 3: Armonica di supporto (324Hz quinta aurea o 396Hz Solfeggio)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(freq3, t);
    gain3.gain.setValueAtTime(0.25, t);
    osc3.connect(gain3);
    gain3.connect(masterGain);

    // 4. Tappeto Brown Noise vellutato (buffer circolare da 2 secondi)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.4;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Filtro biquad passa-basso risonante
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(360, t);
    noiseFilter.Q.setValueAtTime(1.1, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    osc1.start(t);
    osc2.start(t);
    osc3.start(t);
    noiseSource.start(t);

    activeAmbience = {
      ctx,
      masterGain,
      oscDrone1: osc1,
      oscDrone2: osc2,
      oscDrone3: osc3,
      noiseSource,
      noiseFilter,
      mode,
    };
    ambienceActiveState = true;
    notifyAmbienceListeners();

    // Se un livello di rischio è già impostato, applica la modulazione immediatamente
    if (currentRiskResonanceRatio > 0) {
      setRiskResonanceLevel(currentRiskResonanceRatio);
    }
  } catch (err) {
    console.warn("Could not start deep work ambience:", err);
  }
}

/** Arresta con dissolvenza morbida l'atmosfera acustica Deep Work */
export function stopDeepWorkAmbience(): void {
  if (!activeAmbience) {
    if (ambienceActiveState) {
      ambienceActiveState = false;
      notifyAmbienceListeners();
    }
    return;
  }
  try {
    const { ctx, masterGain, oscDrone1, oscDrone2, oscDrone3, noiseSource } = activeAmbience;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);

    setTimeout(() => {
      try {
        oscDrone1.stop();
        oscDrone2.stop();
        if (oscDrone3) oscDrone3.stop();
        noiseSource.stop();
        masterGain.disconnect();
      } catch {
        // Guard
      }
    }, 1900);
  } catch {
    // Guard
  } finally {
    activeAmbience = null;
    ambienceActiveState = false;
    notifyAmbienceListeners();
  }
}

/** Commuta lo stato dell'atmosfera acustica continua (True = Attiva, False = Disattivata) */
export function toggleDeepWorkAmbience(mode?: AmbienceFrequencyMode): boolean {
  if (ambienceActiveState) {
    if (mode && mode !== currentAmbienceMode) {
      startDeepWorkAmbience(mode);
      return true;
    }
    stopDeepWorkAmbience();
    return false;
  } else {
    startDeepWorkAmbience(mode ?? "432hz");
    return true;
  }
}

/**
 * Modulazione Armonica Adattiva del Rischio (Adaptive Risk Resonance)
 * Modula fluidamente l'atmosfera acustica continua in base al drawdown/rischio dell'Operatore.
 * Quando il rischio sale, abbassa la fondamentale verso 108 Hz (monastic anchor),
 * rallenta il micro-battimento Alpha da 1.4 Hz a 0.9 Hz e riscalda il Brown noise per calmare la Deriva.
 * @param ratio rapporto tra rischio/drawdown attuale e massimo consentito (0.0 ad 1.0)
 */
export function setRiskResonanceLevel(ratio: number): void {
  const clamped = Math.max(0, Math.min(1, ratio));
  currentRiskResonanceRatio = clamped;

  if (!activeAmbience) return;

  try {
    const { ctx, oscDrone1, oscDrone2, oscDrone3, noiseFilter } = activeAmbience;
    const t = ctx.currentTime;
    const transitionSec = 2.0;

    const targetFund = 216.0 - clamped * 108.0; // 216 Hz -> 108 Hz
    const targetBeat = 1.4 - clamped * 0.5; // 1.4 Hz -> 0.9 Hz
    const targetFifth = (216.0 - clamped * 108.0) * 1.5; // quinta aurea correlata
    const targetFilterFreq = 360.0 - clamped * 180.0; // 360 Hz -> 180 Hz

    oscDrone1.frequency.cancelScheduledValues(t);
    oscDrone1.frequency.setValueAtTime(oscDrone1.frequency.value, t);
    oscDrone1.frequency.linearRampToValueAtTime(targetFund, t + transitionSec);

    oscDrone2.frequency.cancelScheduledValues(t);
    oscDrone2.frequency.setValueAtTime(oscDrone2.frequency.value, t);
    oscDrone2.frequency.linearRampToValueAtTime(targetFund + targetBeat, t + transitionSec);

    if (oscDrone3) {
      oscDrone3.frequency.cancelScheduledValues(t);
      oscDrone3.frequency.setValueAtTime(oscDrone3.frequency.value, t);
      oscDrone3.frequency.linearRampToValueAtTime(targetFifth, t + transitionSec);
    }

    if (noiseFilter) {
      noiseFilter.frequency.cancelScheduledValues(t);
      noiseFilter.frequency.setValueAtTime(noiseFilter.frequency.value, t);
      noiseFilter.frequency.linearRampToValueAtTime(targetFilterFreq, t + transitionSec);
    }
  } catch {
    // Guard
  }
}

/** Recupera l'attuale livello di modulazione del rischio (da 0.0 a 1.0) */
export function getRiskResonanceLevel(): number {
  return currentRiskResonanceRatio;
}

/**
 * Modulazione Bio-Feedback Adattiva Deep Work per Battito Cardiaco (BPM)
 * Quando l'atmosfera 432 Hz Zen è attiva, calibra delicatamente la frequenza
 * del drone, la velocità del battimento binaurale e il filtro del Brown Noise
 * in risposta all'innalzamento dei BPM, inducendo decelerazione vagale e calma stoica.
 * @param bpm Frequenza cardiaca rilevata (reale da Smartwatch BLE o stima telemetrica)
 */
export function modulateDeepWorkByBpm(bpm: number): void {
  const safeBpm = Math.max(50, Math.min(180, bpm));
  // 60 BPM o meno -> ratio 0.0 (Zen puro)
  // 75 BPM -> ratio ~0.3
  // 92 BPM -> ratio ~0.8 (Allerta Deriva)
  // 100+ BPM -> ratio 1.0 (Intervento Neocorticale Massimo)
  const bpmRatio = Math.max(0, Math.min(1, (safeBpm - 60) / 40));
  const combined = Math.max(currentRiskResonanceRatio, bpmRatio);
  setRiskResonanceLevel(combined);
}

// ── RITUALE DEL RESPIRO TATTICO (4-7-8 Biofeedback Acustico) ───────────────

interface BreathAudioNodes {
  ctx: AudioContext;
  masterGain: GainNode;
  oscillators: OscillatorNode[];
  noiseSource?: AudioBufferSourceNode;
}

let activeBreathAudio: BreathAudioNodes | null = null;

/** Arresta istantaneamente qualsiasi audio associato al rituale di respirazione */
export function stopBreathAudio(): void {
  if (!activeBreathAudio) return;
  const current = activeBreathAudio;
  activeBreathAudio = null;
  try {
    const { ctx, masterGain, oscillators, noiseSource } = current;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    setTimeout(() => {
      try {
        for (const osc of oscillators) {
          osc.stop();
          osc.disconnect();
        }
        if (noiseSource) {
          noiseSource.stop();
          noiseSource.disconnect();
        }
        masterGain.disconnect();
      } catch {
        // Guard
      }
    }, 150);
  } catch {
    // Guard
  }
}

/** Fase 1: Inspirazione 4s (Salita armonica dolce da 216 Hz a 432 Hz con apertura filtro e supporto armonico continuo) */
export function playBreathInhale(durationSec = 4): void {
  stopBreathAudio();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const targetVol = Math.max(0.001, getSoundVolume() * 0.16);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, t);
    masterGain.gain.linearRampToValueAtTime(targetVol, t + 0.8);
    masterGain.gain.setValueAtTime(targetVol, t + durationSec - 0.2);
    // Transizione morbida di tenuta invece di spegnersi di colpo
    masterGain.gain.linearRampToValueAtTime(targetVol * 0.7, t + durationSec);
    masterGain.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(260, t);
    filter.frequency.exponentialRampToValueAtTime(640, t + durationSec);
    filter.connect(masterGain);

    // Fondamentale ascendente
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(216.0, t);
    osc.frequency.exponentialRampToValueAtTime(432.0, t + durationSec);
    osc.connect(filter);

    // Sub-armonica di calore e profondità (108 Hz -> 216 Hz)
    const subOsc = ctx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(108.0, t);
    subOsc.frequency.exponentialRampToValueAtTime(216.0, t + durationSec);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.3, t);
    subOsc.connect(subGain);
    subGain.connect(filter);

    osc.start(t);
    subOsc.start(t);
    // Durata estesa di sicurezza per evitare cadute a vuoto prima del tick successivo
    const safeStop = t + durationSec + 5.0;
    osc.stop(safeStop);
    subOsc.stop(safeStop);

    activeBreathAudio = {
      ctx,
      masterGain,
      oscillators: [osc, subOsc],
    };
  } catch {
    // Guard
  }
}

/** Fase 2: Tenuta / Apnea Cosciente 7s (Accordo puro sospeso 432 Hz + 648 Hz con armonica aurea) */
export function playBreathHold(durationSec = 7): void {
  stopBreathAudio();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const targetVol = Math.max(0.001, getSoundVolume() * 0.12);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, t);
    masterGain.gain.linearRampToValueAtTime(targetVol, t + 0.6);
    masterGain.gain.setValueAtTime(targetVol, t + durationSec - 0.3);
    masterGain.gain.linearRampToValueAtTime(targetVol * 0.7, t + durationSec);
    masterGain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(432.0, t);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(648.0, t); // Quinta pura E5
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.35, t);
    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc1.connect(masterGain);

    osc1.start(t);
    osc2.start(t);
    const safeStop = t + durationSec + 5.0;
    osc1.stop(safeStop);
    osc2.stop(safeStop);

    activeBreathAudio = {
      ctx,
      masterGain,
      oscillators: [osc1, osc2],
    };
  } catch {
    // Guard
  }
}

/** Fase 3: Espirazione Diaframmatica 8s (Discesa morbida da 432 Hz a 108 Hz con Brown Noise vellutato) */
export function playBreathExhale(durationSec = 8): void {
  stopBreathAudio();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const targetVol = Math.max(0.001, getSoundVolume() * 0.15);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, t);
    masterGain.gain.linearRampToValueAtTime(targetVol, t + 0.8);
    masterGain.gain.setValueAtTime(targetVol * 0.85, t + durationSec - 0.6);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + durationSec + 0.8);
    masterGain.connect(ctx.destination);

    // Tono discendente distensivo
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(432.0, t);
    osc.frequency.exponentialRampToValueAtTime(108.0, t + durationSec);
    osc.connect(masterGain);

    // Brown noise filtrato per respiro oceanico diaframmatico
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 1.8;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(450, t);
    noiseFilter.frequency.exponentialRampToValueAtTime(120, t + durationSec);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.35, t);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    osc.start(t);
    noiseSource.start(t);
    const safeStop = t + durationSec + 5.0;
    osc.stop(safeStop);
    noiseSource.stop(safeStop);

    activeBreathAudio = {
      ctx,
      masterGain,
      oscillators: [osc],
      noiseSource,
    };
  } catch {
    // Guard
  }
}

/** Completamento del Rituale: Campana dorata di Allineamento (216, 432, 864 Hz) */
export function playBreathComplete(): void {
  stopBreathAudio();
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const t = ctx.currentTime;
    const master = createMasterOut(ctx);
    const freqs = [216.0, 432.0, 864.0];
    const decay = 3.2;

    for (const f of freqs) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + decay);

      osc.connect(gain);
      gain.connect(master);

      osc.start(t);
      osc.stop(t + decay + 0.05);
    }
  } catch {
    // Guard
  }
}

// ─── BIO-TELEMETRIA CARDIACA PROCEDURALE (Replay Psychoacoustic HUD) ───────────
// Sintetizza in tempo reale una doppia pulsazione ventricolare ("lub-dub")
// modellata sulla fisica cardiaca e accordata sulle sub-frequenze telluriche (54 Hz -> 36 Hz)
// con accelerazione dinamica guidata dalla prossimità allo Stop Loss o volatilità.

const HEARTBEAT_MUTED_KEY = "aureus_replay_heartbeat_muted";
const HEARTBEAT_VOLUME_KEY = "aureus_replay_heartbeat_volume";
const SL_PROXIMITY_THRESHOLD_KEY = "aureus_replay_sl_threshold";
const VIGNETTE_OVERLAY_ENABLED_KEY = "aureus_replay_vignette_enabled";

const DEFAULT_HEARTBEAT_VOLUME = 0.8;
const DEFAULT_SL_THRESHOLD = 0.25;

export function isHeartbeatSoundMuted(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  return window.localStorage.getItem(HEARTBEAT_MUTED_KEY) === "true";
}

export function setHeartbeatSoundMuted(muted: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(HEARTBEAT_MUTED_KEY, muted ? "true" : "false");
  if (muted && activeHeartbeat) {
    stopProceduralHeartbeat();
  }
}

export function getHeartbeatVolume(): number {
  if (typeof window === "undefined" || !window.localStorage) return DEFAULT_HEARTBEAT_VOLUME;
  const raw = window.localStorage.getItem(HEARTBEAT_VOLUME_KEY);
  if (raw == null) return DEFAULT_HEARTBEAT_VOLUME;
  const num = parseFloat(raw);
  return isNaN(num) ? DEFAULT_HEARTBEAT_VOLUME : Math.max(0.1, Math.min(1.0, num));
}

export function setHeartbeatVolume(volume: number): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const clamped = Math.max(0.1, Math.min(1.0, volume));
  window.localStorage.setItem(HEARTBEAT_VOLUME_KEY, clamped.toFixed(2));
  if (activeHeartbeat) {
    try {
      const vol = getSoundVolume() * clamped;
      const t = activeHeartbeat.ctx.currentTime;
      activeHeartbeat.masterGain.gain.setValueAtTime(vol, t);
    } catch {}
  }
}

export function getStopLossProximityThreshold(): number {
  if (typeof window === "undefined" || !window.localStorage) return DEFAULT_SL_THRESHOLD;
  const raw = window.localStorage.getItem(SL_PROXIMITY_THRESHOLD_KEY);
  if (raw == null) return DEFAULT_SL_THRESHOLD;
  const num = parseFloat(raw);
  return isNaN(num) ? DEFAULT_SL_THRESHOLD : Math.max(0.1, Math.min(0.4, num));
}

export function setStopLossProximityThreshold(threshold: number): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  const clamped = Math.max(0.1, Math.min(0.4, threshold));
  window.localStorage.setItem(SL_PROXIMITY_THRESHOLD_KEY, clamped.toFixed(2));
}

export function isVignetteOverlayEnabled(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return true;
  return window.localStorage.getItem(VIGNETTE_OVERLAY_ENABLED_KEY) !== "false";
}

export function setVignetteOverlayEnabled(enabled: boolean): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(VIGNETTE_OVERLAY_ENABLED_KEY, enabled ? "true" : "false");
}

interface HeartbeatEngineState {
  ctx: AudioContext;
  masterGain: GainNode;
  bpm: number;
  intensity: number; // 0.0 (calma) to 1.0 (massimo stress operativo)
  timerId: ReturnType<typeof setInterval> | null;
  nextBeatTime: number;
}

let activeHeartbeat: HeartbeatEngineState | null = null;
type HeartbeatListener = (active: boolean, bpm: number) => void;
const heartbeatListeners = new Set<HeartbeatListener>();

function notifyHeartbeatListeners(active: boolean, bpm: number): void {
  for (const listener of heartbeatListeners) {
    try {
      listener(active, bpm);
    } catch {
      // Guard
    }
  }
}

export function subscribeHeartbeat(listener: HeartbeatListener): () => void {
  heartbeatListeners.add(listener);
  try {
    listener(isHeartbeatActive(), getHeartbeatBpm());
  } catch {
    // Guard
  }
  return () => {
    heartbeatListeners.delete(listener);
  };
}

export function isHeartbeatActive(): boolean {
  return activeHeartbeat !== null;
}

export function getHeartbeatBpm(): number {
  return activeHeartbeat ? activeHeartbeat.bpm : 60;
}

function playSingleHeartbeat(
  ctx: AudioContext,
  masterGain: GainNode,
  time: number,
  bpm: number,
  intensity: number,
): void {
  try {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));

    // ── Primo Tocco Cardiaco: "Lub" (S1 - Valvole atrio-ventricolari) ──
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();

    filter1.type = "lowpass";
    filter1.frequency.setValueAtTime(110 + clampedIntensity * 40, time);
    filter1.Q.setValueAtTime(1.8, time);

    osc1.type = "sine";
    osc1.frequency.setValueAtTime(54, time);
    osc1.frequency.exponentialRampToValueAtTime(36, time + 0.08);

    const peak1 = 0.10 + clampedIntensity * 0.08;
    gain1.gain.setValueAtTime(0.0001, time);
    gain1.gain.linearRampToValueAtTime(peak1, time + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, time + 0.085);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(time);
    osc1.stop(time + 0.09);

    // ── Secondo Tocco Cardiaco: "Dub" (S2 - Valvole semilunari) ──
    const delay = Math.max(0.10, 0.14 * (60 / Math.max(45, bpm)));
    const time2 = time + delay;

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();

    filter2.type = "lowpass";
    filter2.frequency.setValueAtTime(125 + clampedIntensity * 45, time2);
    filter2.Q.setValueAtTime(1.6, time2);

    osc2.type = "sine";
    osc2.frequency.setValueAtTime(68, time2);
    osc2.frequency.exponentialRampToValueAtTime(46, time2 + 0.06);

    const peak2 = 0.07 + clampedIntensity * 0.06;
    gain2.gain.setValueAtTime(0.0001, time2);
    gain2.gain.linearRampToValueAtTime(peak2, time2 + 0.012);
    gain2.gain.exponentialRampToValueAtTime(0.0001, time2 + 0.07);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(time2);
    osc2.stop(time2 + 0.075);
  } catch {
    // Guard
  }
}

const SCHEDULE_AHEAD_TIME = 0.15;

function scheduleHeartbeatTicks(): void {
  if (!activeHeartbeat) return;
  const { ctx, masterGain } = activeHeartbeat;
  if (!ctx || ctx.state === "closed") return;

  try {
    const current = ctx.currentTime;
    while (activeHeartbeat.nextBeatTime < current + SCHEDULE_AHEAD_TIME) {
      const beatTime = Math.max(current, activeHeartbeat.nextBeatTime);
      playSingleHeartbeat(
        ctx,
        masterGain,
        beatTime,
        activeHeartbeat.bpm,
        activeHeartbeat.intensity,
      );
      const intervalSec = 60.0 / Math.max(45, Math.min(180, activeHeartbeat.bpm));
      activeHeartbeat.nextBeatTime = beatTime + intervalSec;
    }
  } catch {
    // Guard
  }
}

export function startProceduralHeartbeat(initialBpm = 60, intensity = 0.2): void {
  if (!isSoundEnabled() || isHeartbeatSoundMuted()) return;

  const targetBpm = Math.max(45, Math.min(180, Math.round(initialBpm)));
  const targetIntensity = Math.max(0, Math.min(1, intensity));

  if (activeHeartbeat) {
    setHeartbeatBpm(targetBpm, targetIntensity);
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const master = ctx.createGain();
    const vol = getSoundVolume() * getHeartbeatVolume();
    master.gain.setValueAtTime(vol, ctx.currentTime);
    master.connect(ctx.destination);

    activeHeartbeat = {
      ctx,
      masterGain: master,
      bpm: targetBpm,
      intensity: targetIntensity,
      nextBeatTime: ctx.currentTime + 0.02,
      timerId: null,
    };

    activeHeartbeat.timerId = setInterval(scheduleHeartbeatTicks, 40);
    scheduleHeartbeatTicks();
    notifyHeartbeatListeners(true, targetBpm);
  } catch {
    activeHeartbeat = null;
  }
}

export function setHeartbeatBpm(bpm: number, intensity?: number): void {
  const targetBpm = Math.max(45, Math.min(180, Math.round(bpm)));
  if (!activeHeartbeat) {
    if (isSoundEnabled() && !isHeartbeatSoundMuted()) {
      startProceduralHeartbeat(targetBpm, intensity ?? 0.2);
    }
    return;
  }

  activeHeartbeat.bpm = targetBpm;
  if (intensity != null) {
    activeHeartbeat.intensity = Math.max(0, Math.min(1, intensity));
  }
  notifyHeartbeatListeners(true, targetBpm);
}

export function stopProceduralHeartbeat(): void {
  if (!activeHeartbeat) return;
  try {
    if (activeHeartbeat.timerId) {
      clearInterval(activeHeartbeat.timerId);
    }
    const { ctx, masterGain } = activeHeartbeat;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    setTimeout(() => {
      try {
        masterGain.disconnect();
      } catch {}
    }, 100);
  } catch {
    // Guard
  } finally {
    activeHeartbeat = null;
    notifyHeartbeatListeners(false, 60);
  }
}
