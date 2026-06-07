import { useEffect, useState } from "react";
import { useLoading } from "@/contexts/LoadingContext";

const STEP_MESSAGES = {
  assets: "Caricamento risorse...",
  data: "Sincronizzazione dati...",
  audio: "Inizializzazione frequenze audio...",
  complete: "Pronto!",
};

export function LoadingScreen() {
  const { isLoading, currentStep } = useLoading();
  const [displayText, setDisplayText] = useState("");
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const stepMessage = STEP_MESSAGES[currentStep];
    let timeout: NodeJS.Timeout;

    if (currentStep === "complete") {
      setDisplayText(stepMessage);
    } else {
      const baseText = stepMessage;
      timeout = setInterval(() => {
        setDotCount((prev) => (prev + 1) % 4);
      }, 500);

      setDisplayText(baseText);
    }

    return () => clearTimeout(timeout);
  }, [currentStep]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      {/* Spinner */}
      <div className="mb-12 sm:mb-16">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>

      {/* Loading Text */}
      <div className="text-center space-y-2">
        <p className="text-sm sm:text-base font-mono text-primary/80 tracking-wider letter-spacing">
          {displayText}
          {currentStep !== "complete" && <span>{".".repeat(dotCount)}</span>}
        </p>
        
        {/* Progress Indicator */}
        <div className="flex gap-1 justify-center mt-4">
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${
            currentStep === "assets" ? "bg-primary" : "bg-primary/30"
          }`} />
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${
            currentStep === "data" || currentStep === "audio" || currentStep === "complete" ? "bg-primary" : "bg-primary/30"
          }`} />
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${
            currentStep === "audio" || currentStep === "complete" ? "bg-primary" : "bg-primary/30"
          }`} />
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${
            currentStep === "complete" ? "bg-primary" : "bg-primary/30"
          }`} />
        </div>
      </div>

      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 opacity-10">
        <div className="absolute inset-0 bg-gradient-radial from-primary/20 to-transparent" />
      </div>
    </div>
  );
}
