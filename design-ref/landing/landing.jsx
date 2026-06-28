/* TraderLoading — Landing page. Animated, full-funnel marketing site that
   conveys the product's mission at a glance: an all-in-one trading workspace
   (journal · macro news · risk tools · backtest · discipline · community).
   Helpers live in landing-ui.jsx (window globals). */

const sectionPad = { position: "relative", zIndex: 10, padding: "0 24px" };
const wrap = { maxWidth: 1180, margin: "0 auto" };
const eyebrow = (txt) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".14em", color: "hsl(var(--primary))", fontFamily: "var(--tl-font-mono)" }}>
    <span style={{ width: 18, height: 1, background: "hsl(var(--primary) / 0.6)" }} />{txt}
  </span>
);
const sectionTitle = { fontFamily: "var(--tl-font-mono)", fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.12, color: "var(--tl-fg)", margin: "14px 0 0" };
const lede = { fontSize: 17, lineHeight: 1.6, color: "var(--tl-fg-muted)", margin: "14px 0 0" };

/* ── HERO ─────────────────────────────────────────────── */
function Hero() {
  return (
    <main style={{ ...sectionPad, padding: "60px 24px 90px" }}>
      <div style={{ ...wrap, display: "grid", gridTemplateColumns: "minmax(0,1.05fr) minmax(0,0.95fr)", gap: 56, alignItems: "center" }}>
        <Reveal>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "hsl(var(--primary)/0.1)", border: "1px solid hsl(var(--primary)/0.25)", color: "hsl(var(--primary))", fontSize: 12.5, fontWeight: 600, padding: "8px 15px", borderRadius: 999, marginBottom: 26 }}>
            <span style={{ width: 8, height: 8, background: "hsl(var(--primary))", borderRadius: 999, animation: "tl-pulse 1.6s ease-in-out infinite" }} />
            Il workspace di trading all-in-one
          </span>
          <h1 style={{ fontFamily: "var(--tl-font-mono)", fontSize: 62, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, margin: "0 0 22px", color: "var(--tl-fg)" }}>
            Fai trading meglio,<br />
            <span style={{ color: "transparent", WebkitBackgroundClip: "text", backgroundClip: "text", backgroundImage: "linear-gradient(100deg, hsl(var(--primary)), #6ee7b7 55%, hsl(217 91% 60%))" }}>non di più.</span>
          </h1>
          <p style={{ fontSize: 19, color: "var(--tl-fg-muted)", maxWidth: 540, margin: "0 0 32px", lineHeight: 1.6 }}>
            Diario sincronizzato dal broker, notizie macro in tempo reale, strumenti di rischio, backtest sui grafici reali e routine di disciplina. Tutto in un unico cockpit.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 30 }}>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", padding: "15px 30px", borderRadius: 13, border: "none", cursor: "pointer", boxShadow: "0 0 34px rgba(34,197,94,0.34)" }}>
              Inizia gratis<Icon name="arrow-right" size={18} />
            </button>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 600, border: "1px solid var(--tl-border)", background: "hsl(var(--card)/0.5)", color: "var(--tl-fg)", padding: "15px 26px", borderRadius: 13, cursor: "pointer", backdropFilter: "blur(8px)" }}>
              <Icon name="play-circle" size={18} />Guarda la demo
            </button>
          </div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center", color: "var(--tl-fg-muted)", fontSize: 13.5 }}>
            {[["check", "Nessuna carta richiesta"], ["lock", "Broker in sola lettura"], ["globe", "5 lingue"]].map(([ic, t]) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Icon name={ic} size={15} color="hsl(var(--primary))" />{t}</span>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.12} y={36}><ProductMock /></Reveal>
      </div>
    </main>
  );
}

/* ── STATS BAR ────────────────────────────────────────── */
const STATS = [
  { v: 12000, suffix: "+", label: "Trader attivi" },
  { v: 2.4, decimals: 1, suffix: "M", label: "Trade journaled" },
  { v: 48, label: "Pair & asset seguiti" },
  { v: 17, suffix: "%", label: "Win-rate medio in più" },
];
function StatsBar() {
  return (
    <section style={{ ...sectionPad, padding: "0 24px 36px" }}>
      <Reveal style={{ ...wrap }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, borderRadius: 20, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.4)", backdropFilter: "blur(10px)", padding: "26px 24px" }}>
          {STATS.map((s) => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 800, fontSize: 34, letterSpacing: "-0.02em", color: "var(--tl-fg)" }}>
                <CountUp value={s.v} decimals={s.decimals || 0} suffix={s.suffix || ""} />
              </div>
              <div style={{ fontSize: 13, color: "var(--tl-fg-muted)", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ── FEATURES (bento) ─────────────────────────────────── */
const FEATURES = [
  { icon: "book-open", title: "Diario sincronizzato", desc: "Importa ogni trade da MT4/MT5 via FX Blue e analizza R-multiple, win-rate ed equity reale.", tone: "hsl(142 71% 45%)", big: true,
    visual: "equity" },
  { icon: "newspaper", title: "News macro AI", desc: "Notizie in tempo reale con impatto, sentiment e pair coinvolti.", tone: "hsl(217 91% 60%)" },
  { icon: "calculator", title: "Risk tools", desc: "Lotti, sessioni, calendario economico e Monte Carlo.", tone: "hsl(142 71% 45%)" },
  { icon: "flask-conical", title: "Backtest replay", desc: "Rivivi il mercato candela per candela sui grafici reali.", tone: "hsl(262 83% 65%)" },
  { icon: "brain", title: "Disciplina & Zen", desc: "Missioni, XP, routine e check-in emotivi per restare costante.", tone: "hsl(38 92% 50%)" },
  { icon: "users", title: "Community", desc: "Feed social, messaggi E2EE e classifica trader.", tone: "hsl(217 91% 60%)" },
];
function FeatureCard({ f, i }) {
  return (
    <Reveal delay={(i % 3) * 0.06} style={{ gridColumn: f.big ? "span 2" : "span 1", gridRow: f.big ? "span 2" : "span 1" }}>
      <div className="lp-card" style={{ height: "100%", display: "flex", flexDirection: "column", gap: 14, borderRadius: 20, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.5)", backdropFilter: "blur(8px)", padding: f.big ? 30 : 24, transition: "transform .25s var(--tl-ease-spring), border-color .25s, box-shadow .25s" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${f.tone} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${f.tone} 25%, transparent)`, color: f.tone }}>
          <Icon name={f.icon} size={24} />
        </div>
        <h3 style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: f.big ? 24 : 18, margin: 0, color: "var(--tl-fg)", letterSpacing: "-0.02em" }}>{f.title}</h3>
        <p style={{ color: "var(--tl-fg-muted)", lineHeight: 1.6, fontSize: f.big ? 16 : 14, margin: 0 }}>{f.desc}</p>
        {f.visual === "equity" && (
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {[["Win Rate", "64%"], ["Expectancy", "+0.42R"], ["Profit Factor", "1.9"]].map(([l, v]) => (
                <div key={l} style={{ flex: 1, textAlign: "center", borderRadius: 12, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--secondary) / 0.5)", padding: "10px 8px" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".06em", color: "hsl(var(--muted-foreground) / 0.8)" }}>{l}</div>
                  <div style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 16, color: "hsl(142 71% 45%)" }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ borderRadius: 12, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--secondary) / 0.4)", padding: "10px 12px" }}>
              <MockSpark />
            </div>
          </div>
        )}
      </div>
    </Reveal>
  );
}
function Features() {
  return (
    <section id="features" style={{ ...sectionPad, padding: "70px 24px" }}>
      <div style={wrap}>
        <Reveal style={{ maxWidth: 620, marginBottom: 40 }}>
          {eyebrow("Una piattaforma, tutto il workflow")}
          <h2 style={sectionTitle}>Tutto ciò che serve per fare trading con metodo</h2>
          <p style={lede}>Smetti di saltare tra dieci app. TraderLoading riunisce dati, analisi e disciplina in un solo posto.</p>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: "1fr", gap: 18 }}>
          {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} i={i} />)}
        </div>
      </div>
    </section>
  );
}

/* ── HOW IT WORKS ─────────────────────────────────────── */
const STEPS = [
  { n: "01", icon: "link", title: "Collega il tuo broker", desc: "Connessione FX Blue in sola lettura: i tuoi trade MT4/MT5 si importano da soli, in sicurezza." },
  { n: "02", icon: "line-chart", title: "Registra e analizza", desc: "Ogni trade diventa dati: R-multiple, equity curve, leak e scomposizione del tuo edge." },
  { n: "03", icon: "trophy", title: "Migliora con disciplina", desc: "Missioni, routine e check-in emotivi trasformano le buone abitudini in risultati costanti." },
];
function HowItWorks() {
  return (
    <section id="how" style={{ ...sectionPad, padding: "70px 24px" }}>
      <div style={wrap}>
        <Reveal style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 48px" }}>
          {eyebrow("Come funziona")}
          <h2 style={sectionTitle}>Dal caos al metodo in tre passi</h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, position: "relative" }}>
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div style={{ height: "100%", borderRadius: 20, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.45)", backdropFilter: "blur(8px)", padding: 28 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                  <span style={{ width: 46, height: 46, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.22)", color: "hsl(var(--primary))" }}>
                    <Icon name={s.icon} size={22} />
                  </span>
                  <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 800, fontSize: 34, color: "hsl(var(--primary) / 0.18)" }}>{s.n}</span>
                </div>
                <h3 style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 19, margin: "0 0 10px", color: "var(--tl-fg)", letterSpacing: "-0.02em" }}>{s.title}</h3>
                <p style={{ color: "var(--tl-fg-muted)", lineHeight: 1.6, fontSize: 15, margin: 0 }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── SHOWCASE ─────────────────────────────────────────── */
function ShowcaseRow({ flip, eyebrowTxt, title, desc, points, children }) {
  const text = (
    <Reveal style={{ flex: 1 }}>
      {eyebrow(eyebrowTxt)}
      <h2 style={{ ...sectionTitle, fontSize: 32 }}>{title}</h2>
      <p style={lede}>{desc}</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "22px 0 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {points.map((p) => (
          <li key={p} style={{ display: "flex", alignItems: "center", gap: 11, fontSize: 15, color: "var(--tl-fg)" }}>
            <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}><Icon name="check" size={13} /></span>{p}
          </li>
        ))}
      </ul>
    </Reveal>
  );
  const visual = <Reveal delay={0.1} y={32} style={{ flex: 1, width: "100%" }}>{children}</Reveal>;
  return (
    <div style={{ display: "flex", gap: 50, alignItems: "center", flexDirection: flip ? "row-reverse" : "row" }}>
      {text}{visual}
    </div>
  );
}
function GlassPanel({ children, style }) {
  return <div style={{ borderRadius: 18, border: "1px solid hsl(var(--border) / 0.55)", background: "hsl(var(--card) / 0.6)", backdropFilter: "blur(12px)", boxShadow: "0 30px 70px rgba(0,0,0,0.4)", padding: 20, ...style }}>{children}</div>;
}
function Showcase() {
  const NEWS = [
    { t: "Powell apre a tagli dei tassi", imp: "ALTO", impc: "hsl(0 84% 60%)", sen: "Ribassista", senc: "hsl(0 84% 60%)", pairs: ["USD", "XAU"] },
    { t: "PMI eurozona sopra le attese", imp: "MEDIO", impc: "hsl(38 92% 50%)", sen: "Rialzista", senc: "hsl(142 71% 45%)", pairs: ["EUR"] },
  ];
  return (
    <section style={{ ...sectionPad, padding: "60px 24px" }}>
      <div style={{ ...wrap, display: "flex", flexDirection: "column", gap: 72 }}>
        <ShowcaseRow flip eyebrowTxt="News in tempo reale"
          title="Il contesto macro, già interpretato"
          desc="Un agente AI legge il flusso di notizie e te lo restituisce con impatto, sentiment e pair coinvolti — così sai subito cosa conta per i tuoi trade."
          points={["Punteggio d'impatto 0–10", "Sentiment per asset", "Sintesi di mercato giornaliera"]}>
          <GlassPanel>
            <div style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid hsl(var(--primary) / 0.2)", background: "hsl(var(--primary) / 0.06)", marginBottom: 12 }}>
              <Icon name="newspaper" size={16} color="hsl(var(--primary))" />
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "hsl(var(--foreground) / 0.9)" }}>Tono risk-off sul dollaro: oro ed euro in forza, alta volatilità attesa sui payroll.</p>
            </div>
            {NEWS.map((n) => (
              <div key={n.t} style={{ display: "flex", flexDirection: "column", gap: 7, padding: "12px", borderRadius: 12, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.5)", marginBottom: 10 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: n.impc, background: `color-mix(in srgb, ${n.impc} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${n.impc} 30%, transparent)` }}><Icon name="zap" size={10} />{n.imp}</span>
                  <span style={{ padding: "2px 7px", borderRadius: 6, fontSize: 11, fontWeight: 600, color: n.senc, background: `color-mix(in srgb, ${n.senc} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${n.senc} 25%, transparent)` }}>{n.sen}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--tl-fg)" }}>{n.t}</p>
                <div style={{ display: "flex", gap: 5 }}>{n.pairs.map((p) => <span key={p} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontFamily: "var(--tl-font-mono)", fontWeight: 700, background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.25)" }}>{p}</span>)}</div>
              </div>
            ))}
          </GlassPanel>
        </ShowcaseRow>

        <ShowcaseRow eyebrowTxt="Backtest replay"
          title="Allena il tuo edge sui dati reali"
          desc="Rivivi qualsiasi sessione candela per candela. Piazza BUY e SELL, misura le statistiche e affina la strategia prima di rischiare un euro."
          points={["Multi-timeframe M5 → D1", "Statistiche di sessione live", "Dati storici reali"]}>
          <GlassPanel>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 16, color: "var(--tl-fg)" }}>XAU/USD</span>
              <div style={{ display: "flex", gap: 4 }}>{["M15", "H1", "H4"].map((t, i) => <span key={t} style={{ padding: "4px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: "var(--tl-font-mono)", background: i === 0 ? "hsl(var(--primary))" : "hsl(var(--secondary) / 0.6)", color: i === 0 ? "hsl(var(--primary-foreground))" : "var(--tl-fg-muted)" }}>{t}</span>)}</div>
            </div>
            <svg viewBox="0 0 360 130" width="100%" height="130" preserveAspectRatio="none" style={{ display: "block", marginBottom: 12 }}>
              {[40,62,54,78,72,90,84,100,116,108,130,122,144,138].map((c, i) => {
                const x = i * 26 + 14, up = i % 2 === 0, col = up ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
                const h = c, l = c - 26, o = up ? l + 6 : h - 6, cl = up ? h - 4 : l + 4;
                const bt = 130 - Math.max(o, cl), bb = 130 - Math.min(o, cl);
                return <g key={i}><line x1={x} y1={130 - h} x2={x} y2={130 - l} stroke={col} strokeWidth="1.5" /><rect x={x - 6} y={bt} width="12" height={Math.max(2, bb - bt)} fill={col} rx="1.5" /></g>;
              })}
            </svg>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, border: "1px solid hsl(142 71% 45% / 0.4)", background: "hsl(142 71% 45% / 0.1)", color: "hsl(142 71% 45%)", fontWeight: 700, fontSize: 13 }}>BUY</div>
              <div style={{ flex: 1, textAlign: "center", padding: "10px 8px", borderRadius: 10, border: "1px solid hsl(0 84% 60% / 0.4)", background: "hsl(0 84% 60% / 0.1)", color: "hsl(0 84% 60%)", fontWeight: 700, fontSize: 13 }}>SELL</div>
            </div>
          </GlassPanel>
        </ShowcaseRow>

        <ShowcaseRow flip eyebrowTxt="Disciplina gamificata"
          title="La costanza diventa un'abitudine"
          desc="Missioni giornaliere, XP, livelli, streak e routine guidate mattina e sera. Il lato psicologico del trading, finalmente allenabile."
          points={["Missioni & XP giornalieri", "Routine mattutina e serale", "Check-in emotivi e streak"]}>
          <GlassPanel>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              <div style={{ width: 58, height: 58, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--primary) / 0.1)" }}>
                <span style={{ fontSize: 8, textTransform: "uppercase", color: "hsl(var(--primary) / 0.7)" }}>Livello</span>
                <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 24, color: "hsl(var(--primary))" }}>12</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14, color: "var(--tl-fg)" }}>Trader Disciplinato</p>
                <div style={{ height: 7, borderRadius: 99, background: "hsl(var(--secondary))", overflow: "hidden" }}><div style={{ width: "72%", height: "100%", background: "linear-gradient(90deg, hsl(var(--primary)), #6ee7b7)" }} /></div>
              </div>
            </div>
            {[["Journaling del Trade", true, "+75"], ["Check-in emotivo", true, "+40"], ["Checklist pre-trade", false, "+60"]].map(([t, done, xp]) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid hsl(var(--border) / 0.3)" }}>
                <Icon name={done ? "check-circle-2" : "circle"} size={17} color={done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"} />
                <span style={{ flex: 1, fontSize: 13, color: done ? "var(--tl-fg-muted)" : "var(--tl-fg)", textDecoration: done ? "line-through" : "none" }}>{t}</span>
                <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 10, fontWeight: 700, color: "hsl(var(--accent))", padding: "2px 7px", borderRadius: 6, background: "hsl(var(--secondary) / 0.5)" }}>{xp} XP</span>
              </div>
            ))}
          </GlassPanel>
        </ShowcaseRow>
      </div>
    </section>
  );
}

/* ── TESTIMONIALS ─────────────────────────────────────── */
const QUOTES = [
  { name: "Sara C.", role: "Swing trader · 3 anni", text: "Da quando registro ogni trade qui il mio win-rate è passato dal 48% al 61%. Vedere i numeri reali cambia tutto." },
  { name: "Marco R.", role: "Day trader · forex", text: "Le notizie con impatto e sentiment mi fanno risparmiare un'ora ogni mattina. È il mio primo schermo all'apertura." },
  { name: "Giulia B.", role: "Prop firm challenge", text: "Le routine e le missioni mi tengono disciplinata. Ho superato la challenge senza sforare il rischio una volta." },
];
function Testimonials() {
  return (
    <section style={{ ...sectionPad, padding: "70px 24px" }}>
      <div style={wrap}>
        <Reveal style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 44px" }}>
          {eyebrow("Storie reali")}
          <h2 style={sectionTitle}>I trader che fanno sul serio scelgono il metodo</h2>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={i * 0.08}>
              <div style={{ height: "100%", borderRadius: 20, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.5)", backdropFilter: "blur(8px)", padding: 26, display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 3 }}>{[0,1,2,3,4].map((s) => <Icon key={s} name="star" size={15} color="hsl(38 92% 50%)" />)}</div>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "hsl(var(--foreground) / 0.92)", flex: 1 }}>“{q.text}”</p>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 11, border: "1px solid hsl(var(--primary) / 0.3)", background: "hsl(var(--card))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--tl-font-mono)", fontWeight: 700, color: "hsl(var(--primary))", fontSize: 14 }}>{q.name.split(" ").map((w) => w[0]).join("")}</span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--tl-fg)" }}>{q.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: "var(--tl-fg-muted)" }}>{q.role}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── PRICING ──────────────────────────────────────────── */
const FREE = ["Diario di trading sincronizzato", "Notizie macro in tempo reale", "Strumenti di gestione rischio", "Routine, missioni e XP"];
const PRO = ["Backtest su grafici reali", "Classifiche trader", "Sync broker account (FX Blue)", "Analisi Edge avanzata"];
function Pricing() {
  return (
    <section id="pricing" style={{ ...sectionPad, padding: "70px 24px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 40 }}>
          {eyebrow("Prezzi")}
          <h2 style={sectionTitle}>Inizia gratis. Passa a Pro quando sei pronto.</h2>
        </Reveal>
        <Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div style={{ borderRadius: 22, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.45)", backdropFilter: "blur(8px)", padding: 30, display: "flex", flexDirection: "column" }}>
              <h3 style={{ fontWeight: 700, fontSize: 20, margin: "0 0 4px", color: "var(--tl-fg)" }}>Free</h3>
              <p style={{ fontSize: 40, fontWeight: 800, margin: "0 0 22px", color: "var(--tl-fg)", fontFamily: "var(--tl-font-mono)" }}>0€<span style={{ fontSize: 15, fontWeight: 400, color: "var(--tl-fg-muted)" }}>/mese</span></p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {FREE.map((i) => <li key={i} style={{ display: "flex", alignItems: "center", gap: 11, color: "var(--tl-fg-muted)", fontSize: 14.5 }}><Icon name="check" size={16} color="hsl(var(--muted-foreground))" />{i}</li>)}
              </ul>
              <button style={{ width: "100%", fontSize: 15, fontWeight: 600, border: "1px solid var(--tl-border)", background: "hsl(var(--card)/0.5)", color: "var(--tl-fg)", padding: 13, borderRadius: 12, cursor: "pointer" }}>Inizia gratis</button>
            </div>
            <div className="lp-card" style={{ position: "relative", borderRadius: 22, border: "1px solid hsl(var(--primary) / 0.45)", background: "hsl(var(--card) / 0.65)", backdropFilter: "blur(8px)", padding: 30, display: "flex", flexDirection: "column", boxShadow: "0 0 50px rgba(34,197,94,0.14)" }}>
              <span style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontSize: 11, fontWeight: 700, padding: "6px 16px", borderRadius: 999, boxShadow: "0 0 18px rgba(34,197,94,0.4)" }}>Più scelto</span>
              <h3 style={{ fontWeight: 700, fontSize: 20, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8, color: "var(--tl-fg)" }}><Icon name="crown" size={20} color="hsl(var(--primary))" />Pro</h3>
              <p style={{ fontSize: 40, fontWeight: 800, margin: "0 0 22px", color: "var(--tl-fg)", fontFamily: "var(--tl-font-mono)" }}>7€<span style={{ fontSize: 15, fontWeight: 400, color: "var(--tl-fg-muted)" }}>/mese</span></p>
              <p style={{ fontSize: 12.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--tl-fg-muted)", margin: "0 0 12px" }}>Tutto Free, più:</p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 28px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {PRO.map((i) => <li key={i} style={{ display: "flex", alignItems: "center", gap: 11, fontWeight: 500, fontSize: 14.5, color: "var(--tl-fg)" }}><Icon name="check" size={16} color="hsl(var(--primary))" />{i}</li>)}
              </ul>
              <button style={{ width: "100%", fontSize: 15, fontWeight: 700, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", padding: 13, borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}>Passa a Pro</button>
            </div>
          </div>
          <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--tl-fg-muted)", marginTop: 22 }}>Annulla quando vuoi · Pagamenti sicuri con Stripe</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FAQ ──────────────────────────────────────────────── */
const FAQ = [
  { q: "TraderLoading è gratuito?", a: "Sì. Crei un account e usi diario, notizie macro, strumenti di rischio e routine gratis, senza carta di credito." },
  { q: "Come funziona la sincronizzazione dei trade?", a: "Si collega al tuo account MT4/MT5 via FX Blue in sola lettura. Ogni trade chiuso viene importato con ingresso, uscita, SL, TP, P&L, commissioni e swap." },
  { q: "Il mio account di trading è al sicuro?", a: "Sì. La connessione è in sola lettura con la password investor: TraderLoading non può inserire ordini né modificare l'account." },
  { q: "Cosa lo rende diverso dagli altri diari?", a: "Unisce strumenti di solito separati: diario con R-multiple, notizie macro AI, equity reale e un layer psicologico con check-in e routine." },
  { q: "Devo installare qualcosa?", a: "No. Funziona nel browser su desktop e mobile e si può installare come PWA per un'esperienza simile a un'app." },
];
function Faq() {
  const [open, setOpen] = React.useState(0);
  return (
    <section id="faq" style={{ ...sectionPad, padding: "70px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Reveal style={{ textAlign: "center", marginBottom: 40 }}>
          {eyebrow("FAQ")}
          <h2 style={sectionTitle}>Domande frequenti</h2>
        </Reveal>
        <Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={i} onClick={() => setOpen(isOpen ? -1 : i)} style={{ borderRadius: 16, border: `1px solid ${isOpen ? "hsl(var(--primary)/0.35)" : "hsl(var(--border)/0.5)"}`, background: isOpen ? "hsl(var(--card)/0.6)" : "hsl(var(--card)/0.4)", backdropFilter: "blur(8px)", padding: "18px 24px", cursor: "pointer", transition: "border-color .2s, background .2s" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontWeight: 700, fontSize: 16.5, color: "var(--tl-fg)" }}>{item.q}</span>
                    <span style={{ color: "hsl(var(--primary))", fontSize: 24, lineHeight: 1, transform: isOpen ? "rotate(45deg)" : "none", transition: "transform .2s", flexShrink: 0 }}>+</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateRows: isOpen ? "1fr" : "0fr", transition: "grid-template-rows .28s var(--tl-ease-out)" }}>
                    <div style={{ overflow: "hidden" }}>
                      <p style={{ margin: "12px 0 0", color: "var(--tl-fg-muted)", lineHeight: 1.6, fontSize: 14.5 }}>{item.a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FINAL CTA ────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section style={{ ...sectionPad, padding: "40px 24px 90px" }}>
      <Reveal style={wrap}>
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 28, border: "1px solid hsl(var(--primary) / 0.25)", background: "linear-gradient(135deg, hsl(var(--card) / 0.8), hsl(226 43% 8% / 0.8))", padding: "60px 40px", textAlign: "center" }}>
          <div style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "hsl(var(--primary) / 0.12)", filter: "blur(120px)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <h2 style={{ fontFamily: "var(--tl-font-mono)", fontSize: 42, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px", color: "var(--tl-fg)" }}>Pronto a fare trading con metodo?</h2>
            <p style={{ fontSize: 18, color: "var(--tl-fg-muted)", maxWidth: 520, margin: "0 auto 30px", lineHeight: 1.6 }}>Unisciti a migliaia di trader che hanno smesso di improvvisare. Gratis, in due minuti.</p>
            <button style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 17, fontWeight: 700, background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", padding: "16px 36px", borderRadius: 14, border: "none", cursor: "pointer", boxShadow: "0 0 40px rgba(34,197,94,0.4)" }}>
              Inizia gratis<Icon name="arrow-right" size={18} />
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── FOOTER ───────────────────────────────────────────── */
function Footer() {
  const cols = [
    ["Prodotto", ["Diario", "News macro", "Backtest", "Risk tools", "Prezzi"]],
    ["Risorse", ["Guida", "Blog", "Community", "Stato del servizio"]],
    ["Azienda", ["Chi siamo", "Contatti", "Privacy", "Termini"]],
  ];
  return (
    <footer style={{ position: "relative", zIndex: 10, borderTop: "1px solid hsl(var(--border) / 0.4)", background: "hsl(var(--background) / 0.6)", backdropFilter: "blur(12px)" }}>
      <div style={{ ...wrap, display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 32, padding: "50px 24px 30px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ display: "flex", width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 999, border: "1px solid hsl(var(--primary)/0.35)", background: "hsl(var(--primary)/0.15)", color: "hsl(var(--primary))" }}><Icon name="terminal-square" size={17} /></span>
            <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 17, color: "var(--tl-fg)" }}>TraderLoading</span>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--tl-fg-muted)", lineHeight: 1.6, maxWidth: 280 }}>Il workspace di trading all-in-one. Fai trading meglio, non di più.</p>
        </div>
        {cols.map(([title, items]) => (
          <div key={title}>
            <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--tl-fg)" }}>{title}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {items.map((it) => <a key={it} href="#" style={{ fontSize: 13.5, color: "var(--tl-fg-muted)", textDecoration: "none" }}>{it}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ ...wrap, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "20px 24px", borderTop: "1px solid hsl(var(--border) / 0.3)", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 13, color: "hsl(var(--muted-foreground) / 0.7)" }}>© 2026 TraderLoading. Tutti i diritti riservati.</p>
        <div style={{ display: "flex", gap: 12 }}>
          {["twitter", "instagram", "youtube", "send"].map((s) => (
            <span key={s} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid hsl(var(--border) / 0.5)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tl-fg-muted)", cursor: "pointer" }}><Icon name={s} size={15} /></span>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ── PAGE ─────────────────────────────────────────────── */
function Landing() {
  return (
    <div className="tl-app-bg" style={{ minHeight: "100vh", color: "var(--tl-fg)", position: "relative", overflow: "hidden" }}>
      <Orbs />
      <NavPill />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <Showcase />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCTA />
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Landing />);
