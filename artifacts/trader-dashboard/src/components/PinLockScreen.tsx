import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, AlertCircle, ScanFace, Fingerprint } from "lucide-react";
import { usePinLock } from "@/contexts/PinLockContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { synestheticClick, synestheticAlert } from "@/lib/soundFx";

export function PinLockScreen() {
  const { isLocked, unlock, isBiometricEnabled, unlockWithBiometrics } = usePinLock();
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [biometricPending, setBiometricPending] = useState(false);

  const handleBiometricUnlock = useCallback(async () => {
    if (biometricPending) return;
    setBiometricPending(true);
    try {
      await unlockWithBiometrics();
    } finally {
      setBiometricPending(false);
    }
  }, [biometricPending, unlockWithBiometrics]);

  // Prompt automatically for Face ID / Touch ID on mount if biometric unlock is enabled
  useEffect(() => {
    if (!isLocked || !isBiometricEnabled) return;
    const timer = setTimeout(() => {
      void handleBiometricUnlock();
    }, 350);
    return () => clearTimeout(timer);
  }, [isLocked, isBiometricEnabled, handleBiometricUnlock]);

  const handleKey = useCallback(
    async (key: string) => {
      if (key === "biometric") {
        synestheticClick();
        void handleBiometricUnlock();
        return;
      }
      if (key === "⌫") {
        synestheticClick();
        setPin((p) => p.slice(0, -1));
        setError(false);
        return;
      }
      if (key === "") return;
      if (pin.length >= 4) return;

      synestheticClick();
      const newPin = pin + key;
      setPin(newPin);

      if (newPin.length === 4) {
        const ok = await unlock(newPin);
        if (!ok) {
          synestheticAlert();
          setShake(true);
          setError(true);
          setTimeout(() => {
            setPin("");
            setShake(false);
          }, 600);
        }
      }
    },
    [pin, unlock, handleBiometricUnlock],
  );

  // Let the PIN be typed on a physical keyboard, not only tapped on the keypad.
  useEffect(() => {
    if (!isLocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        void handleKey(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        void handleKey("⌫");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLocked, handleKey]);

  if (!isLocked) return null;

  const keypadKeys = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    [isBiometricEnabled ? "biometric" : "", "0", "⌫"],
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-[#0A0A0C] flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_30%,rgba(197,160,89,0.08),transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-7 relative z-10"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-xl bg-[#141418] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_25px_rgba(197,160,89,0.2)] overflow-hidden">
            <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-xl font-bold font-serif tracking-[0.2em] text-[#F4F4F6]">AUREUS</h1>
          <p className="text-xs font-mono uppercase tracking-widest text-[#8E8E98]">{t("pin.enter")}</p>
        </div>

        <motion.div
          animate={shake ? { x: [-10, 10, -10, 10, -6, 6, -3, 3, 0] } : {}}
          transition={{ duration: 0.5 }}
          className="flex gap-4"
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: pin.length > i ? 1.15 : 1,
                backgroundColor: error
                  ? "rgba(139,30,30,0.6)"
                  : pin.length > i
                  ? "#C5A059"
                  : "transparent",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={`w-4 h-4 rounded-full border-2 ${
                error ? "border-rose-500" : pin.length > i ? "border-[#C5A059]" : "border-[#3A3A48]"
              }`}
            />
          ))}
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-rose-400 text-xs font-mono"
            >
              <AlertCircle className="w-4 h-4" />
              {t("pin.incorrect")}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-3 w-64">
          {keypadKeys.flat().map((key, i) => (
            <motion.button
              key={i}
              onClick={() => handleKey(key)}
              aria-label={key === "⌫" ? t("pin.delete") : key === "biometric" ? t("pin.biometric_label") : key || undefined}
              aria-hidden={!key}
              whileTap={{ scale: key ? 0.92 : 1 }}
              disabled={!key || (key === "biometric" && biometricPending)}
              className={`h-14 rounded-xl text-lg font-mono font-bold transition-all flex items-center justify-center ${
                key === "⌫"
                  ? "text-[#8E8E98] hover:text-[#F4F4F6] hover:bg-[#1A1A22]"
                  : key === "biometric"
                  ? "bg-[#141418] border border-[#C5A059]/40 hover:border-[#C5A059] hover:bg-[#C5A059]/15 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.15)]"
                  : key
                  ? "bg-[#141418] border border-[#252530] hover:border-[#C5A059]/60 hover:bg-[#1C1C24] text-[#F4F4F6] shadow-sm"
                  : ""
              }`}
            >
              {key === "⌫" ? (
                <Delete className="w-5 h-5 mx-auto" />
              ) : key === "biometric" ? (
                <div className="flex flex-col items-center justify-center">
                  <ScanFace className="w-5 h-5 text-[#C5A059] animate-pulse" />
                </div>
              ) : (
                key
              )}
            </motion.button>
          ))}
        </div>

        {isBiometricEnabled && (
          <button
            type="button"
            onClick={handleBiometricUnlock}
            disabled={biometricPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C5A059]/30 bg-[#11131c]/90 text-[#E8C56A] text-xs font-mono tracking-wider hover:bg-[#C5A059]/15 transition-all shadow-sm"
          >
            <Fingerprint className="w-3.5 h-3.5 text-[#C5A059]" />
            <span>{t("pin.biometric_prompt")}</span>
          </button>
        )}

        <p className="text-[11px] font-mono tracking-wider text-[#666675]">{t("pin.remembered")}</p>
      </motion.div>
    </div>
  );
}
