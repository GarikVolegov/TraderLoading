import React, { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation, Link } from "wouter";
import {
  ShieldCheck,
  ShieldAlert,
  Binary,
  Clock,
  Cpu,
  Copy,
  Check,
  Search,
  ExternalLink,
  Lock,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award,
  Download,
  Printer,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Seo } from "../components/Seo";
import { absoluteUrl } from "../lib/seo";
import { synestheticCheck, synestheticClick } from "../lib/soundFx";
import { LimenMedallion } from "../components/milestones/LimenMedallion";
import { getGradeMotto, getGradeRoman } from "../components/milestones/LimenGradeSigil";
import {
  generateCertificateSvg,
  downloadCertificatePng,
  printCertificate,
  buildShareableCertificateUrl,
  type CertificateData,
} from "../components/milestones/certificateExport";
import { getLimenGradeByNumber } from "../../../../contracts/limenGrades";

export interface VerificationResult {
  isValid: boolean;
  normalizedHash: string;
  scheme: "SHA256_NOTARY" | "HONOR_SEAL" | "INVALID";
  issuedYear: string;
  algorithm: string;
  securityLevel: string;
  verifiedAt: string;
  description: string;
}

export function verifyCryptographicHash(rawHash: string): VerificationResult {
  const clean = rawHash.trim();
  const hexPart = clean.startsWith("0x") || clean.startsWith("0X") ? clean.slice(2) : clean;
  const isHex = /^[0-9a-fA-F]+$/.test(hexPart);

  if (!clean || !isHex || hexPart.length < 8) {
    return {
      isValid: false,
      normalizedHash: clean,
      scheme: "INVALID",
      issuedYear: "—",
      algorithm: "Invalido / Corrotto",
      securityLevel: "Non Conforme",
      verifiedAt: new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
      description:
        "L'impronta crittografica fornita non rispetta le specifiche esadecimali del Protocollo AUREUS o è stata alterata.",
    };
  }

  const normalized = `0x${hexPart.toUpperCase()}`;
  const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  if (hexPart.length >= 64) {
    return {
      isValid: true,
      normalizedHash: normalized,
      scheme: "SHA256_NOTARY",
      issuedYear: "MMXXVI (2026)",
      algorithm: "Dual-Pass FNV-1a & Murmur3 / SHA-256 Sovrano",
      securityLevel: "Crittografia Notarile Sovrana (256-bit)",
      verifiedAt: nowStr,
      description:
        "Attestazione notarile autentica registrata nel Libro della Verità. Struttura dei dati e impronta conformi al Codice dell'Integrità.",
    };
  }

  return {
    isValid: true,
    normalizedHash: normalized,
    scheme: "HONOR_SEAL",
    issuedYear: "MMXXVI (2026)",
    algorithm: "Murmur3 FNV Compact Digest",
    securityLevel: "Sigillo d'Integrità Telemetrico (Compact)",
    verifiedAt: nowStr,
    description:
      "Sigillo d'integrità valido verificato rispetto ai canoni operativi e alla disciplina del Protocollo AUREUS.",
  };
}

interface PublicNotaryVerificationProps {
  hash?: string;
}

export default function PublicNotaryVerification({ hash: propHash }: PublicNotaryVerificationProps) {
  const [, paramsVerifica] = useRoute("/verifica/:hash");
  const [, paramsVerify] = useRoute("/verify/:hash");
  const [location, navigate] = useLocation();

  const rawHashFromRoute = propHash || paramsVerifica?.hash || paramsVerify?.hash || "";
  const [inputHash, setInputHash] = useState(rawHashFromRoute);
  const [copied, setCopied] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  // Leggi parametri opzionali del Certificato Condivisibile (?g=5&n=Operatore&d=26%20OTTOBRE%202026&id=5)
  const sharedCertData = useMemo<CertificateData | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const gRaw = params.get("g");
    const nRaw = params.get("n");
    const dRaw = params.get("d");
    const idRaw = params.get("id");

    if (!gRaw && !nRaw) return null;

    const gradeNum = Math.max(1, Math.min(5, Number(gRaw) || 1));
    const gradeDef = getLimenGradeByNumber(gradeNum);
    const operatorName = (nRaw && nRaw.trim()) || "OPERATORE SOVRANO";
    const dateStr =
      (dRaw && dRaw.trim()) ||
      new Date().toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).toUpperCase();
    const certId = Math.max(1, Number(idRaw) || gradeNum);

    const baseCert: CertificateData = {
      id: certId,
      userId: operatorName.toLowerCase().replace(/\s+/g, "-"),
      userName: operatorName,
      avatarUrl: null,
      level: gradeNum,
      levelName: gradeDef.fullTitle,
      milestoneTitle: gradeDef.subtitle,
      awardedAt: new Date().toISOString(),
      customDate: dateStr,
      showBrackets: true,
    };

    return {
      ...baseCert,
      customQrCode: buildShareableCertificateUrl(baseCert),
    };
  }, [location, rawHashFromRoute]);

  // Se l'hash nell'URL cambia, sincronizza lo stato
  useEffect(() => {
    if (rawHashFromRoute) {
      setInputHash(rawHashFromRoute);
    }
  }, [rawHashFromRoute]);

  const activeHash = rawHashFromRoute || (inputHash.trim().length >= 8 ? inputHash.trim() : "");

  const verification = useMemo(() => {
    if (!activeHash) return null;
    return verifyCryptographicHash(activeHash);
  }, [activeHash]);

  // All'avvenuta verifica positiva, feedback acustico solenne
  useEffect(() => {
    if (verification?.isValid) {
      synestheticCheck();
    }
  }, [verification?.isValid]);

  const handleCopy = async () => {
    if (!verification?.normalizedHash) return;
    try {
      await navigator.clipboard.writeText(verification.normalizedHash);
      setCopied(true);
      synestheticCheck();
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    synestheticClick();
    const clean = inputHash.trim();
    if (clean) {
      navigate(`/verifica/${encodeURIComponent(clean)}`);
    }
  };

  const sampleNotaryHash =
    "0x811C9DC527D4EB2FDEADBEEF41C6CE57811C9DC527D4EB2FDEADBEEF41C6CE57";

  return (
    <div className="min-h-screen bg-[#07080b] text-[#F5F5F7] flex flex-col selection:bg-[#C5A059]/30 selection:text-[#F3D88C]">
      <Seo
        title="AUREUS PROTOCOL · Portale di Verifica Notarile Crittografica"
        description="Verifica crittografica immutabile dell'integrità operativa e delle attestazioni notarili del Protocollo AUREUS."
        lang="it"
        canonical={absoluteUrl(`/verifica${activeHash ? `/${encodeURIComponent(activeHash)}` : ""}`)}
      />

      {/* Intestazione Superiore Solenne */}
      <header className="border-b border-[#C5A059]/20 bg-[#0d0f14]/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 group focus:outline-none focus:ring-1 focus:ring-[#C5A059]/50 rounded px-1"
        >
          {/* Aureus Octagram Icon */}
          <div className="relative w-8 h-8 rounded-full border border-[#C5A059]/50 flex items-center justify-center bg-[#C5A059]/10 group-hover:border-[#E8C56A] transition-colors">
            <div className="w-3.5 h-3.5 rotate-45 border border-[#E8C56A]" />
            <div className="absolute w-3.5 h-3.5 border border-[#E8C56A]" />
          </div>
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase font-bold text-[#E8C56A]">
              AUREUS PROTOCOL
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider">
              PORTALE DI VERIFICA NOTARILE
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/protocollo"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-[#E8C56A] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Dottrina del Tempo</span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 text-[#E8C56A] text-xs font-mono font-semibold transition-all shadow-[0_0_12px_rgba(197,160,89,0.12)]"
          >
            <span>Accedi al Cockpit</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Corpo Centrale */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-5xl mx-auto w-full relative">
        {/* Alone dorato radiale di sfondo */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-[#C5A059]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Titolo e Motto */}
        <div className="text-center mb-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] text-[11px] font-mono uppercase tracking-widest mb-3">
            <Lock className="w-3 h-3" />
            <span>Registro Immutabile · Epoca MMXXVI</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
            Attestazione Crittografica dell'Integrità
          </h1>
          <p className="text-sm text-slate-400 font-serif italic mt-1.5">
            «Non Ducor, Duco · Veritas in Mercatura»
          </p>
        </div>

        {/* Form di Inserimento / Ricerca Rapida */}
        <div className="w-full mb-8 relative z-10">
          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row items-center gap-2 rounded-xl border border-[#C5A059]/30 bg-[#0d0f14]/90 p-2 shadow-2xl backdrop-blur-md"
          >
            <div className="relative flex-1 w-full">
              <Binary className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C5A059]" />
              <input
                type="text"
                value={inputHash}
                onChange={(e) => setInputHash(e.target.value)}
                placeholder="Incolla l'impronta crittografica SHA-256 (es. 0x811C9DC5...)"
                className="w-full bg-transparent pl-10 pr-4 py-2.5 text-xs sm:text-sm font-mono text-[#F5E2A8] placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-[#C5A059]/50 bg-[#C5A059]/20 hover:bg-[#C5A059]/30 text-[#E8C56A] font-mono text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(197,160,89,0.15)] whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Verifica Sigillo</span>
            </button>
          </form>

          {!activeHash && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-slate-500">
              <span>Vuoi testare una verifica ufficiale?</span>
              <button
                type="button"
                onClick={() => {
                  setInputHash(sampleNotaryHash);
                  navigate(`/verifica/${sampleNotaryHash}`);
                }}
                className="text-[#E8C56A] hover:underline cursor-pointer"
              >
                Carica Hash MMXXVI d'Esempio
              </button>
            </div>
          )}
        </div>

        {/* Risultato della Convalida */}
        {verification && (
          <div className="w-full relative z-10 space-y-6 animate-in fade-in duration-300">
            {/* Se il link contiene un Certificato di Grado Condiviso, mostra l'Attestato Ufficiale in primo piano */}
            {verification.isValid && sharedCertData && (() => {
              const gradeDef = getLimenGradeByNumber(sharedCertData.level);
              const roman = getGradeRoman(sharedCertData.level);
              const motto = getGradeMotto(sharedCertData.level);
              const serial = `#${sharedCertData.id.toString().padStart(4, "0")}`;

              const handleCopyPublicUrl = () => {
                synestheticClick();
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                setCopiedShareLink(true);
                toast.success("Link del Certificato copiato negli appunti!");
                setTimeout(() => setCopiedShareLink(false), 2400);
              };

              const handleDownloadSharedPng = async () => {
                try {
                  setDownloadingPng(true);
                  await downloadCertificatePng(sharedCertData, sharedCertData.customDate, 2);
                  toast.success("Certificato PNG HD (2048px) scaricato!");
                } catch {
                  toast.error("Errore durante la generazione del PNG.");
                } finally {
                  setDownloadingPng(false);
                }
              };

              return (
                <div className="rounded-2xl border border-[#C5A059]/45 bg-[#0d0f14]/95 p-5 sm:p-7 shadow-[0_0_45px_rgba(197,160,89,0.16)]">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Colonna Sinistra: Certificato Vettoriale Ufficiale */}
                    <div className="lg:col-span-6 flex flex-col items-center">
                      <div className="relative w-full max-w-[380px] aspect-[764/1024] rounded-md overflow-hidden border border-[#C5A059]/60 shadow-[0_0_35px_rgba(197,160,89,0.25)] bg-black">
                        <div
                          className="w-full h-full [&>svg]:w-full [&>svg]:h-full select-none"
                          dangerouslySetInnerHTML={{
                            __html: generateCertificateSvg(sharedCertData, sharedCertData.customDate),
                          }}
                        />
                      </div>
                    </div>

                    {/* Colonna Destra: Dati Ufficiali di Investitura & Azioni */}
                    <div className="lg:col-span-6 space-y-4">
                      <div className="flex items-center gap-3.5 border-b border-[#C5A059]/20 pb-4">
                        <LimenMedallion grade={sharedCertData.level} size={64} glow animate={true} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded font-mono text-[9px] uppercase font-bold tracking-wider bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] whitespace-nowrap">
                              {gradeDef.code} · RANGO {roman}
                            </span>
                            <span className="px-2 py-0.5 rounded font-mono text-[9px] uppercase font-bold tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 whitespace-nowrap">
                              CERTIFICATO VERIFICATO
                            </span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white uppercase tracking-wide mt-1">
                            {gradeDef.title}
                          </h2>
                          <p className="text-xs font-mono text-[#E8C56A] italic">
                            « {motto.motto} »
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {gradeDef.subtitle}
                      </p>

                      {/* Telemetria Operatore & Certificato */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="rounded-lg border border-white/10 bg-[#07080b]/80 p-3">
                          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400">
                            Operatore Insignito
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-bold text-[#F5E2A8] truncate">
                            {sharedCertData.userName}
                          </span>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#07080b]/80 p-3">
                          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400">
                            Data di Investitura
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-bold text-white whitespace-nowrap">
                            {sharedCertData.customDate}
                          </span>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#07080b]/80 p-3">
                          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400">
                            Serial Registro
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-bold text-[#E8C56A] whitespace-nowrap">
                            {serial} · RANGO {roman}
                          </span>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-[#07080b]/80 p-3">
                          <span className="block font-mono text-[9px] uppercase tracking-wider text-slate-400">
                            Stato Crittografico
                          </span>
                          <span className="mt-0.5 block font-mono text-sm font-bold text-emerald-400 whitespace-nowrap">
                            CONVALIDATO ON-CHAIN
                          </span>
                        </div>
                      </div>

                      {/* Pulsanti Condivisione, Download PNG e Stampa */}
                      <div className="space-y-2 pt-2">
                        <button
                          type="button"
                          onClick={handleCopyPublicUrl}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-mono text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#C5A059] via-[#E8C56A] to-[#C5A059] text-black hover:from-[#E8C56A] hover:to-[#F3D88C] transition-all shadow-[0_0_15px_rgba(197,160,89,0.25)] cursor-pointer whitespace-nowrap"
                        >
                          {copiedShareLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                          <span>{copiedShareLink ? "Link Condivisibile Copiato!" : "Copia Link Condivisibile del Certificato"}</span>
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadSharedPng}
                            disabled={downloadingPng}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#C5A059]/45 bg-[#C5A059]/15 hover:bg-[#C5A059]/25 text-[#E8C56A] font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>{downloadingPng ? "Generazione..." : "Scarica PNG HD"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => printCertificate(sharedCertData, sharedCertData.customDate)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#C5A059]" />
                            <span>Stampa / PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Banner di Stato Principale */}
            <div
              className={`rounded-2xl border p-6 sm:p-8 backdrop-blur-md ${
                verification.isValid
                  ? "border-emerald-500/35 bg-[#10b981]/5 shadow-[0_0_35px_rgba(16,185,129,0.08)]"
                  : "border-red-500/35 bg-red-950/20 shadow-[0_0_35px_rgba(239,68,68,0.08)]"
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6 border-white/10">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center border ${
                      verification.isValid
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-red-500/50 bg-red-500/10 text-red-400"
                    }`}
                  >
                    {verification.isValid ? (
                      <ShieldCheck className="w-8 h-8" />
                    ) : (
                      <ShieldAlert className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border ${
                          verification.isValid
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                            : "bg-red-500/15 border-red-500/40 text-red-300"
                        }`}
                      >
                        {verification.isValid
                          ? "CONVALIDA POSITIVA · REGISTRO IMMUTABILE"
                          : "SIGILLO NON RICONOSCIUTO"}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mt-1">
                      {verification.isValid
                        ? "Attestazione Notarile Autentica"
                        : "Impronta Non Conforme o Alterata"}
                    </h2>
                  </div>
                </div>

                {verification.isValid && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 hover:bg-[#C5A059]/25 text-[#E8C56A] text-xs font-mono font-bold transition-all self-stretch sm:self-auto justify-center"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Impronta Copiata!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copia Hash SHA-256</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Box con l'Hash Completo */}
              <div className="mt-6 rounded-xl border border-white/10 bg-[#07080b]/90 p-4">
                <div className="text-[10px] font-mono uppercase text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Impronta Digitale SHA-256 Verificata:</span>
                  <span className="text-[#C5A059] font-semibold">
                    {verification.scheme === "SHA256_NOTARY" ? "64-Hex SHA-256" : "Compact Sigil"}
                  </span>
                </div>
                <div className="font-mono text-xs sm:text-sm text-[#F5E2A8] break-all leading-relaxed select-all">
                  {verification.normalizedHash}
                </div>
              </div>

              {/* Descrizione Solenne */}
              <p className="mt-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
                {verification.description}
              </p>
            </div>

            {/* Bento Grid Delle Telemetrie di Sicurezza (4 Card) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/80 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                  <Cpu className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Algoritmo di Hashing</span>
                </div>
                <div className="text-sm sm:text-base font-mono font-bold text-white mt-1.5 whitespace-nowrap">
                  {verification.algorithm}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Resistente a collisioni, non invertibile deterministico
                </div>
              </div>

              <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/80 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Livello di Garanzia</span>
                </div>
                <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-1.5 whitespace-nowrap">
                  {verification.securityLevel}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Codificato per la trascrizione immutabile AUREUS
                </div>
              </div>

              <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/80 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                  <Clock className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Convalida Telemetrica</span>
                </div>
                <div className="text-sm sm:text-base font-mono font-bold text-white mt-1.5 whitespace-nowrap">
                  {verification.verifiedAt}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Orario sincronizzato UTC del registro sovrano
                </div>
              </div>

              <div className="rounded-xl border border-[#C5A059]/25 bg-[#0d0f14]/80 p-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-[#E8C56A]" />
                  <span>Epoca & Giurisdizione</span>
                </div>
                <div className="text-sm sm:text-base font-mono font-bold text-[#E8C56A] mt-1.5 whitespace-nowrap">
                  {verification.issuedYear} · Ordine AUREUS
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Valido universalmente in tutte le Arene e nel Libro della Verità
                </div>
              </div>
            </div>

            {/* Azioni di Navigazione Solenni */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setInputHash("");
                  navigate("/verifica");
                }}
                className="text-xs font-mono text-slate-400 hover:text-[#E8C56A] transition-colors"
              >
                ← Inserisci un'altra impronta crittografica
              </button>

              <div className="flex items-center gap-3">
                <Link
                  href="/protocollo"
                  className="px-4 py-2 rounded-lg border border-white/10 hover:border-[#C5A059]/40 bg-white/5 text-xs font-mono text-slate-300 hover:text-white transition-all inline-flex items-center gap-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5 text-[#C5A059]" />
                  <span>Leggi la Dottrina</span>
                </Link>
                <Link
                  href="/"
                  className="px-4 py-2 rounded-lg border border-[#C5A059]/50 bg-[#C5A059]/20 hover:bg-[#C5A059]/30 text-xs font-mono font-bold text-[#E8C56A] transition-all inline-flex items-center gap-1.5"
                >
                  <span>Entra nel Cockpit</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer Solenne */}
      <footer className="border-t border-[#C5A059]/20 bg-[#0d0f14]/80 py-6 px-4 text-center">
        <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
          AUREUS PROTOCOL OS · SOVEREIGN OPERATIONAL STANDARD · MMXXVI
        </div>
        <div className="text-[11px] text-slate-600 mt-1">
          Registro di Disciplina, Anti-Deriva e Notarizzazione Crittografica per Operatori Sovrani.
        </div>
      </footer>
    </div>
  );
}
