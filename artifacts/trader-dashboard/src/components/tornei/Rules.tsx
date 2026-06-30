import { RefreshCw, Shield, Flame, BookOpen } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const RULES: { id: string; icon: typeof Shield }[] = [
  { id: "sync", icon: RefreshCw },
  { id: "risk", icon: Shield },
  { id: "drawdown", icon: Flame },
  { id: "journal", icon: BookOpen },
];

export function Rules() {
  const { t } = useLanguage();

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 13 }}>
        <Shield size={16} color="hsl(142 71% 55%)" strokeWidth={1.9} />
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--tl-fg)" }}>{t("tornei.rules.title")}</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: "var(--trn-gap,16px)" }}>
        {RULES.map(({ id, icon: Icon }) => (
          <div key={id} className="trn-rule">
            <span className="trn-chipico" style={{ color: "hsl(142 71% 55%)", background: "hsl(142 71% 45% / 0.1)", border: "1px solid hsl(142 71% 45% / 0.25)" }}>
              <Icon size={15} strokeWidth={1.9} />
            </span>
            <div>
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "var(--tl-fg)" }}>{t(`tornei.rule.${id}.title`)}</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--tl-fg-muted)", lineHeight: 1.5 }}>{t(`tornei.rule.${id}.text`)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
