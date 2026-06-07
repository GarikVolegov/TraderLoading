import { createContext, useContext, useState, type ReactNode } from "react";

export type LoadingStep = "assets" | "data" | "audio" | "complete";

interface LoadingContextType {
  isLoading: boolean;
  currentStep: LoadingStep;
  setIsLoading: (v: boolean) => void;
  setCurrentStep: (step: LoadingStep) => void;
  completeLoading: () => void;
}

const LoadingCtx = createContext<LoadingContextType | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<LoadingStep>("assets");

  const completeLoading = () => {
    setIsLoading(false);
    setCurrentStep("complete");
  };

  return (
    <LoadingCtx.Provider value={{ isLoading, currentStep, setIsLoading, setCurrentStep, completeLoading }}>
      {children}
    </LoadingCtx.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingCtx);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}
