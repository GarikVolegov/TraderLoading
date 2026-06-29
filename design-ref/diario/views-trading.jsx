/* TraderLoading UI kit — trading views: Diario (Journal + 4-week Edge recap),
   News feed, Backtest replay. Composed from DS primitives + the shared Icon. */

const { Card, CardHeader, CardContent, StatTile, Badge, Button, ProgressBar } = window.DS;

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

/* ════════════════ NEWS ════════════════ */

const NEWS = [
  { title: "Powell segnala possibili tagli dei tassi nel Q3", summary: "Il presidente Fed apre a un allentamento monetario se l'inflazione continua a rientrare verso il target del 2%.", impact: 9, sentiment: "bearish", pairs: ["USD", "XAU", "US30"], time: "12 min fa", fresh: "Live" },
  { title: "PMI manifatturiero eurozona sopra le attese a 51.2", summary: "Il dato segnala espansione per il secondo mese consecutivo, sostenendo l'euro contro il dollaro.", impact: 6, sentiment: "bullish", pairs: ["EUR"], time: "38 min fa", fresh: "Nuova" },
  { title: "Oro tocca nuovi massimi storici sopra 2.400$", summary: "Il metallo prezioso beneficia di tensioni geopolitiche e attese di tassi più bassi.", impact: 7, sentiment: "bullish", pairs: ["XAU"], time: "1 ora fa", fresh: "Nuova" },
  { title: "Inflazione UK in calo al 3.4%, sterlina sotto pressione", summary: "Il CPI scende più del previsto, aumentando le probabilità di un taglio BoE a breve.", impact: 6, sentiment: "bearish", pairs: ["GBP"], time: "2 ore fa", fresh: "Aggiornata" },
  { title: "Petrolio WTI in rialzo dopo taglio produzione OPEC+", summary: "Il cartello estende i tagli, spingendo i prezzi del greggio verso 85$ al barile.", impact: 5, sentiment: "bullish", pairs: ["OIL", "CAD"], time: "3 ore fa", fresh: "Aggiornata" },
  { title: "Mercati asiatici contrastati in attesa dei dati USA", summary: "Nikkei in lieve rialzo, Hang Seng in calo mentre i trader attendono i payroll.", impact: 3, sentiment: "neutral", pairs: ["JPY"], time: "5 ore fa", fresh: "Storico" },
];

function ImpactBadge({ score }) {
  const c = score >= 8 ? { fg: "hsl(0 84% 60%)", l: "ALTO" } : score >= 5 ? { fg: "hsl(38 92% 50%)", l: "MEDIO" } : { fg: "hsl(142 71% 45%)", l: "BASSO" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: "var(--tl-radius-sm)", fontSize: 10, fontWeight: 700, color: c.fg, background: `color-mix(in srgb, ${c.fg} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${c.fg} 35%, transparent)` }}>
      <Icon name="zap" size={10} />{score}/10 {c.l}
    </span>
  );
}
function SentimentTag({ s }) {
  const map = { bullish: { fg: "hsl(142 71% 45%)", ic: "trending-up", l: "Rialzista" }, bearish: { fg: "hsl(0 84% 60%)", ic: "trending-down", l: "Ribassista" }, neutral: { fg: "var(--tl-fg-muted)", ic: "minus", l: "Neutrale" } };
  const c = map[s];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: "var(--tl-radius-sm)", fontSize: 11, fontWeight: 600, color: c.fg, background: `color-mix(in srgb, ${c.fg} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${c.fg} 25%, transparent)` }}>
      <Icon name={c.ic} size={11} />{c.l}
    </span>
  );
}

const NEWS_IMP = [{ id: "all", l: "Tutti" }, { id: "high", l: "Alto" }, { id: "med", l: "Medio" }, { id: "low", l: "Basso" }];
const NEWS_SENT = [{ id: "all", l: "Tutti" }, { id: "bullish", l: "Rialzista" }, { id: "bearish", l: "Ribassista" }, { id: "neutral", l: "Neutrale" }];
function impBand(score) { return score >= 8 ? "high" : score >= 5 ? "med" : "low"; }

function NewsView() {
  const [imp, setImp] = React.useState("all");
  const [sent, setSent] = React.useState("all");
  const [curs, setCurs] = React.useState([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const [updated, setUpdated] = React.useState(2);
  const [votes, setVotes] = React.useState(() => NEWS.map((n, i) => ({ up: 6 + ((i * 7) % 14), down: 1 + ((i * 3) % 4), my: null })));

  const allCurs = [...new Set(NEWS.flatMap((n) => n.pairs))];
  const toggleCur = (c) => setCurs((xs) => xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]);
  const refresh = () => { if (refreshing) return; setRefreshing(true); setTimeout(() => { setRefreshing(false); setUpdated(0); }, 800); };
  const vote = (i, dir) => setVotes((vs) => vs.map((v, j) => {
    if (j !== i) return v;
    let { up, down, my } = v;
    if (my === "up") up--; if (my === "down") down--;
    my = my === dir ? null : dir;
    if (my === "up") up++; if (my === "down") down++;
    return { up, down, my };
  }));
  const list = NEWS.map((n, i) => ({ ...n, i })).filter((n) =>
    (imp === "all" || impBand(n.impact) === imp) &&
    (sent === "all" || n.sentiment === sent) &&
    (curs.length === 0 || n.pairs.some((p) => curs.includes(p))));

  const seg = (opts, val, set) => (
    <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 99, background: "hsl(var(--secondary) / 0.5)", border: "1px solid var(--tl-border-subtle)" }}>
      {opts.map((o) => {
        const on = val === o.id;
        return <button key={o.id} onClick={() => set(o.id)} style={{ border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 99, fontFamily: "var(--tl-font-sans)", background: on ? "hsl(var(--primary))" : "transparent", color: on ? "hsl(var(--primary-foreground))" : "var(--tl-fg-muted)", transition: "all .15s" }}>{o.l}</button>;
      })}
    </div>
  );
  const voteBtn = (active, color) => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 4px", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--tl-font-mono)", fontSize: 11, fontWeight: 700, color: active ? color : "hsl(var(--muted-foreground) / 0.55)", transition: "color .15s" });

  return (
    <>
      <TopBar title="News & Macro" subtitle="Notizie in tempo reale con analisi d'impatto AI"
        badge={<Button variant="outline" size="sm" leftIcon={<Icon name="refresh-cw" size={14} style={refreshing ? { animation: "tl-spin 0.8s linear infinite" } : undefined} />} onClick={refresh}>{refreshing ? "Aggiorno…" : "Aggiorna"}</Button>} />

      {/* Agent summary */}
      <div style={{ display: "flex", gap: 12, borderRadius: "var(--tl-radius)", border: "1px solid hsl(var(--primary) / 0.2)", background: "hsl(var(--primary) / 0.05)", padding: 16, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "var(--tl-radius-lg)", background: "hsl(var(--primary) / 0.15)", border: "1px solid hsl(var(--primary) / 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "hsl(var(--primary))" }}>
          <Icon name="newspaper" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "hsl(var(--primary) / 0.8)" }}>Sintesi di mercato</span>
            {["EUR/USD", "XAU/USD"].map((p) => <span key={p} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontFamily: "var(--tl-font-mono)", fontWeight: 700, background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.25)" }}>{p}</span>)}
          </div>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: "hsl(var(--muted-foreground) / 0.9)" }}>
            Il tono macro è risk-off sul dollaro dopo le aperture di Powell a tagli anticipati. Oro ed euro ne beneficiano; attesa volatilità elevata sui payroll USA di venerdì. Occhio ai LONG su XAU e alla gestione del rischio sui pair USD.
          </p>
        </div>
      </div>

      {/* Meta bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--tl-fg-muted)" }}><Icon name="clock" size={12} />Aggiornato {updated === 0 ? "ora" : `${updated} min fa`}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: "var(--tl-radius-sm)", fontSize: 11, fontWeight: 600, color: "hsl(142 71% 45%)", background: "hsl(142 71% 45% / 0.1)", border: "1px solid hsl(142 71% 45% / 0.3)" }}><span style={{ width: 5, height: 5, borderRadius: 99, background: "hsl(142 71% 45%)", boxShadow: "0 0 8px hsl(142 71% 45%)", animation: "tl-pulse 1.6s ease-in-out infinite" }} />Live</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "hsl(var(--muted-foreground) / 0.7)", fontFamily: "var(--tl-font-mono)" }}>{list.length} di {NEWS.length} notizie</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {seg(NEWS_IMP, imp, setImp)}
        {seg(NEWS_SENT, sent, setSent)}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {allCurs.map((c) => {
            const on = curs.includes(c);
            return <button key={c} onClick={() => toggleCur(c)} style={{ fontFamily: "var(--tl-font-mono)", fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: "var(--tl-radius-sm)", cursor: "pointer", border: on ? "1px solid hsl(var(--primary) / 0.45)" : "1px solid var(--tl-border-subtle)", background: on ? "hsl(var(--primary) / 0.12)" : "hsl(var(--secondary) / 0.4)", color: on ? "hsl(var(--primary))" : "var(--tl-fg-muted)" }}>{c}</button>;
          })}
        </div>
      </div>

      {/* News grid */}
      {list.length === 0 ? (
        <Card style={{ padding: 40, textAlign: "center", borderStyle: "dashed" }}>
          <Icon name="search-x" size={34} color="hsl(var(--muted-foreground) / 0.3)" />
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--tl-fg-muted)" }}>Nessuna notizia con i filtri selezionati.</p>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }} className="tl-stagger">
          {list.map((n) => {
            const v = votes[n.i];
            return (
              <Card key={n.i} hover style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ height: 3, background: n.impact >= 8 ? "hsl(0 84% 60% / 0.6)" : n.impact >= 5 ? "hsl(38 92% 50% / 0.6)" : "hsl(142 71% 45% / 0.6)" }} />
                <CardContent style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <ImpactBadge score={n.impact} />
                    <SentimentTag s={n.sentiment} />
                  </div>
                  <h3 style={{ margin: 0, fontFamily: "var(--tl-font-sans)", fontWeight: 700, fontSize: 14, lineHeight: 1.35, color: "var(--tl-fg)" }}>{n.title}</h3>
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--tl-fg-muted)", flex: 1 }}>{n.summary}</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {n.pairs.map((p) => <span key={p} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, fontFamily: "var(--tl-font-mono)", fontWeight: 700, background: "hsl(var(--primary) / 0.1)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.25)" }}>{p}</span>)}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid hsl(var(--border) / 0.2)", fontSize: 11, color: "hsl(var(--muted-foreground) / 0.6)" }}>
                    <span>{n.time}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => vote(n.i, "up")} style={voteBtn(v.my === "up", "hsl(142 71% 45%)")} aria-pressed={v.my === "up"}><Icon name="thumbs-up" size={13} />{v.up}</button>
                      <button onClick={() => vote(n.i, "down")} style={voteBtn(v.my === "down", "hsl(0 84% 60%)")} aria-pressed={v.my === "down"}><Icon name="thumbs-down" size={13} />{v.down}</button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ════════════════ BACKTEST ════════════════ */

const CANDLES = [
  { o: 40, c: 62, h: 70, l: 34, up: true }, { o: 62, c: 54, h: 66, l: 48, up: false },
  { o: 54, c: 78, h: 84, l: 50, up: true }, { o: 78, c: 72, h: 82, l: 66, up: false },
  { o: 72, c: 90, h: 96, l: 70, up: true }, { o: 90, c: 84, h: 94, l: 80, up: false },
  { o: 84, c: 100, h: 110, l: 82, up: true }, { o: 100, c: 116, h: 122, l: 96, up: true },
  { o: 116, c: 108, h: 120, l: 102, up: false }, { o: 108, c: 130, h: 138, l: 104, up: true },
  { o: 130, c: 122, h: 134, l: 116, up: false }, { o: 122, c: 144, h: 150, l: 118, up: true },
  { o: 144, c: 138, h: 150, l: 132, up: false }, { o: 138, c: 158, h: 166, l: 134, up: true },
  { o: 158, c: 150, h: 162, l: 144, up: false }, { o: 150, c: 172, h: 180, l: 146, up: true },
];

function BacktestView() {
  const [tf, setTf] = React.useState("M15");
  const [pos, setPos] = React.useState(null);
  const chartH = 230;
  return (
    <>
      <TopBar title="Backtest" subtitle="Replay sui grafici reali, candela per candela"
        badge={<Badge variant="primary" icon={<Icon name="crown" size={12} />}>Pro</Badge>} />

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 18, color: "var(--tl-fg)" }}>XAU/USD</span>
          <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: "var(--tl-radius-md)", background: "hsl(var(--secondary) / 0.5)", border: "1px solid var(--tl-border-subtle)" }}>
            {["M5", "M15", "H1", "H4", "D1"].map((t) => (
              <button key={t} onClick={() => setTf(t)} style={{ padding: "5px 11px", borderRadius: "var(--tl-radius-sm)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "var(--tl-font-mono)", background: tf === t ? "hsl(var(--primary))" : "transparent", color: tf === t ? "hsl(var(--primary-foreground))" : "var(--tl-fg-muted)" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" leftIcon={<Icon name="rewind" size={14} />}>Indietro</Button>
          <Button size="sm" leftIcon={<Icon name="play" size={14} />}>Candela +1</Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
        {/* Chart */}
        <Card>
          <CardContent>
            <svg viewBox={`0 0 ${CANDLES.length * 26} ${chartH}`} width="100%" height={chartH} preserveAspectRatio="none" style={{ display: "block" }}>
              {[0.25, 0.5, 0.75].map((g) => (
                <line key={g} x1="0" y1={chartH * g} x2={CANDLES.length * 26} y2={chartH * g} stroke="hsl(215 25% 27% / 0.25)" strokeWidth="1" strokeDasharray="2 4" />
              ))}
              {CANDLES.map((c, i) => {
                const x = i * 26 + 13;
                const col = c.up ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)";
                const top = chartH - c.h, bot = chartH - c.l;
                const bTop = chartH - Math.max(c.o, c.c), bBot = chartH - Math.min(c.o, c.c);
                return (
                  <g key={i}>
                    <line x1={x} y1={top} x2={x} y2={bot} stroke={col} strokeWidth="1.5" />
                    <rect x={x - 7} y={bTop} width="14" height={Math.max(2, bBot - bTop)} fill={col} rx="1.5" />
                  </g>
                );
              })}
              {pos && <line x1="0" y1={chartH - 172} x2={CANDLES.length * 26} y2={chartH - 172} stroke="hsl(217 91% 60%)" strokeWidth="1.5" strokeDasharray="4 3" />}
            </svg>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setPos("long")} style={{ flex: 1, padding: "12px", borderRadius: "var(--tl-radius-md)", border: "1px solid hsl(142 71% 45% / 0.4)", background: pos === "long" ? "hsl(142 71% 45% / 0.2)" : "hsl(142 71% 45% / 0.08)", color: "hsl(142 71% 45%)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "var(--tl-font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="arrow-up" size={16} />BUY
              </button>
              <button onClick={() => setPos("short")} style={{ flex: 1, padding: "12px", borderRadius: "var(--tl-radius-md)", border: "1px solid hsl(0 84% 60% / 0.4)", background: pos === "short" ? "hsl(0 84% 60% / 0.2)" : "hsl(0 84% 60% / 0.08)", color: "hsl(0 84% 60%)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "var(--tl-font-sans)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Icon name="arrow-down" size={16} />SELL
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Session stats */}
        <Card>
          <CardHeader icon={<Icon name="bar-chart-3" size={16} />} iconTone="accent" title="Statistiche sessione" subtitle="Replay corrente" />
          <CardContent style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, paddingBottom: 8, borderBottom: "1px solid hsl(var(--border) / 0.2)" }}>
              <Gauge value={62} width={150} />
              <span style={{ fontSize: 11, color: "var(--tl-fg-muted)" }}>Win rate sessione</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <StatTile label="Trade" value="8" />
              <StatTile label="Win Rate" value="62%" tone="win" />
              <StatTile label="P&L" value="+3.4R" tone="primary" />
              <StatTile label="Max DD" value="−1.2R" tone="loss" />
            </div>
            <div style={{ padding: 12, borderRadius: "var(--tl-radius-md)", background: "hsl(var(--secondary) / 0.4)", border: "1px solid var(--tl-border-subtle)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--tl-fg-muted)" }}>Posizione corrente</p>
              {pos ? (
                <p style={{ margin: "4px 0 0", fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 15, color: pos === "long" ? "hsl(142 71% 45%)" : "hsl(0 84% 60%)" }}>{pos === "long" ? "LONG" : "SHORT"} · 0.25 lot</p>
              ) : (
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "hsl(var(--muted-foreground) / 0.5)" }}>Nessuna posizione aperta</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ════════════════ CALENDARIO ECONOMICO ════════════════ */

const CAL_DAYS = [
  { id: "ieri", label: "Ieri", date: "26 giu" },
  { id: "oggi", label: "Oggi", date: "27 giu", today: true },
  { id: "domani", label: "Domani", date: "28 giu" },
];
const CAL_EVENTS = {
  ieri: [
    { time: "14:30", cur: "USD", imp: 3, title: "PIL t/t (finale)", actual: "1.4%", forecast: "1.3%", previous: "1.3%" },
    { time: "14:30", cur: "USD", imp: 2, title: "Richieste sussidi disoccupazione", actual: "233K", forecast: "236K", previous: "239K" },
    { time: "14:30", cur: "USD", imp: 2, title: "Ordini beni durevoli m/m", actual: "0.1%", forecast: "0.3%", previous: "-0.2%" },
    { time: "16:00", cur: "USD", imp: 2, title: "Vendite case in corso m/m", actual: "-2.1%", forecast: "1.0%", previous: "-7.7%" },
  ],
  oggi: [
    { time: "08:00", cur: "EUR", imp: 2, title: "IFO Clima affari (Germania)", actual: "88.6", forecast: "88.2", previous: "87.5" },
    { time: "10:00", cur: "EUR", imp: 1, title: "M3 Offerta di moneta a/a", actual: "2.1%", forecast: "2.0%", previous: "1.9%" },
    { time: "14:30", cur: "USD", imp: 3, title: "Core PCE Price Index m/m", actual: "—", forecast: "0.2%", previous: "0.3%", next: true },
    { time: "14:30", cur: "USD", imp: 2, title: "Reddito personale m/m", actual: "—", forecast: "0.3%", previous: "0.3%" },
    { time: "16:00", cur: "USD", imp: 2, title: "Fiducia consumatori UoM", actual: "—", forecast: "74.5", previous: "74.0" },
    { time: "19:00", cur: "USD", imp: 1, title: "Conteggio piattaforme Baker Hughes", actual: "—", forecast: "—", previous: "488" },
  ],
  domani: [
    { time: "01:30", cur: "JPY", imp: 2, title: "CPI Tokyo a/a", actual: "—", forecast: "2.3%", previous: "2.2%" },
    { time: "08:45", cur: "EUR", imp: 1, title: "Fiducia consumatori (Francia)", actual: "—", forecast: "90", previous: "90" },
    { time: "14:30", cur: "CAD", imp: 3, title: "PIL m/m", actual: "—", forecast: "0.3%", previous: "0.0%" },
    { time: "14:30", cur: "USD", imp: 2, title: "Bilancia commerciale beni", actual: "—", forecast: "-95.0B", previous: "-99.4B" },
  ],
};
const IMP_FILTERS = [
  { id: 0, label: "Tutti" },
  { id: 3, label: "Alto" },
  { id: 2, label: "Medio" },
  { id: 1, label: "Basso" },
];
function impMeta(n) {
  return n >= 3 ? { c: "hsl(0 84% 60%)", l: "Alto" } : n >= 2 ? { c: "hsl(38 92% 50%)", l: "Medio" } : { c: "hsl(142 71% 45%)", l: "Basso" };
}
function ImpDots({ n }) {
  const c = impMeta(n).c;
  return <span style={{ display: "inline-flex", gap: 3 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: i < n ? c : "hsl(var(--border))" }} />)}</span>;
}
function toNum(s) {
  if (!s || s === "—") return null;
  const m = String(s).replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
function ActualCell({ actual, forecast }) {
  if (actual === "—") return <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 13, color: "hsl(var(--muted-foreground) / 0.4)" }}>—</span>;
  const a = toNum(actual), f = toNum(forecast);
  const dir = a != null && f != null && a !== f ? (a > f ? 1 : -1) : 0;
  const col = dir === 1 ? "hsl(142 71% 45%)" : dir === -1 ? "hsl(0 84% 60%)" : "var(--tl-fg)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 3, fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 13, color: col }}>
      {dir !== 0 && <Icon name={dir === 1 ? "arrow-up" : "arrow-down"} size={11} />}{actual}
    </span>
  );
}

function CalendarView() {
  const [day, setDay] = React.useState("oggi");
  const [imp, setImp] = React.useState(0);
  const [curs, setCurs] = React.useState([]);
  const all = CAL_EVENTS[day];
  const allCurs = [...new Set(Object.values(CAL_EVENTS).flat().map((e) => e.cur))];
  const toggleCur = (c) => setCurs((xs) => xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]);
  const events = all.filter((e) => (imp === 0 || e.imp === imp) && (curs.length === 0 || curs.includes(e.cur)));
  const highCount = all.filter((e) => e.imp === 3).length;
  const nextEvent = CAL_EVENTS.oggi.find((e) => e.next);

  const colHead = { fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "hsl(var(--muted-foreground) / 0.55)" };
  const valCol = { width: 72, textAlign: "right", flexShrink: 0 };

  return (
    <>
      <TopBar title="Calendario Economico" subtitle="Eventi macro con impatto, previsioni e dati effettivi"
        badge={<Button variant="outline" size="sm" leftIcon={<Icon name="refresh-cw" size={14} />}>Aggiorna</Button>} />

      {/* summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <StatTile label="Eventi oggi" value={String(CAL_EVENTS.oggi.length)} size="lg" />
        <StatTile label="Alto impatto" value={String(CAL_EVENTS.oggi.filter((e) => e.imp === 3).length)} tone="loss" size="lg" />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 4, padding: "12px 16px", borderRadius: "var(--tl-radius-lg)", border: "1px solid hsl(var(--primary) / 0.25)", background: "hsl(var(--primary) / 0.06)" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em", color: "hsl(var(--primary) / 0.8)" }}>Prossimo evento</span>
          {nextEvent ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 15, color: "var(--tl-fg)", flexShrink: 0 }}>{nextEvent.time}</span>
              <span style={{ fontSize: 12.5, color: "var(--tl-fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextEvent.cur} · {nextEvent.title}</span>
            </span>
          ) : <span style={{ fontSize: 13, color: "var(--tl-fg-muted)" }}>—</span>}
        </div>
      </div>

      {/* day selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {CAL_DAYS.map((d) => {
          const on = day === d.id;
          return (
            <button key={d.id} onClick={() => setDay(d.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "10px", borderRadius: "var(--tl-radius-md)", cursor: "pointer", border: on ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid var(--tl-border-subtle)", background: on ? "hsl(var(--primary) / 0.1)" : "hsl(var(--card) / 0.4)" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: on ? "hsl(var(--primary))" : "var(--tl-fg)" }}>{d.label}</span>
              <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "var(--tl-fg-muted)" }}>{d.date}</span>
            </button>
          );
        })}
      </div>

      {/* filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 99, background: "hsl(var(--secondary) / 0.5)", border: "1px solid var(--tl-border-subtle)" }}>
          {IMP_FILTERS.map((f) => {
            const on = imp === f.id;
            return <button key={f.id} onClick={() => setImp(f.id)} style={{ border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 99, fontFamily: "var(--tl-font-sans)", background: on ? "hsl(var(--primary))" : "transparent", color: on ? "hsl(var(--primary-foreground))" : "var(--tl-fg-muted)", transition: "all .15s" }}>{f.label}</button>;
          })}
        </div>
        <span style={{ width: 1, height: 22, background: "var(--tl-border-subtle)" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {allCurs.map((c) => {
            const on = curs.includes(c);
            return <button key={c} onClick={() => toggleCur(c)} style={{ fontFamily: "var(--tl-font-mono)", fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: "var(--tl-radius-sm)", cursor: "pointer", border: on ? "1px solid hsl(var(--primary) / 0.45)" : "1px solid var(--tl-border-subtle)", background: on ? "hsl(var(--primary) / 0.12)" : "hsl(var(--secondary) / 0.4)", color: on ? "hsl(var(--primary))" : "var(--tl-fg-muted)" }}>{c}</button>;
          })}
        </div>
      </div>

      {/* table */}
      <Card style={{ overflow: "hidden" }}>
        {/* column header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--tl-border-subtle)", background: "hsl(var(--secondary) / 0.25)" }}>
          <span style={{ ...colHead, width: 46, flexShrink: 0 }}>Ora</span>
          <span style={{ ...colHead, width: 42, flexShrink: 0 }}>Val.</span>
          <span style={{ ...colHead, width: 30, flexShrink: 0 }}>Imp.</span>
          <span style={{ ...colHead, flex: 1, minWidth: 0 }}>Evento</span>
          <span style={{ ...colHead, ...valCol }}>Effettivo</span>
          <span style={{ ...colHead, ...valCol }}>Previsto</span>
          <span style={{ ...colHead, ...valCol }}>Precedente</span>
        </div>
        {events.length === 0 ? (
          <div style={{ padding: 36, textAlign: "center", color: "var(--tl-fg-muted)", fontSize: 13 }}>Nessun evento con i filtri selezionati.</div>
        ) : events.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: i ? "1px solid hsl(var(--border) / 0.2)" : "none", background: e.next ? "hsl(var(--primary) / 0.05)" : "transparent", position: "relative" }}>
            {e.next && <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "hsl(var(--primary))", boxShadow: "0 0 10px hsl(var(--primary) / 0.7)" }} />}
            <span style={{ width: 46, flexShrink: 0, fontFamily: "var(--tl-font-mono)", fontSize: 12.5, fontWeight: 700, color: e.next ? "hsl(var(--primary))" : "var(--tl-fg)" }}>{e.time}</span>
            <span style={{ width: 42, flexShrink: 0 }}><span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 10, fontWeight: 700, color: "hsl(var(--primary))", padding: "2px 6px", borderRadius: 5, background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>{e.cur}</span></span>
            <span style={{ width: 30, flexShrink: 0 }} title={impMeta(e.imp).l}><ImpDots n={e.imp} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--tl-fg)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</span>
              {e.next && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "hsl(var(--primary))", padding: "2px 7px", borderRadius: 99, background: "hsl(var(--primary) / 0.12)", border: "1px solid hsl(var(--primary) / 0.25)" }}>Prossimo</span>}
            </span>
            <span style={valCol}><ActualCell actual={e.actual} forecast={e.forecast} /></span>
            <span style={{ ...valCol, fontFamily: "var(--tl-font-mono)", fontSize: 13, color: "var(--tl-fg-muted)" }}>{e.forecast}</span>
            <span style={{ ...valCol, fontFamily: "var(--tl-font-mono)", fontSize: 13, color: "hsl(var(--muted-foreground) / 0.6)" }}>{e.previous}</span>
          </div>
        ))}
      </Card>

      <p style={{ display: "flex", alignItems: "center", gap: 7, margin: "14px 2px 16px", fontSize: 11.5, color: "hsl(var(--muted-foreground) / 0.7)" }}>
        <Icon name="info" size={13} color="hsl(var(--primary) / 0.7)" />
        Orari in fuso Europe/Rome (CET). Il colore del dato effettivo indica solo se è sopra o sotto la previsione, non l'effetto sul mercato.
      </p>
    </>
  );
}

/* ════════════════ STRUMENTI DI RISCHIO ════════════════ */

const PAIR_PIP = { "EUR/USD": 10, "GBP/USD": 10, "USD/JPY": 9.1, "XAU/USD": 10, "GBP/JPY": 8.4, "US30": 1, "NAS100": 1, "BTC/USD": 1 };
function eur(n) { return n == null ? "—" : n.toLocaleString("it-IT", { maximumFractionDigits: n < 100 ? 2 : 0 }); }

function RiskToolsView() {
  const [balance, setBalance] = React.useState("10000");
  const [riskPct, setRiskPct] = React.useState("1");
  const [slPips, setSlPips] = React.useState("20");
  const [rr, setRr] = React.useState("2");
  const [pair, setPair] = React.useState("EUR/USD");

  const b = parseFloat(balance), rp = parseFloat(riskPct), sl = parseFloat(slPips), r = parseFloat(rr);
  const pip = PAIR_PIP[pair] || 10;
  const riskAmt = !isNaN(b) && !isNaN(rp) ? b * rp / 100 : null;
  const lots = riskAmt != null && !isNaN(sl) && sl > 0 ? riskAmt / (sl * pip) : null;
  const pipVal = lots != null ? lots * pip : null;
  const profit = riskAmt != null && !isNaN(r) ? riskAmt * r : null;
  const tpPips = !isNaN(sl) && !isNaN(r) ? sl * r : null;

  const inp = { width: "100%", height: 42, borderRadius: "var(--tl-radius-md)", border: "1px solid var(--tl-border)", background: "hsl(var(--secondary) / 0.4)", padding: "0 13px", fontSize: 15, color: "var(--tl-fg)", fontFamily: "var(--tl-font-mono)", fontWeight: 700, outline: "none", boxSizing: "border-box" };
  const lbl = { display: "block", marginBottom: 7, fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--tl-fg-muted)" };
  const resRow = (label, value, color, big) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "10px 0", borderTop: "1px solid hsl(var(--border) / 0.2)" }}>
      <span style={{ fontSize: 13, color: "var(--tl-fg-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: big ? 17 : 14, color: color || "var(--tl-fg)" }}>{value}</span>
    </div>
  );

  return (
    <>
      <TopBar title="Strumenti di Rischio" subtitle="Dimensiona la posizione e leggi il posizionamento di mercato" />

      {/* Position-size calculator */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
        <Card>
          <CardHeader icon={<Icon name="calculator" size={16} />} iconTone="primary" title="Calcolatore di posizione" subtitle="Dimensionamento basato sul rischio" />
          <CardContent style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>Coppia</label>
              <select value={pair} onChange={(e) => setPair(e.target.value)} style={{ ...inp, fontFamily: "var(--tl-font-mono)" }}>
                {Object.keys(PAIR_PIP).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label style={lbl}>Saldo conto (€)</label><input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Rischio (%)</label><input type="number" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Stop loss (pips)</label><input type="number" value={slPips} onChange={(e) => setSlPips(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Rapporto R:R</label><input type="number" value={rr} onChange={(e) => setRr(e.target.value)} style={inp} /></div>
            </div>
          </CardContent>
        </Card>

        <Card glow style={{ display: "flex", flexDirection: "column" }}>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ textAlign: "center", padding: "8px 0 14px" }}>
              <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--tl-fg-muted)" }}>Dimensione consigliata</p>
              <p style={{ margin: "6px 0 0", fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 44, lineHeight: 1, color: "hsl(var(--primary))" }}>{lots != null ? lots.toFixed(2) : "—"}</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--tl-fg-muted)" }}>lotti · {pair}</p>
            </div>
            <div>
              {resRow("Importo a rischio", riskAmt != null ? `${eur(riskAmt)} €` : "—", "hsl(0 84% 60%)", true)}
              {resRow("Valore per pip", pipVal != null ? `${eur(pipVal)} €` : "—")}
              {resRow("Take profit", tpPips != null ? `${tpPips.toFixed(0)} pips` : "—")}
              {resRow("Profitto potenziale", profit != null ? `+${eur(profit)} €` : "—", "hsl(142 71% 45%)", true)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market positioning tools */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 12px" }}>
        <Icon name="layers" size={15} color="var(--tl-fg-muted)" />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--tl-fg-muted)" }}>Posizionamento di mercato</span>
        <span style={{ flex: 1, height: 1, background: "var(--tl-border-subtle)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, alignItems: "start" }} className="tl-stagger">
        <SentimentWidget />
        <VolatilityWidget />
        <CotWidget />
      </div>

      <p style={{ display: "flex", alignItems: "center", gap: 7, margin: "16px 2px", fontSize: 11.5, color: "hsl(var(--muted-foreground) / 0.7)" }}>
        <Icon name="info" size={13} color="hsl(var(--primary) / 0.7)" />
        Stime indicative basate su un valore pip standard per la coppia selezionata. Verifica sempre con le specifiche del tuo broker.
      </p>
    </>
  );
}

Object.assign(window, { JournalView, NewsView, BacktestView, CalendarView, RiskToolsView });
