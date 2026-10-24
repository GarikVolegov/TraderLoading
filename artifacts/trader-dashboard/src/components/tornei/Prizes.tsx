import { useState } from "react";
import { Crown, Medal, Award, Shield, BadgeCheck, Sparkles, X, Download, Loader2, QrCode } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUser } from "@clerk/react";
import { NftCertificate, type CertTier } from "./NftCertificate";
import { downloadTorneoCertificate } from "./torneoCertificateExport";

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
  const { user } = useUser();
  const defaultTraderName = user?.fullName || user?.username || user?.firstName || "GARIKFX";

  const [previewCert, setPreviewCert] = useState<(typeof CERT_PREVIEWS)[number] | null>(null);
  const [customName, setCustomName] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  const activeName = (customName.trim() || defaultTraderName).toUpperCase();

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
        <Sparkles size={16} color="hsl(45 96% 58%)" strokeWidth={1.9} />
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--tl-fg)" }}>{t("tornei.prizes.title")}</h3>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: "12.5px", color: "var(--tl-fg-muted)", maxWidth: 560, lineHeight: 1.55 }}>{t("tornei.prizes.intro")}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(216px,1fr))", gap: "var(--trn-gap,16px)", marginBottom: 18 }}>
        {CERT_PREVIEWS.map((c) => (
          <NftCertificate
            key={c.tier}
            tier={c.tier}
            title={c.title}
            edition={c.edition}
            rarity={c.rarity}
            seasonLabel={seasonLabel}
            userName={activeName}
            onClick={() => setPreviewCert(c)}
          />
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

      {previewCert && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewCert(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(5, 7, 10, 0.88)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(480px, 94vw)",
              background: "#0c0e14",
              border: "1px solid rgba(197, 160, 89, 0.4)",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.9)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="tl-section-label" style={{ margin: 0, color: "#C5A059" }}>
                  {previewCert.title} · {previewCert.edition}
                </span>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--tl-fg-muted)" }}>
                  {seasonLabel} · {previewCert.rarity} · Personalizzazione Attiva
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                aria-label={t("tornei.close")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--tl-fg-muted)",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Visualizzazione dell'attestato con personalizzazione in tempo reale */}
            <div style={{ width: "min(340px, 100%)", margin: "0 auto" }}>
              <NftCertificate
                tier={previewCert.tier}
                title={previewCert.title}
                edition={previewCert.edition}
                rarity={previewCert.rarity}
                seasonLabel={seasonLabel}
                userName={activeName}
              />
            </div>

            {/* Selettore rapido dei tier */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {CERT_PREVIEWS.map((c) => (
                <button
                  key={c.tier}
                  type="button"
                  onClick={() => setPreviewCert(c)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontFamily: "var(--tl-font-mono)",
                    border: `1px solid ${previewCert.tier === c.tier ? "#C5A059" : "rgba(255,255,255,0.12)"}`,
                    background: previewCert.tier === c.tier ? "rgba(197,160,89,0.15)" : "transparent",
                    color: previewCert.tier === c.tier ? "#F5D78A" : "var(--tl-fg-muted)",
                    cursor: "pointer",
                  }}
                >
                  {c.title}
                </button>
              ))}
            </div>

            {/* Input di personalizzazione del nome in tempo reale */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  fontFamily: "var(--tl-font-mono)",
                  color: "var(--tl-fg-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Personalizza Nome sull&apos;Attestato:
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={defaultTraderName}
                  maxLength={30}
                  style={{
                    flex: 1,
                    padding: "9px 13px",
                    borderRadius: 8,
                    background: "#12141A",
                    border: "1px solid rgba(197, 160, 89, 0.45)",
                    color: "#F5D78A",
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: "var(--tl-font-mono)",
                    outline: "none",
                  }}
                />
                {customName && (
                  <button
                    type="button"
                    onClick={() => setCustomName("")}
                    style={{
                      padding: "0 12px",
                      borderRadius: 8,
                      background: "transparent",
                      border: "1px solid #282A34",
                      color: "var(--tl-fg-muted)",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Pulsanti di azione: Download HD e Verifica QR */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
              <button
                type="button"
                className="trn-cta"
                disabled={downloading}
                onClick={async () => {
                  try {
                    setDownloading(true);
                    await downloadTorneoCertificate({
                      tier: previewCert.tier,
                      userName: activeName,
                      seasonLabel,
                    });
                  } finally {
                    setDownloading(false);
                  }
                }}
                style={{
                  flex: 1,
                  minWidth: 200,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 18px",
                }}
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Scarica Attestato HD (1024×1024 PNG)
              </button>
            </div>

            <p style={{ margin: 0, fontSize: 11, color: "var(--tl-fg-muted)", textAlign: "center", lineHeight: 1.45 }}>
              <QrCode size={13} style={{ verticalAlign: "-2px", marginRight: 5, color: "#C5A059" }} />
              QR Code attivo: inquadrandolo con lo smartphone rimanda alla pagina di verifica ufficiale Limen.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
