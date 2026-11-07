import { useState, useEffect, lazy, Suspense } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@clerk/react";
import { BrandMark } from "@/components/BrandMark";
import { ArrowLeft, Sparkles, UserCheck, ShieldCheck, Zap } from "lucide-react";
import TradingCockpit from "./TradingCockpit";

export default function PublicVarcoPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#07080b] text-white flex flex-col">
      {/* ── Sovrano Top Banner for Public Guest Operators ── */}
      {!isSignedIn && (
        <aside
          aria-label="Banner Varco Pubblico"
          className="bg-gradient-to-r from-[#0d0f14] via-[#11131c] to-[#0d0f14] border-b border-[#C5A059]/30 px-3.5 py-2 flex items-center justify-between text-xs font-mono z-40 select-none shrink-0"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-[#E8C56A] transition-colors shrink-0"
              title="Torna alla Home del Protocollo"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-bold">Home</span>
            </Link>

            <div className="h-3 w-px bg-white/10 shrink-0" />

            <div className="flex items-center gap-1.5 truncate">
              <span className="px-1.5 py-0.5 rounded bg-[#C5A059]/20 border border-[#C5A059]/40 text-[#E8C56A] font-bold text-[9.5px] uppercase tracking-wider whitespace-nowrap">
                IL VARCO · DEMO OPERATIVA
              </span>
              <span className="text-slate-400 text-[10px] hidden md:inline truncate">
                Cockpit Reale con Grafico TradingView & Finestra Operativa Revolut. Prova liberamente.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/sign-in"
              className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
            >
              Accedi
            </Link>
            <Link
              href="/sign-up"
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#C5A059] to-[#E8C56A] text-black text-[10px] font-extrabold uppercase tracking-wider hover:brightness-110 shadow-[0_0_12px_rgba(197,160,89,0.25)] transition-all whitespace-nowrap"
            >
              Consacra Profilo
            </Link>
          </div>
        </aside>
      )}

      {/* Main Cockpit Experience */}
      <div className="flex-1">
        <TradingCockpit />
      </div>
    </div>
  );
}
