import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { MarketGlobeModal } from "@/components/markets/MarketGlobeModal";

interface MarketGlobeContextValue {
  isOpen: boolean;
  openMarketGlobe: () => void;
  closeMarketGlobe: () => void;
}

const MarketGlobeContext = createContext<MarketGlobeContextValue | null>(null);

export function MarketGlobeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openMarketGlobe = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeMarketGlobe = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <MarketGlobeContext.Provider value={{ isOpen, openMarketGlobe, closeMarketGlobe }}>
      {children}
      <MarketGlobeModal isOpen={isOpen} onClose={closeMarketGlobe} />
    </MarketGlobeContext.Provider>
  );
}

export function useMarketGlobe(): MarketGlobeContextValue {
  const ctx = useContext(MarketGlobeContext);
  if (!ctx) {
    throw new Error("useMarketGlobe must be used within a MarketGlobeProvider");
  }
  return ctx;
}
