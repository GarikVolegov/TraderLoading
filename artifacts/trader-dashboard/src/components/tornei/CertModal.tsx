import { X, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NftCertificate, type CertTier } from "./NftCertificate";
import type { TorneiCertificate } from "@/lib/torneiApi";

interface CertModalProps {
  cert: TorneiCertificate | null;
  claiming: boolean;
  hasWallet: boolean;
  onClaim: (id: number) => void;
  onClose: () => void;
}

const STATUS_KEY: Record<string, string> = {
  claimable: "tornei.cert.claimable",
  pending: "tornei.cert.pending",
  minted: "tornei.cert.minted",
  failed: "tornei.cert.failed",
};

export function CertModal({ cert, claiming, hasWallet, onClaim, onClose }: CertModalProps) {
  const { t } = useLanguage();
  if (!cert) return null;
  const tier = cert.tier as CertTier;

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
        background: "hsl(222 47% 3% / 0.72)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        className="trn-page"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(420px, 100%)", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="tl-section-label">{cert.seasonLabel}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("tornei.close")}
            style={{ background: "transparent", border: "none", color: "var(--tl-fg-muted)", cursor: "pointer" }}
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
        />

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <span
            style={{
              fontFamily: "var(--tl-font-mono)",
              fontSize: 12,
              padding: "5px 12px",
              borderRadius: 99,
              border: "1px solid hsl(215 25% 27% / 0.5)",
              color: "var(--tl-fg-muted)",
            }}
          >
            {t(STATUS_KEY[cert.mintStatus] ?? "tornei.cert.claimable")}
          </span>
        </div>

        {cert.mintStatus === "minted" && cert.txHash && (
          <p style={{ margin: 0, textAlign: "center", fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "hsl(142 71% 60%)", wordBreak: "break-all" }}>
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
              style={{ alignSelf: "center" }}
            >
              {claiming ? <Loader2 size={16} className="animate-spin" /> : null}
              {t("tornei.cert.claim")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
