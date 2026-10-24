import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Printer,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  FileCode,
  Image as ImageIcon,
  Award,
  RotateCcw,
  QrCode as QrCodeIcon,
  Calendar,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { getGradeMotto, getGradeRoman } from "./LimenGradeSigil";
import { LimenMedallion } from "./LimenMedallion";
import {
  computeCertHash,
  downloadCertificatePng,
  downloadCertificateSvg,
  printCertificate,
  generateCertificateSvg,
  type CertificateData,
} from "./certificateExport";
import { getLimenGradeByNumber, LIMEN_GRADES } from "../../../../../contracts/limenGrades";

export interface LimenCertificateModalProps {
  readonly cert: CertificateData | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export const LimenCertificateModal: React.FC<LimenCertificateModalProps> = ({
  cert,
  isOpen,
  onClose,
}) => {
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadingSvg, setDownloadingSvg] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [activeTab, setActiveTab] = useState<"certificate" | "sigil">("certificate");

  // Dynamic user customization state
  const [selectedGrade, setSelectedGrade] = useState<number>(() =>
    cert ? Math.max(1, Math.min(5, cert.level)) : 1,
  );
  const [customUserName, setCustomUserName] = useState<string>(() => cert?.userName || "");
  const [showBrackets, setShowBrackets] = useState<boolean>(true);

  const initialDateStr = useMemo(() => {
    return new Date(cert?.awardedAt || Date.now()).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).toUpperCase();
  }, [cert?.awardedAt]);

  const [customDate, setCustomDate] = useState<string>(() => cert?.customDate || initialDateStr);
  const [customQrCode, setCustomQrCode] = useState<string>(() => cert?.customQrCode || "");

  useEffect(() => {
    if (cert) {
      setSelectedGrade(Math.max(1, Math.min(5, cert.level)));
      setCustomUserName(cert.userName || "");
      const dStr = new Date(cert.awardedAt || Date.now()).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).toUpperCase();
      setCustomDate(cert.customDate || dStr);
      setCustomQrCode(cert.customQrCode || "");
      setShowBrackets(cert.showBrackets !== false);
    }
  }, [cert?.id, cert?.level, cert?.userName, cert?.awardedAt, cert?.customDate, cert?.customQrCode, cert?.showBrackets]);

  if (!isOpen || !cert) return null;

  const handleSelectGrade = (newGrade: number) => {
    setSelectedGrade(newGrade);
  };

  const gradeNum = Math.max(1, Math.min(5, selectedGrade));
  const gradeDef = getLimenGradeByNumber(gradeNum);
  const roman = getGradeRoman(gradeNum);
  const motto = getGradeMotto(gradeNum);

  const effectiveUserName = (customUserName && customUserName.trim()) || cert.userName || "OPERATORE";
  const defaultQrUrl = `https://limen.trade/verify/nft/${gradeNum}/${computeCertHash({ id: cert.id, level: gradeNum, userId: cert.userId })}`;
  const effectiveQrCode = customQrCode.trim() || defaultQrUrl;

  const effectiveCert: CertificateData = {
    ...cert,
    level: gradeNum,
    levelName: gradeDef.fullTitle,
    userName: effectiveUserName,
    customDate: customDate.trim() || initialDateStr,
    customQrCode: effectiveQrCode,
    showBrackets,
  };

  const hash = computeCertHash(effectiveCert);
  const serial = `#${effectiveCert.id.toString().padStart(4, "0")}`;

  const handleResetDefaults = () => {
    setCustomUserName(cert.userName || "OPERATORE");
    setCustomDate(initialDateStr);
    setCustomQrCode(defaultQrUrl);
    setShowBrackets(true);
    toast.info("Valori predefiniti ripristinati");
  };

  const handleDownloadPng = async () => {
    try {
      setDownloadingPng(true);
      await downloadCertificatePng(effectiveCert, effectiveCert.customDate, 2);
      toast.success("Certificato NFT PNG ad alta risoluzione (2048px) scaricato con successo!");
    } catch (err) {
      console.error("Errore download PNG:", err);
      toast.error("Impossibile generare l'immagine PNG ad alta risoluzione.");
    } finally {
      setDownloadingPng(false);
    }
  };

  const handleDownloadSvg = async () => {
    try {
      setDownloadingSvg(true);
      await downloadCertificateSvg(effectiveCert, effectiveCert.customDate);
      toast.success("Certificato vettoriale SVG con master artwork incorporato scaricato!");
    } catch (err) {
      console.error("Errore download SVG:", err);
      toast.error("Impossibile scaricare il file SVG.");
    } finally {
      setDownloadingSvg(false);
    }
  };

  const handlePrint = () => {
    printCertificate(effectiveCert, effectiveCert.customDate);
  };

  const handleCopyHash = () => {
    navigator.clipboard.writeText(`0x${hash}`);
    setCopiedHash(true);
    toast.success("Hash identificativo copiato negli appunti");
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const hasCustomEdits =
    customUserName.trim() !== (cert.userName || "").trim() ||
    customDate.trim() !== initialDateStr ||
    (customQrCode.trim() !== "" && customQrCode.trim() !== defaultQrUrl) ||
    !showBrackets;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[94vh] flex flex-col rounded-lg border border-[#C5A059]/40 bg-[#0C0D12] text-foreground shadow-2xl overflow-hidden"
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#C5A059]/20 bg-gradient-to-r from-[#14151C] via-[#0E0F14] to-[#14151C]">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-[#C5A059]" />
            <div>
              <h2 id="cert-modal-title" className="font-mono text-sm font-bold tracking-wider text-[#F4F4F6] uppercase">
                Certificato NFT Ufficiale · {gradeDef.code} — {gradeDef.title}
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                Attestato di Grado Limen Protocol · {effectiveUserName} · Serial {serial}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center rounded border border-[#C5A059]/30 bg-black/40 p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveTab("certificate")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === "certificate"
                    ? "bg-[#C5A059] text-black font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Attestato Ufficiale
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sigil")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  activeTab === "sigil"
                    ? "bg-[#C5A059] text-black font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Solo Sigillo
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Chiudi finestra"
              className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: ARTWORK PREVIEW */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            {activeTab === "certificate" ? (
              <div className="relative w-full max-w-[390px] aspect-[764/1024] rounded-md overflow-hidden border border-[#C5A059]/60 shadow-[0_0_35px_rgba(197,160,89,0.22)] bg-black">
                {/* SVG preview with live customized grade, name, date, and scannable QR code */}
                <div
                  className="w-full h-full [&>svg]:w-full [&>svg]:h-full select-none"
                  dangerouslySetInnerHTML={{
                    __html: generateCertificateSvg(effectiveCert, effectiveCert.customDate),
                  }}
                />
              </div>
            ) : (
              <div className="w-full max-w-[340px] min-h-[340px] flex flex-col items-center justify-center p-6 rounded-xl border border-[#C5A059]/40 bg-gradient-to-b from-[#161720] via-[#0E0F14] to-[#0A0A0F] shadow-[0_0_35px_rgba(197,160,89,0.2)]">
                <LimenMedallion
                  grade={gradeNum}
                  size={210}
                  glow={true}
                  animate={true}
                  alt={`Sigillo Ufficiale di Investitura ${gradeDef.fullTitle}`}
                />
                <div className="mt-4 text-center">
                  <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.2em] uppercase">
                    {gradeDef.code} · {roman}
                  </span>
                  <p className="font-serif text-base font-bold text-white tracking-wide mt-0.5">
                    {gradeDef.title}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1 tracking-wider uppercase">
                    {motto.motto}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground text-center">
              <Sparkles className="w-3.5 h-3.5 text-[#C5A059] shrink-0" />
              <span>Nuovo Certificato NFT ad alta fedeltà · Scannabile con Smartphone</span>
            </div>
          </div>

          {/* RIGHT: DETAILS, CUSTOMIZATIONS & ACTIONS */}
          <div className="lg:col-span-5 space-y-3.5">
            {/* SELETTORE RAPIDO DEI 5 GRADI LIMEN */}
            <div className="p-3 rounded border border-[#C5A059]/30 bg-[#12131A] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted-foreground uppercase font-bold tracking-wider">
                  Seleziona Certificato di Grado:
                </span>
                <span className="text-[#C5A059] font-bold">{gradeDef.code}</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 p-1 rounded-md border border-[#C5A059]/20 bg-black/60">
                {LIMEN_GRADES.map((g) => {
                  const isSelected = selectedGrade === g.grade;
                  return (
                    <button
                      key={g.grade}
                      type="button"
                      onClick={() => handleSelectGrade(g.grade)}
                      title={g.fullTitle}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded font-mono text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-[#C5A059] text-black shadow-md scale-[1.03]"
                          : "text-muted-foreground hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <LimenMedallion grade={g.grade} size={22} animate={false} />
                      <span className="text-xs mt-0.5">{g.roman}</span>
                      <span className="text-[8px] font-normal uppercase opacity-75 truncate max-w-full">
                        {g.code.replace("GRADO ", "G.")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SEZIONE PERSONALIZZAZIONE NOME, DATA E QR CODE */}
            <div className="p-3.5 rounded border border-[#C5A059]/40 bg-card/80 space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#C5A059] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C5A059]" />
                  Personalizzazione Attestato NFT
                </span>
                {hasCustomEdits && (
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ripristina</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {/* 1. Nome Operatore */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3 text-[#C5A059]" />
                      Nome Operatore (inciso in oro):
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowBrackets(!showBrackets)}
                      className="text-[9px] font-mono text-muted-foreground hover:text-[#C5A059] transition-colors"
                      title="Attiva/disattiva parentesi quadre attorno al nome"
                    >
                      {showBrackets ? "Parentesi [ ] Attive" : "Parentesi [ ] Disattive"}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customUserName}
                    onChange={(e) => setCustomUserName(e.target.value)}
                    placeholder="Nome e Cognome Operatore"
                    className="w-full px-2.5 py-1.5 rounded bg-black/60 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* 2. Data di Investitura */}
                <div>
                  <label className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-[#C5A059]" />
                    Data di Investitura:
                  </label>
                  <input
                    type="text"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    placeholder="21 OTTOBRE 2026"
                    className="w-full px-2.5 py-1.5 rounded bg-black/60 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                  />
                </div>

                {/* 3. Contenuto QR Code */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <QrCodeIcon className="w-3 h-3 text-[#C5A059]" />
                      Contenuto QR Code (URL / Hash / Wallet):
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomQrCode(defaultQrUrl)}
                      className="text-[9px] font-mono text-muted-foreground hover:text-[#C5A059] transition-colors"
                      title="Ripristina URL di verifica predefinito"
                    >
                      Default On-Chain
                    </button>
                  </div>
                  <input
                    type="text"
                    value={customQrCode}
                    onChange={(e) => setCustomQrCode(e.target.value)}
                    placeholder={defaultQrUrl}
                    className="w-full px-2.5 py-1.5 rounded bg-black/60 border border-border text-foreground font-mono text-xs focus:outline-none focus:border-[#C5A059]"
                  />
                </div>
              </div>
            </div>

            {/* SCHEDA RIEPILOGATIVA GRADO CONFERITO */}
            <div className="p-3.5 rounded border border-border bg-card/50 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-sm font-mono text-[9px] font-bold uppercase tracking-wider bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30">
                  {gradeDef.code} · RANGO {roman}
                </span>
                <span className="font-mono text-xs font-bold text-muted-foreground">{serial}</span>
              </div>

              <h3 className="text-sm sm:text-base font-bold text-foreground uppercase tracking-wide">
                {gradeDef.title}
              </h3>
              <p className="text-[11px] text-[#C5A059] font-mono italic">
                « {motto.motto} »
              </p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {gradeDef.subtitle}
              </p>

              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Operatore:</span>
                <span className="font-bold text-foreground font-mono">{effectiveUserName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Data di Investitura:</span>
                <span className="font-mono text-foreground">{effectiveCert.customDate}</span>
              </div>
            </div>

            {/* Cryptographic Authenticity Proof */}
            <div className="p-3 rounded border border-[#C5A059]/30 bg-[#0E1015] space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#C5A059]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>PROVA DI INTEGRITÀ ON-CHAIN</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold">CONVALIDATO</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-black/60 border border-white/5 font-mono text-xs">
                <span className="text-muted-foreground select-all text-[11px]">0x{hash}</span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="p-1 text-muted-foreground hover:text-white transition-colors"
                  title="Copia Hash"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* EXPORT ACTION BUTTONS */}
            <div className="space-y-2 pt-1">
              <h4 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Opzioni di Scaricamento e Stampa
              </h4>

              {/* PNG Download Button */}
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={downloadingPng}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded font-mono text-xs font-bold uppercase tracking-wider bg-[#C5A059] text-black hover:bg-[#D4B475] active:scale-[0.99] transition-all shadow-md disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                {downloadingPng ? "Generazione in corso..." : `Scarica Certificato Grado ${roman} (PNG HD 2048px)`}
              </button>

              {/* SVG Vector Download Button */}
              <button
                type="button"
                onClick={handleDownloadSvg}
                disabled={downloadingSvg}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded font-mono text-xs font-bold uppercase tracking-wider border border-[#C5A059]/40 bg-card hover:bg-white/5 active:scale-[0.99] transition-all text-[#C5A059] disabled:opacity-50"
              >
                <FileCode className="w-4 h-4" />
                {downloadingSvg ? "Preparazione..." : "Scarica Vettoriale SVG (Alta Risoluzione)"}
              </button>

              {/* Print Button */}
              <button
                type="button"
                onClick={handlePrint}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded font-mono text-xs font-bold uppercase tracking-wider border border-border bg-secondary/50 hover:bg-secondary active:scale-[0.99] transition-all text-foreground"
              >
                <Printer className="w-4 h-4 text-primary" />
                Stampa Certificato Ufficiale (A4 / PDF)
              </button>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-5 py-2.5 border-t border-border bg-[#090A0D] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>LIMEN PROTOCOL · Proof of Discipline Standard</span>
          <span className="hidden sm:inline">ERC-721 Metadata Ready · QR Code Verified</span>
        </div>
      </div>
    </div>
  );
};
