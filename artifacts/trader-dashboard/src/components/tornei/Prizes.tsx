import { Crown, Medal, Award, Shield, BadgeCheck, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { NftCertificate, type CertTier } from "./NftCertificate";

const PRIZE_CARDS: { id: string; icon: typeof Crown }[] = [
  { id: "champ", icon: Crown },
  { id: "podium", icon: Medal },
  { id: "top10", icon: Award },
  { id: "disc", icon: Shield },
  { id: "finish", icon: BadgeCheck },
];

const CERT_PREVIEWS: { tier: CertTier; title: string; edition: string; rarity: string }[] = [
  { tier: "champion", title: "Champion", edition: "Ed. 1 / 1", rarity: "Leggendario" },
  { tier: "podio", title: "Podio", edition: "Ed. 1 / 2", rarity: "Epico" },
  { tier: "finisher", title: "Finisher", edition: "Open Edition", rarity: "Raro" },
];

export function Prizes({ seasonLabel }: { seasonLabel: string }) {
  const { t } = useLanguage();

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <Sparkles size={16} color="hsl(45 96% 58%)" strokeWidth={1.9} />
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--tl-fg)" }}>{t("tornei.prizes.title")}</h3>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--tl-fg-muted)", maxWidth: 560, lineHeight: 1.55 }}>{t("tornei.prizes.intro")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(216px,1fr))", gap: "var(--trn-gap,16px)", marginBottom: 18 }}>
        {CERT_PREVIEWS.map((c) => (
          <NftCertificate key={c.tier} tier={c.tier} title={c.title} edition={c.edition} rarity={c.rarity} seasonLabel={seasonLabel} />
        ))}
      </div>

      <span className="tl-section-label" style={{ display: "block", marginBottom: 11 }}>{t("tornei.prizes.byRank")}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "var(--trn-gap,16px)" }}>
        {PRIZE_CARDS.map(({ id, icon: Icon }) => (
          <div key={id} className={`trn-prize trn-pz-${id}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span className="trn-chipico" style={{ color: "var(--pc)", background: "color-mix(in srgb, var(--pc) 13%, transparent)", border: "1px solid color-mix(in srgb, var(--pc) 32%, transparent)" }}>
                <Icon size={16} strokeWidth={1.9} />
              </span>
              <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: "10.5px", letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--pc)" }}>{t(`tornei.prize.${id}.rank`)}</span>
            </div>
            <p style={{ margin: 0, fontSize: "13.5px", fontWeight: 600, color: "var(--tl-fg)", lineHeight: 1.4 }}>{t(`tornei.prize.${id}.title`)}</p>
            <p style={{ margin: "auto 0 0", fontSize: "11.5px", color: "var(--tl-fg-muted)", lineHeight: 1.5 }}>{t(`tornei.prize.${id}.sub`)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
