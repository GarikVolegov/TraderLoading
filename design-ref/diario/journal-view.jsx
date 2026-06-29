/* ════════════════ DIARIO / JOURNAL ════════════════ */

const JOURNAL_TRADES = [
  { pair: "EUR/USD", dir: "LONG", session: "Londra", r: "+1.8R", tone: "win", date: "Oggi · 09:42", note: "Breakout su livello chiave, gestito bene" },
  { pair: "XAU/USD", dir: "SHORT", session: "New York", r: "−1.0R", tone: "loss", date: "Ieri · 15:10", note: "Entrato in controtrend, stop rispettato" },
  { pair: "GBP/USD", dir: "LONG", session: "Londra", r: "+0.4R", tone: "win", date: "Ieri · 08:55", note: "Parziale a TP1, trailing su resto" },
  { pair: "US30", dir: "LONG", session: "New York", r: "0R", tone: "be", date: "2 giorni fa", note: "Break-even, news ad alto impatto" },
  { pair: "EUR/USD", dir: "SHORT", session: "Asia", r: "+2.1R", tone: "win", date: "3 giorni fa", note: "Setup A+, pieno rispetto del piano" },
];

const EQUITY = [0, 0.4, 1.8, 1.2, 2.0, 3.1, 2.7, 3.6, 4.9, 4.2, 5.4, 6.8, 6.1, 7.4, 8.6];

/* Per-trade R distribution lifted from the journal (the account sync feeds this) */
const R_SAMPLES = [1.8, -1.0, 0.4, 0, 2.1, 1.5, -1.0, 0.9, 2.4, -1.0, 1.2, 0.6, -1.0, 1.8, -0.5, 2.0];
const PROJ_TRADES = 20; // ~one month of trading days

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function EquityCurve() {
  const w = 560, h = 150, pad = 8;
  const sim = React.useMemo(() => {
    const last = EQUITY[EQUITY.length - 1];
    const N = 300, rnd = mulberry32(20260619);
    // stats
    const wins = R_SAMPLES.filter((r) => r > 0), losses = R_SAMPLES.filter((r) => r < 0);
    const winRate = Math.round((wins.length / R_SAMPLES.filter((r) => r !== 0).length) * 100);
    const expR = R_SAMPLES.reduce((a, b) => a + b, 0) / R_SAMPLES.length;
    // run sims
    const ends = []; const paths = [];
    const cols = Array.from({ length: PROJ_TRADES + 1 }, () => []);
    for (let s = 0; s < N; s++) {
      let cum = last; const path = [last]; cols[0].push(last);
      for (let k = 1; k <= PROJ_TRADES; k++) {
        cum += R_SAMPLES[Math.floor(rnd() * R_SAMPLES.length)];
        path.push(cum); cols[k].push(cum);
      }
      ends.push(cum); if (s < 14) paths.push(path);
    }
    const p10 = [], p25 = [], p50 = [], p75 = [], p90 = [];
    cols.forEach((c) => { const sorted = [...c].sort((a, b) => a - b); p10.push(quantile(sorted, 0.1)); p25.push(quantile(sorted, 0.25)); p50.push(quantile(sorted, 0.5)); p75.push(quantile(sorted, 0.75)); p90.push(quantile(sorted, 0.9)); });
    return { last, winRate, expR, paths, p10, p25, p50, p75, p90 };
  }, []);

  const histN = EQUITY.length;
  const span = (histN - 1) + PROJ_TRADES;
  const allV = [...EQUITY, ...sim.p10, ...sim.p90];
  const max = Math.max(...allV), min = Math.min(...allV, 0);
  const xOf = (idx) => pad + (idx / span) * (w - pad * 2);
  const yOf = (v) => h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);

  // historical
  const histPts = EQUITY.map((v, i) => [xOf(i), yOf(v)]);
  const histLine = histPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const histArea = `${histLine} L${histPts[histPts.length - 1][0].toFixed(1)},${h} L${histPts[0][0].toFixed(1)},${h} Z`;

  // projection geometry (k=0 anchored at last historical point)
  const px = (k) => xOf(histN - 1 + k);
  const bandPath = (lo, hi) => {
    const up = hi.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const down = lo.map((v, k) => `L${px(lo.length - 1 - k).toFixed(1)},${yOf(lo[lo.length - 1 - k]).toFixed(1)}`).join(" ");
    return `${up} ${down} Z`;
  };
  const medianLine = sim.p50.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const simPath = (path) => path.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const divX = px(0);
  const B = "hsl(210 90% 62%)";

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* projection: 80% band, 50% band, sample paths, median */}
        <path d={bandPath(sim.p10, sim.p90)} fill={B} fillOpacity="0.1" />
        <path d={bandPath(sim.p25, sim.p75)} fill={B} fillOpacity="0.14" />
        {sim.paths.map((p, i) => (
          <path key={i} d={simPath(p)} fill="none" stroke={B} strokeOpacity="0.12" strokeWidth="1" />
        ))}
        <path d={medianLine} fill="none" stroke={B} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

        {/* today divider */}
        <line x1={divX} y1={pad} x2={divX} y2={h - pad} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 3" />

        {/* historical */}
        <path d={histArea} fill="url(#eqfill)" />
        <path d={histLine} className="tl-draw" pathLength="1" fill="none" stroke="hsl(142 71% 45%)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={histPts[histPts.length - 1][0]} cy={histPts[histPts.length - 1][1]} r="3.5" fill="hsl(142 71% 45%)" />
        <circle cx={px(PROJ_TRADES)} cy={yOf(sim.p50[PROJ_TRADES])} r="3" fill={B} />
      </svg>

      {/* legend + projection readout */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px", marginTop: 12, fontSize: 11.5, color: "var(--tl-fg-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 2, borderRadius: 2, background: "hsl(142 71% 45%)" }} />Realizzato <strong style={{ color: "var(--tl-fg)", fontFamily: "var(--tl-font-mono)" }}>+{sim.last.toFixed(1)}R</strong></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 2, background: "hsl(210 90% 62% / 0.22)", border: "1px solid hsl(210 90% 62% / 0.4)" }} />Intervallo 80%</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 0, borderTop: "2px dashed hsl(210 90% 62%)" }} />Mediana proiettata</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, color: "var(--tl-fg)" }}>
          <Icon name="dice-5" size={13} color="hsl(210 90% 62%)" />
          <span style={{ fontFamily: "var(--tl-font-mono)" }}>+{sim.p50[PROJ_TRADES].toFixed(1)}R</span>
          <span style={{ color: "var(--tl-fg-muted)" }}>(80% tra +{sim.p10[PROJ_TRADES].toFixed(1)} e +{sim.p90[PROJ_TRADES].toFixed(1)}R)</span>
        </span>
      </div>
    </div>
  );
}

const RECAP = [
  { key: "Giudizio generale", icon: "scale", tone: "accent", text: "Mese solido: disciplina in crescita e gestione del rischio costante. L'edge è positivo ma la size resta sotto-ottimale nei setup A+." },
  { key: "Cosa è andato bene", icon: "thumbs-up", tone: "primary", text: "Rispetto del piano nell'82% dei trade. Nessun revenge-trade. Journaling completato ogni giorno di mercato." },
  { key: "Cosa è andato storto", icon: "thumbs-down", tone: "danger", text: "Tre ingressi anticipati in sessione di Londra. Size troppo bassa quando la convinzione era alta." },
  { key: "Pattern individuati", icon: "git-branch", tone: "warning", text: "Performance migliore in New York (+1.6R medio) rispetto ad Asia (+0.3R). I LONG su EUR/USD restano il setup più redditizio." },
];

function JournalView() {
  return (
    <>
      <TopBar title="Diario di Trading" subtitle="Traccia i tuoi trade e rifletti sulle performance"
        badge={<Button leftIcon={<Icon name="plus" size={16} />}>Nuovo Trade</Button>} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatTile label="Totale Trade" value="128" size="lg" />
        <StatTile label="Win Rate" value="64%" tone="win" size="lg" />
        <StatTile label="P&L netto" value="+24.6R" tone="primary" size="lg" />
        <StatTile label="Profit Factor" value="1.9" size="lg" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 16, alignItems: "start", marginBottom: 16 }}>
        {/* Equity curve */}
        <Card>
          <CardHeader icon={<Icon name="line-chart" size={16} />} iconTone="primary" title="Equity Curve" subtitle="Realizzato + proiezione Monte Carlo · 1 mese"
            action={<Badge variant="success" icon={<Icon name="trending-up" size={12} />}>+8.6R</Badge>} />
          <CardContent style={{ paddingTop: 8 }}>
            <EquityCurve />
          </CardContent>
        </Card>
        {/* Edge breakdown */}
        <Card>
          <CardHeader icon={<Icon name="activity" size={16} />} iconTone="accent" title="Edge" subtitle="Scomposizione del vantaggio" />
          <CardContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { l: "Expectancy", v: "+0.42R", pct: 70, tone: "primary" },
              { l: "Avg win / Avg loss", v: "1.9", pct: 63, tone: "primary" },
              { l: "Disciplina (piano rispettato)", v: "82%", pct: 82, tone: "accent" },
              { l: "Revenge-trade", v: "0", pct: 4, tone: "danger" },
            ].map((m) => (
              <div key={m.l}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12.5 }}>
                  <span style={{ color: "var(--tl-fg-muted)" }}>{m.l}</span>
                  <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, color: "var(--tl-fg)" }}>{m.v}</span>
                </div>
                <ProgressBar value={m.pct} tone={m.tone} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4-week recap */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader icon={<Icon name="sparkles" size={16} />} iconTone="primary" title="Recap 4 settimane" subtitle="Sintesi generata sui tuoi trade"
          action={<Badge variant="primary">AI</Badge>} />
        <CardContent style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {RECAP.map((r) => {
            const tones = { accent: "hsl(var(--accent))", primary: "hsl(var(--primary))", danger: "hsl(var(--destructive))", warning: "hsl(var(--warning))" };
            return (
              <div key={r.key} style={{ borderRadius: "var(--tl-radius-lg)", border: "1px solid var(--tl-border-subtle)", background: "hsl(var(--secondary) / 0.35)", padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Icon name={r.icon} size={15} color={tones[r.tone]} />
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: tones[r.tone] }}>{r.key}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--tl-fg-muted)" }}>{r.text}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Trade list */}
      <Card>
        <CardHeader icon={<Icon name="list" size={16} />} iconTone="accent" title="Trade recenti" subtitle="Sincronizzati da FX Blue" />
        <div>
          {JOURNAL_TRADES.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderTop: "1px solid hsl(var(--border) / 0.2)" }}>
              <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 14, color: "var(--tl-fg)", width: 90, flexShrink: 0 }}>{t.pair}</span>
              <Badge variant={t.dir === "LONG" ? "success" : "danger"}>{t.dir}</Badge>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--tl-fg)" }}>{t.note}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "hsl(var(--muted-foreground) / 0.6)" }}>{t.session} · {t.date}</p>
              </div>
              <span className="tl-stat" style={{ fontSize: 16, color: t.tone === "win" ? "var(--tl-win)" : t.tone === "loss" ? "var(--tl-loss)" : "var(--tl-be)" }}>{t.r}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
