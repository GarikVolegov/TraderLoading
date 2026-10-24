import { useState } from "react";
import { X, Loader2, CheckCircle, AlertTriangle, Download, Share2, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NftCertificate, type CertTier } from "./NftCertificate";
import { downloadTorneoCertificate } from "./torneoCertificateExport";
import type { TorneiCertificate } from "@/lib/torneiApi";

interface CertModalProps {
  cert: TorneiCertificate | null;
  claiming: boolean;
  hasWallet: boolean;
  mintEnabled: boolean;
  onClaim: (id: number) => void;
  onClose: () => void;
}

const STATUS_KEY: Record<string, string> = {
  claimable: "tornei.cert.claimable",
  pending: "tornei.cert.pending",
  minted: "tornei.cert.minted",
  failed: "tornei.cert.failed",
};

export function CertModal({ cert, claiming, hasWallet, mintEnabled, onClaim, onClose }: CertModalProps) {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!cert) return null;
  const tier = cert.tier as CertTier;

  const handleShare = () => {
    const url = `${window.location.origin}/tornei?cert=${cert.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background: "rgba(10, 10, 12, 0.85)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="trn-page"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(440px, 100%)", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="tl-section-label" style={{ color: "#C5A059" }}>{cert.seasonLabel}</span>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--tl-fg-muted)" }}>
              {cert.tier.toUpperCase()} · {cert.edition} · {cert.rarity}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("tornei.close")}
            style={{ background: "transparent", border: "none", color: "var(--tl-fg-muted)", cursor: "pointer", padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <NftCertificate
          tier={tier}
          title={cert.tier.charAt(0).toUpperCase() + cert.tier.slice(1)}
          edition={cert.edition}
          rarity={cert.rarity}
          seasonLabel={cert.seasonLabel}
          userName={cert.userName ?? undefined}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <span
            style={{
              fontFamily: "var(--tl-font-mono)",
              fontSize: 12,
              padding: "5px 14px",
              borderRadius: 99,
              border: "1px solid rgba(197, 160, 89, 0.35)",
              background: "rgba(197, 160, 89, 0.08)",
              color: "#F5D78A",
            }}
          >
            {t(STATUS_KEY[cert.mintStatus] ?? "tornei.cert.claimable")}
          </span>
        </div>

        {/* Pulsanti Download HD e Condivisione */}
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <button
            type="button"
            disabled={downloading}
            onClick={async () => {
              try {
                setDownloading(true);
                await downloadTorneoCertificate({
                  tier,
                  userName: cert.userName || "Operatore Limen",
                  seasonLabel: cert.seasonLabel,
                  certId: cert.id,
                });
              } finally {
                setDownloading(false);
              }
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid rgba(197, 160, 89, 0.45)",
              background: "rgba(197, 160, 89, 0.12)",
              color: "#F5D78A",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Scarica Attestato Ufficiale HD (PNG 1024×1024)
          </button>

          <button
            type="button"
            onClick={handleShare}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #282A34",
              background: "transparent",
              color: "var(--tl-fg-muted)",
              fontSize: 12,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {copied ? <Check size={14} color="#4ba88e" /> : <Share2 size={14} />}
            {copied ? "Link di Verifica Copiato!" : "Copia Link di Verifica Crittografica"}
          </button>
        </div>

        {cert.mintStatus === "minted" && cert.txHash && (
          <p style={{ margin: 0, textAlign: "center", fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "hsl(var(--success))", wordBreak: "break-all" }}>
            <CheckCircle size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {cert.tokenId ? `#${cert.tokenId} · ` : ""}
            {cert.txHash.slice(0, 10)}…{cert.txHash.slice(-8)}
          </p>
        )}
        {cert.mintStatus === "failed" && (
          <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "hsl(0 84% 66%)" }}>
            <AlertTriangle size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {t("tornei.cert.failed")}
          </p>
        )}

        {cert.mintStatus !== "minted" && (
          <>
            {!mintEnabled ? (
              <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "var(--tl-fg-muted)" }}>
                {t("tornei.cert.mintSoon")}
              </p>
            ) : (
              <>
                {!hasWallet && (
                  <p style={{ margin: 0, textAlign: "center", fontSize: 12, color: "var(--tl-fg-muted)" }}>
                    {t("tornei.cert.noWallet")}
                  </p>
                )}
                <button
                  type="button"
                  className="trn-cta"
                  disabled={claiming || !hasWallet || cert.mintStatus === "pending"}
                  onClick={() => onClaim(cert.id)}
                  style={{ alignSelf: "center", width: "100%" }}
                >
                  {claiming ? <Loader2 size={16} className="animate-spin" /> : null}
                  {t("tornei.cert.claim")}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
