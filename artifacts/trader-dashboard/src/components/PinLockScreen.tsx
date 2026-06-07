import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, ShieldCheck, AlertCircle } from "lucide-react";
import { usePinLock } from "@/contexts/PinLockContext";
import { useLanguage } from "@/contexts/LanguageContext";

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

export function PinLockScreen() {
  const { isLocked, unlock } = usePinLock();
  const { t } = useLanguage();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  if (!isLocked) return null;

  const handleKey = async (key: string) => {
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
      setError(false);
      return;
    }
    if (key === "") return;
    if (pin.length >= 4) return;

    const newPin = pin + key;
    setPin(newPin);

    if (newPin.length === 4) {
      const ok = await unlock(newPin);
      if (!ok) {
        setShake(true);
        setError(true);
        setTimeout(() => {
          setPin("");
          setShake(false);
        }, 600);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center px-6">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8 relative z-10"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.15)]">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">TraderLoading</h1>
          <p className="text-sm text-muted-foreground">{t("pin.enter")}</p>
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
                scale: pin.length > i ? 1.1 : 1,
                backgroundColor: error
                  ? "rgba(239,68,68,0.3)"
                  : pin.length > i
                  ? "rgb(34,197,94)"
                  : "transparent",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={`w-4 h-4 rounded-full border-2 ${
                error ? "border-destructive" : pin.length > i ? "border-primary" : "border-border"
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
              className="flex items-center gap-2 text-destructive text-sm"
            >
              <AlertCircle className="w-4 h-4" />
              {t("pin.incorrect")}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-3 gap-3 w-64">
          {KEYS.flat().map((key, i) => (
            <motion.button
              key={i}
              onClick={() => handleKey(key)}
              whileTap={{ scale: key ? 0.9 : 1 }}
              disabled={!key}
              className={`h-16 rounded-2xl text-xl font-semibold transition-colors ${
                key === "⌫"
                  ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  : key
                  ? "bg-secondary/50 border border-border hover:bg-secondary hover:border-primary/40 text-foreground"
                  : ""
              }`}
            >
              {key === "⌫" ? <Delete className="w-5 h-5 mx-auto" /> : key}
            </motion.button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground/50">{t("pin.remembered")}</p>
      </motion.div>
    </div>
  );
}
