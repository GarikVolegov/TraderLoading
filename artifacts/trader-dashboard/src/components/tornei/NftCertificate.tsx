import { Crown, Medal, Award, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export type CertTier = "champion" | "podio" | "finisher";

const SEAL_ICON: Record<CertTier, typeof Crown> = {
  champion: Crown,
  podio: Medal,
  finisher: Award,
};

export interface NftCertificateProps {
  tier: CertTier;
  title: string;
  edition: string;
  rarity: string;
  seasonLabel: string;
  onClick?: () => void;
}

/** Carta certificato NFT olografica, portata dal design `templates/tornei`. */
export function NftCertificate({ tier, title, edition, rarity, seasonLabel, onClick }: NftCertificateProps) {
  const { t } = useLanguage();
  const Seal = SEAL_ICON[tier] ?? Award;
  return (
    <button type="button" className={`trn-nft trn-nft-${tier}`} onClick={onClick}>
      <div className="trn-nft-art">
        <span className="trn-nft-sheen" />
        <span className="trn-nft-eyebrow">{t("tornei.cert.eyebrow")}</span>
        <span className="trn-nft-ed">{edition}</span>
        <span className="trn-seal">
          <Seal size={34} strokeWidth={1.6} />
        </span>
        <span className="trn-nft-title">{title}</span>
        <span className="trn-nft-season">{t("tornei.season", { label: seasonLabel })}</span>
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
