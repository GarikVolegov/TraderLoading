/* TraderLoading — Landing page building blocks: Icon, scroll Reveal, CountUp,
   animated background orbs, the glass nav pill, and the floating Command-Center
   product mock used in the hero. Exposed on window for landing.jsx. */

function Icon({ name, size = 18, color, strokeWidth = 1.9, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const host = ref.current;
    if (host && window.lucide) {
      host.innerHTML = "";
      const i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      host.appendChild(i);
      window.lucide.createIcons({ attrs: { width: size, height: size, "stroke-width": strokeWidth }, nameAttr: "data-lucide" });
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} style={{ display: "inline-flex", alignItems: "center", color, ...style }} />;
}

/* Reveal-on-scroll wrapper. Anything already in the viewport at mount shows
   immediately (no flash, capture-safe); the rest animates in on scroll. */
function Reveal({ children, delay = 0, y = 28, style, as = "div" }) {
  const ref = React.useRef(null);
  const [seen, setSeen] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < (window.innerHeight || 800) * 0.95) { setSeen(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { setSeen(true); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const Tag = as;
  return (
    <Tag ref={ref} style={{
      opacity: seen ? 1 : 0,
      transform: seen ? "none" : `translateY(${y}px)`,
      transition: `opacity .7s var(--tl-ease-out) ${delay}s, transform .7s var(--tl-ease-out) ${delay}s`,
      ...style,
    }}>
      {children}
    </Tag>
  );
}

/* Counts up to `value` when scrolled into view. */
function CountUp({ value, decimals = 0, prefix = "", suffix = "", duration = 1500, style }) {
  const ref = React.useRef(null);
  const [n, setN] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(value * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);
  return <span ref={ref} style={style}>{prefix}{n.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}

/* Slow-floating blurred colour orbs for hero depth. */
function Orbs() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <div style={{ position: "absolute", top: "-12%", right: "-6%", width: 620, height: 620, borderRadius: "50%", background: "hsl(142 71% 45% / 0.16)", filter: "blur(130px)", animation: "tl-float-a 16s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: "26%", left: "-10%", width: 520, height: 520, borderRadius: "50%", background: "hsl(217 91% 60% / 0.14)", filter: "blur(120px)", animation: "tl-float-b 20s ease-in-out infinite" }} />
      <div style={{ position: "absolute", bottom: "-18%", left: "40%", width: 560, height: 560, borderRadius: "50%", background: "hsl(262 83% 65% / 0.10)", filter: "blur(140px)", animation: "tl-float-a 24s ease-in-out infinite reverse" }} />
    </div>
  );
}

const LANGS = [["it", "🇮🇹 IT"], ["en", "🇬🇧 EN"], ["es", "🇪🇸 ES"], ["fr", "🇫🇷 FR"], ["de", "🇩🇪 DE"]];

function NavPill() {
  const [solid, setSolid] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50, padding: "18px 20px 0" }}>
      <div style={{ margin: "0 auto", maxWidth: 1180, borderRadius: 999, background: "linear-gradient(90deg, hsl(var(--primary)/0.22), rgba(255,255,255,0.12), hsl(217 91% 60% / 0.16))", padding: 1, boxShadow: solid ? "0 0 40px rgba(34,197,94,0.18), 0 24px 70px rgba(0,0,0,0.6)" : "0 0 30px rgba(34,197,94,0.12)", transition: "box-shadow .3s" }}>
        <div style={{ display: "flex", minHeight: 62, alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 999, border: "1px solid rgba(255,255,255,0.16)", background: solid ? "hsl(var(--background) / 0.82)" : "hsl(var(--background) / 0.5)", padding: "8px 18px", backdropFilter: "blur(30px)", transition: "background .3s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <Icon name="rocket" size={26} strokeWidth={1.7} color="hsl(var(--primary))" style={{ filter: "drop-shadow(0 0 10px hsl(var(--primary)/0.5))" }} />
            <span style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.02em", color: "var(--tl-fg)" }}>TraderLoading</span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[["Funzioni", "#features"], ["Come funziona", "#how"], ["Prezzi", "#pricing"], ["FAQ", "#faq"]].map(([l, h]) => (
              <a key={h} href={h} style={{ borderRadius: 999, padding: "8px 13px", fontSize: 14, fontWeight: 500, color: "var(--tl-fg-muted)", textDecoration: "none" }}>{l}</a>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="#" style={{ borderRadius: 999, padding: "8px 12px", fontSize: 14, fontWeight: 500, color: "var(--tl-fg-muted)", textDecoration: "none" }}>Accedi</a>
            <button style={{ whiteSpace: "nowrap", borderRadius: 999, background: "hsl(var(--primary))", padding: "10px 20px", fontSize: 14, fontWeight: 700, color: "hsl(var(--primary-foreground))", border: "none", cursor: "pointer", boxShadow: "0 0 22px rgba(34,197,94,0.26)" }}>Inizia gratis</button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ── Floating Command-Center product mock (the hero "wow") ────────── */

const MOCK_EQ = [0, 6, 3, 9, 7, 13, 11, 18, 15, 22, 26, 23, 30, 34];
function MockSpark() {
  const w = 230, h = 56, p = 4;
  const max = Math.max(...MOCK_EQ), min = Math.min(...MOCK_EQ);
  const pts = MOCK_EQ.map((v, i) => [p + (i / (MOCK_EQ.length - 1)) * (w - p * 2), h - p - ((v - min) / (max - min || 1)) * (h - p * 2)]);
  const line = pts.map((pt, i) => `${i ? "L" : "M"}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <defs><linearGradient id="ms" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity="0.35" /><stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#ms)" />
      <path d={line} className="tl-draw" pathLength="1" fill="none" stroke="hsl(142 71% 45%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProductMock() {
  const tile = { borderRadius: 12, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--secondary) / 0.5)", padding: "10px 12px" };
  const stat = (label, val, color) => (
    <div style={{ ...tile, textAlign: "center" }}>
      <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: ".08em", color: "hsl(var(--muted-foreground) / 0.8)" }}>{label}</div>
      <div style={{ fontFamily: "var(--tl-font-mono)", fontWeight: 700, fontSize: 18, color, fontVariantNumeric: "tabular-nums" }}>{val}</div>
    </div>
  );
  return (
    <div style={{ animation: "tl-floaty 7s ease-in-out infinite", perspective: 1200 }}>
      <div style={{ borderRadius: 18, border: "1px solid hsl(var(--border) / 0.6)", background: "hsl(var(--card) / 0.86)", boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px hsl(var(--primary) / 0.06), 0 0 60px hsl(var(--primary) / 0.05)", backdropFilter: "blur(14px)", overflow: "hidden" }}>
        {/* window bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderBottom: "1px solid hsl(var(--border) / 0.4)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: "hsl(0 84% 60%)" }} />
          <span style={{ width: 9, height: 9, borderRadius: 99, background: "hsl(38 92% 50%)" }} />
          <span style={{ width: 9, height: 9, borderRadius: 99, background: "hsl(142 71% 45%)" }} />
          <span style={{ marginLeft: 8, fontFamily: "var(--tl-font-mono)", fontSize: 11, color: "hsl(var(--muted-foreground) / 0.7)" }}>app.traderloading.com</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "hsl(var(--primary))" }}>
            <span style={{ width: 5, height: 5, borderRadius: 99, background: "hsl(var(--primary))", boxShadow: "0 0 8px hsl(var(--primary))", animation: "tl-pulse 1.6s ease-in-out infinite" }} />Live
          </span>
        </div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* clock row */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: 12, border: "1px solid hsl(var(--border) / 0.5)", background: "hsl(var(--card) / 0.6)", overflow: "hidden" }}>
            <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "hsl(var(--primary))", boxShadow: "0 0 14px hsl(var(--primary))" }} />
            <span style={{ fontFamily: "var(--tl-font-sans)", fontWeight: 700, fontSize: 22, fontVariantNumeric: "tabular-nums", color: "var(--tl-fg)" }}>14:32:08</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 8, fontSize: 11, fontWeight: 700, color: "hsl(35 100% 55%)", background: "hsl(35 100% 55% / 0.12)", border: "1px solid hsl(35 100% 55% / 0.3)", boxShadow: "0 0 16px hsl(35 100% 55% / 0.25)" }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: "hsl(35 100% 55%)", boxShadow: "0 0 8px hsl(35 100% 55%)" }} />Londra
            </span>
          </div>
          {/* equity + missions */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}>
            <div style={tile}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--tl-fg-muted)" }}>Equity</span>
                <span style={{ fontFamily: "var(--tl-font-mono)", fontSize: 11, fontWeight: 700, color: "hsl(142 71% 45%)" }}>+8.6R</span>
              </div>
              <MockSpark />
            </div>
            <div style={tile}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Icon name="target" size={13} color="hsl(var(--accent))" />
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--tl-fg)" }}>Missioni</span>
                <span style={{ marginLeft: "auto", fontFamily: "var(--tl-font-mono)", fontSize: 9, fontWeight: 700, color: "hsl(var(--primary))" }}>+75 XP</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: "hsl(var(--secondary))", overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: "72%", height: "100%", borderRadius: 99, background: "linear-gradient(90deg, hsl(var(--primary)), #6ee7b7)" }} />
              </div>
              {["Journaling", "Check-in"].map((m, i) => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: i ? "hsl(var(--muted-foreground) / 0.6)" : "var(--tl-fg)", marginTop: 3 }}>
                  <Icon name={i ? "check-circle-2" : "circle"} size={11} color={i ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"} />{m}
                </div>
              ))}
            </div>
          </div>
          {/* stat row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {stat("Win Rate", "64%", "hsl(142 71% 45%)")}
            {stat("P&L", "+24.6R", "hsl(142 71% 45%)")}
            {stat("Livello", "12", "var(--tl-fg)")}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Icon, Reveal, CountUp, Orbs, NavPill, ProductMock, MockSpark });
