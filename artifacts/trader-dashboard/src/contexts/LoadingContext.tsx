import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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

  const completeLoading = useCallback(() => {
    setIsLoading(false);
    setCurrentStep("complete");
  }, []);

  const contextValue = useMemo(
    () => ({ isLoading, currentStep, setIsLoading, setCurrentStep, completeLoading }),
    [isLoading, currentStep, completeLoading],
  );

  return (
    <LoadingCtx.Provider value={contextValue}>
      {children}
    </LoadingCtx.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingCtx);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}
