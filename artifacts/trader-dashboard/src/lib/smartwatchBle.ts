/**
 * AUREUS PROTOCOL — Motore di Connessione Smartwatch & Wearable Cardio BLE
 *
 * Connessione wireless a bassissima latenza tramite Web Bluetooth API (GATT Standard)
 * per il monitoraggio in tempo reale del battito cardiaco (BPM) e variabilità HRV.
 *
 * Compatibilità Wearable:
 * - Apple Watch (tramite broadcast BLE via app HeartCast, BlueHeart, ECHO o Heartbeatz)
 * - Garmin (Forerunner, Fenix, Venu, Epix via modalità nativa "Trasmetti FC / Broadcast HR")
 * - Polar (Polar H10, Verity Sense, Vantage, Grit X)
 * - Whoop (Whoop 4.0 BLE Broadcast Mode)
 * - Suunto, Coros, Wahoo, Scosche e qualsiasi fascia/bracciale cardio standard Bluetooth 4.0/5.0
 *
 * Specifiche Bluetooth SIG:
 * - Heart Rate Service UUID: 0x180D (0000180d-0000-1000-8000-00805f9b34fb)
 * - Heart Rate Measurement Characteristic UUID: 0x2A37 (00002a37-0000-1000-8000-00805f9b34fb)
 * - Battery Service UUID: 0x180F / Battery Level UUID: 0x2A19 (opzionale)
 */

export type HeartRateZone = "zen" | "vigilant" | "ruby_drift";

export type SmartWatchConnectionStatus =
  | "disconnected"
  | "scanning"
  | "connecting"
  | "connected"
  | "simulated";

export interface HeartRateSample {
  time: number;
  bpm: number;
  rrIntervalMs?: number;
}

export interface SmartWatchHeartRateState {
  bpm: number;
  status: SmartWatchConnectionStatus;
  deviceName?: string;
  batteryLevel?: number;
  sensorContact?: boolean;
  rrIntervalMs?: number;
  hrvRmssd?: number;
  zone: HeartRateZone;
  lastHeartbeatTime?: number;
  history: HeartRateSample[];
  error?: string;
  isSimulated: boolean;
}

export interface ParsedHeartRatePacket {
  bpm: number;
  sensorContact?: boolean;
  energyExpendedJoules?: number;
  rrIntervalsMs: number[];
}

// ── COSTANTI BLUETOOTH SIG STANDARD ──
export const BLE_HEART_RATE_SERVICE = 0x180d;
export const BLE_HEART_RATE_MEASUREMENT_CHAR = 0x2a37;
export const BLE_BATTERY_SERVICE = 0x180f;
export const BLE_BATTERY_LEVEL_CHAR = 0x2a19;

/** Calcola la zona cardio AUREUS in base ai BPM */
export function calculateHeartRateZone(bpm: number): HeartRateZone {
  if (bpm <= 74) return "zen";
  if (bpm <= 89) return "vigilant";
  return "ruby_drift";
}

export interface BluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      filters?: Array<{ services?: Array<number | string>; name?: string; namePrefix?: string }>;
      optionalServices?: Array<number | string>;
      acceptAllDevices?: boolean;
    }): Promise<any>;
  };
}

/** Verifica se il browser corrente supporta la Web Bluetooth API */
export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean((navigator as BluetoothNavigator).bluetooth);
}

/**
 * Decodifica il pacchetto binario Bluetooth SIG GATT Heart Rate Measurement (0x2A37).
 * Conforme alle specifiche ufficiali Bluetooth Core Specification.
 */
export function parseHeartRateMeasurement(value: DataView): ParsedHeartRatePacket {
  if (value.byteLength < 2) {
    throw new Error("Pacchetto Heart Rate non valido: lunghezza insufficiente");
  }

  const flags = value.getUint8(0);
  const is16BitBpm = (flags & 0x01) !== 0;
  const sensorContactSupported = (flags & 0x04) !== 0;
  const sensorContactDetected = (flags & 0x02) !== 0;
  const energyExpendedPresent = (flags & 0x08) !== 0;
  const rrIntervalsPresent = (flags & 0x10) !== 0;

  let offset = 1;
  let bpm: number;

  if (is16BitBpm) {
    bpm = value.getUint16(offset, /* little-endian */ true);
    offset += 2;
  } else {
    bpm = value.getUint8(offset);
    offset += 1;
  }

  let sensorContact: boolean | undefined = undefined;
  if (sensorContactSupported) {
    sensorContact = sensorContactDetected;
  }

  let energyExpendedJoules: number | undefined = undefined;
  if (energyExpendedPresent && offset + 1 < value.byteLength) {
    energyExpendedJoules = value.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervalsMs: number[] = [];
  if (rrIntervalsPresent) {
    while (offset + 1 < value.byteLength) {
      const rrRaw = value.getUint16(offset, true);
      // Risoluzione 1/1024 secondi secondo standard Bluetooth
      const rrMs = Math.round((rrRaw / 1024) * 1000);
      rrIntervalsMs.push(rrMs);
      offset += 2;
    }
  }

  return {
    bpm,
    sensorContact,
    energyExpendedJoules,
    rrIntervalsMs,
  };
}

/** Calcola l'indice HRV RMSSD dai campioni RR recenti */
export function computeHrvRmssd(rrIntervals: number[]): number | undefined {
  if (rrIntervals.length < 2) return undefined;
  let sumSquaredDiffs = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i - 1];
    sumSquaredDiffs += diff * diff;
  }
  return Math.round(Math.sqrt(sumSquaredDiffs / (rrIntervals.length - 1)));
}

// ── SINGLETON STORE & GESTIONE STATO ──

type SmartWatchListener = (state: SmartWatchHeartRateState) => void;

class SmartWatchManager {
  private state: SmartWatchHeartRateState = {
    bpm: 72,
    status: "disconnected",
    zone: "zen",
    history: [],
    isSimulated: false,
  };

  private listeners = new Set<SmartWatchListener>();
  private bluetoothDevice: any = null;
  private heartRateCharacteristic: any = null;
  private batteryCharacteristic: any = null;
  private simulationIntervalId: any = null;
  private recentRrIntervals: number[] = [];

  constructor() {
    // Inizializza se siamo in ambiente client
    if (typeof window !== "undefined") {
      const savedDeviceName = window.localStorage?.getItem("aureus_smartwatch_last_device");
      if (savedDeviceName) {
        this.state.deviceName = savedDeviceName;
      }
    }
  }

  public getState(): SmartWatchHeartRateState {
    return this.state;
  }

  public subscribe(listener: SmartWatchListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("Errore listener smartwatch:", err);
      }
    }
  }

  private updateState(partial: Partial<SmartWatchHeartRateState>) {
    this.state = {
      ...this.state,
      ...partial,
      zone: partial.bpm !== undefined ? calculateHeartRateZone(partial.bpm) : this.state.zone,
    };
    this.notify();
  }

  /**
   * Connette lo Smartwatch o Fascia Cardio tramite Web Bluetooth API.
   * Deve essere invocato a fronte di un'azione esplicita dell'utente (click).
   */
  public async connectBleDevice(): Promise<boolean> {
    if (!isWebBluetoothSupported()) {
      this.updateState({
        error: "Web Bluetooth non supportato su questo browser. Usa Chrome, Edge o attiva la simulazione.",
        status: "disconnected",
      });
      return false;
    }

    this.stopSimulation();

    try {
      this.updateState({ status: "scanning", error: undefined });

      // Richiesta dispositivo Bluetooth conforme alle regole di sicurezza e permessi
      const bluetooth = (navigator as BluetoothNavigator).bluetooth;
      if (!bluetooth) {
        throw new Error("Web Bluetooth non supportato");
      }
      const device = await bluetooth.requestDevice({
        filters: [{ services: [BLE_HEART_RATE_SERVICE] }],
        optionalServices: [BLE_BATTERY_SERVICE],
      });

      if (!device) {
        this.updateState({ status: "disconnected" });
        return false;
      }

      this.bluetoothDevice = device;
      this.updateState({
        status: "connecting",
        deviceName: device.name || "Smartwatch BLE",
      });

      device.addEventListener("gattserverdisconnected", this.handleDisconnected);

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error("Impossibile stabilire connessione GATT con lo smartwatch");
      }

      // Ottieni Servizio Frequenza Cardiaca
      const hrService = await server.getPrimaryService(BLE_HEART_RATE_SERVICE);
      const hrChar = await hrService.getCharacteristic(BLE_HEART_RATE_MEASUREMENT_CHAR);
      this.heartRateCharacteristic = hrChar;

      // Iscriviti alle notifiche live
      await hrChar.startNotifications();
      hrChar.addEventListener("characteristicvaluechanged", this.handleHeartRateValueChanged);

      // Tenta lettura livello batteria (se supportato)
      try {
        const batteryService = await server.getPrimaryService(BLE_BATTERY_SERVICE);
        const batteryChar = await batteryService.getCharacteristic(BLE_BATTERY_LEVEL_CHAR);
        this.batteryCharacteristic = batteryChar;
        const batteryVal = await batteryChar.readValue();
        const batteryPct = batteryVal.getUint8(0);
        this.updateState({ batteryLevel: batteryPct });

        batteryChar.addEventListener("characteristicvaluechanged", (event: any) => {
          const val = event.target.value as DataView;
          this.updateState({ batteryLevel: val.getUint8(0) });
        });
        await batteryChar.startNotifications();
      } catch {
        // Battery service è opzionale
      }

      const deviceName = device.name || "Smartwatch Cardio";
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("aureus_smartwatch_last_device", deviceName);
      }

      this.updateState({
        status: "connected",
        deviceName,
        isSimulated: false,
        error: undefined,
      });

      return true;
    } catch (err: any) {
      if (err.name === "NotFoundError") {
        // Utente ha annullato la finestra di accoppiamento Bluetooth
        this.updateState({ status: "disconnected" });
        return false;
      }
      this.updateState({
        status: "disconnected",
        error: err.message || "Errore di connessione allo Smartwatch",
      });
      return false;
    }
  }

  private handleHeartRateValueChanged = (event: any) => {
    try {
      const dataView = event.target.value as DataView;
      const parsed = parseHeartRateMeasurement(dataView);
      const now = Date.now();

      if (parsed.rrIntervalsMs.length > 0) {
        this.recentRrIntervals.push(...parsed.rrIntervalsMs);
        if (this.recentRrIntervals.length > 30) {
          this.recentRrIntervals = this.recentRrIntervals.slice(-30);
        }
      }

      const hrv = computeHrvRmssd(this.recentRrIntervals);

      const newSample: HeartRateSample = {
        time: now,
        bpm: parsed.bpm,
        rrIntervalMs: parsed.rrIntervalsMs[parsed.rrIntervalsMs.length - 1],
      };

      const history = [...this.state.history.slice(-59), newSample];

      this.updateState({
        bpm: parsed.bpm,
        sensorContact: parsed.sensorContact,
        rrIntervalMs: newSample.rrIntervalMs,
        hrvRmssd: hrv,
        lastHeartbeatTime: now,
        history,
      });
    } catch (err) {
      console.warn("Impossibile elaborare il frame cardio:", err);
    }
  };

  private handleDisconnected = () => {
    this.updateState({
      status: "disconnected",
      error: "Smartwatch disconnesso",
    });
  };

  /** Disconnette lo smartwatch Bluetooth */
  public disconnect() {
    this.stopSimulation();

    if (this.bluetoothDevice?.gatt?.connected) {
      try {
        this.bluetoothDevice.gatt.disconnect();
      } catch (err) {
        console.warn("Errore disconnessione smartwatch:", err);
      }
    }

    this.bluetoothDevice = null;
    this.heartRateCharacteristic = null;
    this.batteryCharacteristic = null;
    this.updateState({
      status: "disconnected",
      isSimulated: false,
    });
  }

  /**
   * Avvia la modalità di Simulazione Fisiologica (Virtual Smartwatch Demo).
   * Genera un battito realistico con ritmo sinusoidale e micro-variazioni.
   */
  public startSimulation(targetBaseBpm = 72) {
    this.disconnect();

    let currentBpm = targetBaseBpm;
    let step = 0;

    this.updateState({
      status: "simulated",
      deviceName: "Apple Watch Ultra (Simulato)",
      batteryLevel: 94,
      sensorContact: true,
      isSimulated: true,
      error: undefined,
      bpm: targetBaseBpm,
    });

    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
    }

    this.simulationIntervalId = setInterval(() => {
      step += 0.2;
      // Variazione armonica con micro-rumore per emulare la respirazione
      const respiratorySinusArrhythmia = Math.sin(step) * 4;
      const jitter = (Math.random() - 0.5) * 2;
      const bpm = Math.max(55, Math.min(130, Math.round(targetBaseBpm + respiratorySinusArrhythmia + jitter)));

      const now = Date.now();
      const approxRr = Math.round((60 / bpm) * 1000);

      this.recentRrIntervals.push(approxRr);
      if (this.recentRrIntervals.length > 20) {
        this.recentRrIntervals = this.recentRrIntervals.slice(-20);
      }
      const hrv = computeHrvRmssd(this.recentRrIntervals);

      const sample: HeartRateSample = {
        time: now,
        bpm,
        rrIntervalMs: approxRr,
      };

      const history = [...this.state.history.slice(-59), sample];

      this.updateState({
        bpm,
        rrIntervalMs: approxRr,
        hrvRmssd: hrv,
        lastHeartbeatTime: now,
        history,
      });
    }, 1000);
  }

  public stopSimulation() {
    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }
  }

  /** Imposta manualmente il target BPM per il simulatore (es. stress test o test recupero zen) */
  public setSimulationTargetBpm(bpm: number) {
    if (this.state.isSimulated) {
      this.startSimulation(bpm);
    }
  }
}

// Esporta istanza singleton condivisa
export const smartWatchManager = new SmartWatchManager();
