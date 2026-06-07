import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

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
  unlock: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => void;
  lock: () => void;
}

const PinLockContext = createContext<PinLockContextValue | null>(null);

export function PinLockProvider({ children }: { children: ReactNode }) {
  const [pinHash, setPinHash] = useState<string | null>(() => localStorage.getItem(PIN_STORAGE_KEY));
  const [isLocked, setIsLocked] = useState(() => {
    const stored = localStorage.getItem(PIN_STORAGE_KEY);
    return !!stored;
  });

  const isPinSet = !!pinHash;

  const unlock = async (pin: string): Promise<boolean> => {
    if (!pinHash) return true;
    const h = await hashPin(pin);
    if (h === pinHash) {
      setIsLocked(false);
      sessionStorage.setItem(PIN_LOCKED_KEY, "unlocked");
      return true;
    }
    return false;
  };

  const setPin = async (pin: string): Promise<void> => {
    const h = await hashPin(pin);
    localStorage.setItem(PIN_STORAGE_KEY, h);
    setPinHash(h);
    setIsLocked(false);
  };

  const removePin = () => {
    localStorage.removeItem(PIN_STORAGE_KEY);
    setPinHash(null);
    setIsLocked(false);
  };

  const lock = () => {
    if (pinHash) setIsLocked(true);
  };

  useEffect(() => {
    const unlocked = sessionStorage.getItem(PIN_LOCKED_KEY) === "unlocked";
    if (unlocked && pinHash) setIsLocked(false);
  }, [pinHash]);

  return (
    <PinLockContext.Provider value={{ isLocked, isPinSet, unlock, setPin, removePin, lock }}>
      {children}
    </PinLockContext.Provider>
  );
}

export function usePinLock() {
  const ctx = useContext(PinLockContext);
  if (!ctx) throw new Error("usePinLock must be inside PinLockProvider");
  return ctx;
}
