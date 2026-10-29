import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  isBiometricSupported as checkBiometricSupported,
  isBiometricEnabled as checkBiometricEnabled,
  setBiometricEnabled,
  registerBiometric,
  authenticateBiometric,
} from "@/lib/biometrics";
import { synestheticConfirm } from "@/lib/soundFx";

const PIN_STORAGE_KEY = "tl_pin_hash";
const PIN_LOCKED_KEY = "tl_pin_locked";

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "tl-salt-2025");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface PinLockContextValue {
  isLocked: boolean;
  isPinSet: boolean;
  isBiometricSupported: boolean;
  isBiometricEnabled: boolean;
  unlock: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  enableBiometrics: (operatorName?: string) => Promise<boolean>;
  disableBiometrics: () => void;
  setPin: (pin: string) => Promise<void>;
  removePin: () => void;
  lock: () => void;
}

const PinLockContext = createContext<PinLockContextValue | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const [pinHash, setPinHash] = useState<string | null>(() => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return localStorage.getItem(PIN_STORAGE_KEY);
  });
  const [isLocked, setIsLocked] = useState(() => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const stored = localStorage.getItem(PIN_STORAGE_KEY);
    return !!stored;
  });

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(() => checkBiometricEnabled());

  useEffect(() => {
    let mounted = true;
    checkBiometricSupported().then((supported) => {
      if (mounted) setBiometricSupported(supported);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const isPinSet = !!pinHash;

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    if (!pinHash) return true;
    const h = await hashPin(pin);
    if (h === pinHash) {
      setIsLocked(false);
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem(PIN_LOCKED_KEY, "unlocked");
      }
      synestheticConfirm();
      return true;
    }
    return false;
  }, [pinHash]);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    if (!biometricEnabled) return false;
    const verified = await authenticateBiometric();
    if (verified) {
      setIsLocked(false);
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem(PIN_LOCKED_KEY, "unlocked");
      }
      synestheticConfirm();
      return true;
    }
    return false;
  }, [biometricEnabled]);

  const enableBiometrics = useCallback(async (operatorName = "Operatore Aureus"): Promise<boolean> => {
    const success = await registerBiometric(operatorName);
    if (success) {
      setBiometricEnabledState(true);
    }
    return success;
  }, []);

  const disableBiometrics = useCallback(() => {
    setBiometricEnabled(false);
    setBiometricEnabledState(false);
  }, []);

  const setPin = useCallback(async (pin: string): Promise<void> => {
    const h = await hashPin(pin);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(PIN_STORAGE_KEY, h);
    }
    setPinHash(h);
    setIsLocked(false);
  }, []);

  const removePin = useCallback(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(PIN_STORAGE_KEY);
    }
    setPinHash(null);
    disableBiometrics();
    setIsLocked(false);
  }, [disableBiometrics]);

  const lock = useCallback(() => {
    if (pinHash) setIsLocked(true);
  }, [pinHash]);

  useEffect(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const unlocked = sessionStorage.getItem(PIN_LOCKED_KEY) === "unlocked";
      if (unlocked && pinHash) setIsLocked(false);
    }
  }, [pinHash]);

  const contextValue = useMemo<PinLockContextValue>(
    () => ({
      isLocked,
      isPinSet,
      isBiometricSupported: biometricSupported,
      isBiometricEnabled: biometricEnabled,
      unlock,
      unlockWithBiometrics,
      enableBiometrics,
      disableBiometrics,
      setPin,
      removePin,
      lock,
    }),
    [
      isLocked,
      isPinSet,
      biometricSupported,
      biometricEnabled,
      unlock,
      unlockWithBiometrics,
      enableBiometrics,
      disableBiometrics,
      setPin,
      removePin,
      lock,
    ],
  );

  return (
    <PinLockContext.Provider value={contextValue}>
      {children}
    </PinLockContext.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinLockContext);
  if (!ctx) throw new Error("usePinLock must be inside PinLockProvider");
  return ctx;
}
