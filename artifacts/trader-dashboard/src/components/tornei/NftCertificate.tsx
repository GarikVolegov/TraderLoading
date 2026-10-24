import { Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type CertTier = "champion" | "podio" | "finisher";

export const CERT_IMAGES: Record<CertTier, string> = {
  champion: "/images/tornei/cert-champion.jpg",
  podio: "/images/tornei/cert-podio.jpg",
  finisher: "/images/tornei/cert-finisher.jpg",
};

export interface NftCertificateProps {
  tier: CertTier;
  title: string;
  edition: string;
  rarity: string;
  seasonLabel: string;
  userName?: string;
  onClick?: () => void;
}

/** Carta certificato NFT con artwork imperiale Limen e sheen olografico. */
export function NftCertificate({ tier, title, edition: _edition, rarity, seasonLabel, userName, onClick }: NftCertificateProps) {
  const { t } = useLanguage();
  const imageSrc = CERT_IMAGES[tier] ?? CERT_IMAGES.finisher;

  return (
    <button
      type="button"
      className={`trn-nft trn-nft-${tier}${onClick ? " trn-nft-interactive" : ""}`}
      onClick={onClick}
      aria-label={`${title} - ${seasonLabel}`}
    >
      <div className="trn-nft-art">
        <img
          src={imageSrc}
          alt={`${title} - ${seasonLabel}`}
          className="trn-nft-img"
          loading="lazy"
        />
        {userName && (
          <div className="trn-nft-nameplate">
            <span className="trn-nft-nameplate-text">{userName}</span>
          </div>
        )}
        <span className="trn-nft-sheen" />
      </div>
      <div className="trn-nft-foot">
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="trn-nft-rarity">
            <Sparkles size={11} strokeWidth={2} />
            {rarity}
          </span>
          <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: "8.5px", color: "hsl(215 20% 56%)" }}>
            {t("tornei.cert.verify")}
          </span>
        </span>
        <span className="trn-nft-erc">{"ERC-721"}</span>
      </div>
    </button>
  );
}
