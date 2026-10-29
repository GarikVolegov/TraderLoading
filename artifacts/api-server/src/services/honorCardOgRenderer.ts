import { type RegisteredHonorSeal } from "./honorCardVerification.js";

function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Genera il payload SVG vettoriale 1200x630 della Scheda d'Onore AUREUS,
 * ottimizzato per OpenGraph e Twitter Card previews ad altissima risoluzione.
 */
export function renderHonorCardSvg(
  seal: RegisteredHonorSeal | null,
  fallbackHash?: string,
): string {
  const hash = escapeXml(seal?.hash || fallbackHash || "0x0000000000000000");
  const operatorName = escapeXml(seal?.operatorName || "Operatore dell'Ordine");
  const operatorGrade = escapeXml(seal?.operatorGrade || "L'Iniziato");
  const title = escapeXml(seal?.title || "Sessione di Forgiatura");
  const symbol = escapeXml(seal?.symbol || "EURUSD");
  const pnl = escapeXml(seal?.totalProfitFormatted || "+€0.00");
  const isPnlPositive = !pnl.startsWith("-");
  const pnlColor = isPnlPositive ? "#10B981" : "#EF4444";
  const winRate = seal?.winRate != null ? `${seal.winRate}%` : "100%";
  const integrityScore = seal?.integrityScore != null ? `${seal.integrityScore}%` : "100%";
  const drawdown = escapeXml(seal?.drawdown != null ? `${seal.drawdown}%` : "0.0%");
  const isVerified = seal !== null;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <radialGradient id="goldGlow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#C5A059" stop-opacity="0.14" />
      <stop offset="60%" stop-color="#C5A059" stop-opacity="0.02" />
      <stop offset="100%" stop-color="#07080B" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d0f16" />
      <stop offset="50%" stop-color="#07080b" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>
    <linearGradient id="goldBorder" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C5A059" stop-opacity="0.6" />
      <stop offset="50%" stop-color="#E8C56A" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#C5A059" stop-opacity="0.5" />
    </linearGradient>
    <filter id="subtleGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#C5A059" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />
  <rect width="1200" height="630" fill="url(#goldGlow)" />

  <!-- Outer Imperial Border -->
  <rect x="24" y="24" width="1152" height="582" rx="12" stroke="url(#goldBorder)" stroke-width="1.5" fill="none" />
  <rect x="32" y="32" width="1136" height="566" rx="8" stroke="#C5A059" stroke-opacity="0.15" stroke-width="1" fill="none" />

  <!-- Corner Filigree Ornaments -->
  <path d="M 24 64 L 24 24 L 64 24" stroke="#E8C56A" stroke-width="3" fill="none" />
  <path d="M 1136 24 L 1176 24 L 1176 64" stroke="#E8C56A" stroke-width="3" fill="none" />
  <path d="M 24 566 L 24 606 L 64 606" stroke="#E8C56A" stroke-width="3" fill="none" />
  <path d="M 1136 606 L 1176 606 L 1176 566" stroke="#E8C56A" stroke-width="3" fill="none" />

  <!-- Top Header Bar -->
  <g transform="translate(60, 56)">
    <!-- Medallion Seal Icon -->
    <circle cx="20" cy="20" r="18" fill="#141722" stroke="#C5A059" stroke-width="1.5" />
    <polygon points="20,8 24,16 32,16 26,22 28,30 20,25 12,30 14,22 8,16 16,16" fill="#E8C56A" />

    <!-- Protocol Wordmark -->
    <text x="52" y="17" fill="#E8C56A" font-family="Cinzel, Georgia, serif" font-size="16" font-weight="bold" letter-spacing="4">AUREUS PROTOCOL</text>
    <text x="52" y="32" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" letter-spacing="2">IL CODICE DELLA PRESENZA E DELL&apos;EREDITÀ</text>

    <!-- Verification Status Chip -->
    <g transform="translate(860, 4)">
      <rect width="220" height="32" rx="6" fill="${isVerified ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)"}" stroke="${isVerified ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}" stroke-width="1" />
      <circle cx="16" cy="16" r="4" fill="${isVerified ? "#10B981" : "#EF4444"}" />
      <text x="28" y="20" fill="${isVerified ? "#34D399" : "#F87171"}" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">${isVerified ? "CRITTOGRAFIA CONFORME" : "SIGILLO IN VERIFICA"}</text>
    </g>
  </g>

  <!-- Divider Line -->
  <line x1="60" y1="112" x2="1140" y2="112" stroke="#C5A059" stroke-opacity="0.2" stroke-width="1" />

  <!-- Operator Section -->
  <g transform="translate(60, 150)">
    <text x="0" y="0" fill="#C5A059" font-family="monospace" font-size="11" font-weight="bold" letter-spacing="3" text-transform="uppercase">PROVA DEL FUOCO CERTIFICATA</text>
    <text x="0" y="44" fill="#F4F4F6" font-family="Cinzel, Georgia, serif" font-size="38" font-weight="bold" filter="url(#subtleGlow)">${operatorName}</text>
    <g transform="translate(0, 60)">
      <rect width="130" height="24" rx="4" fill="rgba(197,160,89,0.15)" stroke="rgba(197,160,89,0.4)" stroke-width="1" />
      <text x="10" y="16" fill="#E8C56A" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">${operatorGrade}</text>
      <text x="145" y="16" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="14">${title} · <tspan fill="#E8C56A" font-family="monospace" font-weight="bold">${symbol}</tspan></text>
    </g>
  </g>

  <!-- 4 Bento KPI Metric Cards -->
  <g transform="translate(60, 290)">
    <!-- Card 1: PnL -->
    <g transform="translate(0, 0)">
      <rect width="255" height="150" rx="10" fill="#0D0F16" stroke="rgba(197,160,89,0.22)" stroke-width="1" />
      <rect x="0" y="0" width="255" height="3" fill="${pnlColor}" />
      <text x="20" y="32" fill="#94A3B8" font-family="monospace" font-size="11" font-weight="bold" letter-spacing="1">RENDIMENTO NETTO</text>
      <text x="20" y="82" fill="${pnlColor}" font-family="monospace" font-size="34" font-weight="bold">${pnl}</text>
      <text x="20" y="122" fill="#64748B" font-family="-apple-system, sans-serif" font-size="11">Capitale sovrano generato</text>
    </g>

    <!-- Card 2: Win Rate -->
    <g transform="translate(275, 0)">
      <rect width="255" height="150" rx="10" fill="#0D0F16" stroke="rgba(197,160,89,0.22)" stroke-width="1" />
      <rect x="0" y="0" width="255" height="3" fill="#E8C56A" />
      <text x="20" y="32" fill="#94A3B8" font-family="monospace" font-size="11" font-weight="bold" letter-spacing="1">TASSO DI VITTORIA</text>
      <text x="20" y="82" fill="#E8C56A" font-family="monospace" font-size="34" font-weight="bold">${winRate}</text>
      <text x="20" y="122" fill="#64748B" font-family="-apple-system, sans-serif" font-size="11">Precisione delle sentenze</text>
    </g>

    <!-- Card 3: Integrity Index -->
    <g transform="translate(550, 0)">
      <rect width="255" height="150" rx="10" fill="#0D0F16" stroke="rgba(197,160,89,0.22)" stroke-width="1" />
      <rect x="0" y="0" width="255" height="3" fill="#10B981" />
      <text x="20" y="32" fill="#94A3B8" font-family="monospace" font-size="11" font-weight="bold" letter-spacing="1">INDICE INTEGRITÀ</text>
      <text x="20" y="82" fill="#10B981" font-family="monospace" font-size="34" font-weight="bold">${integrityScore}</text>
      <text x="20" y="122" fill="#64748B" font-family="-apple-system, sans-serif" font-size="11">Aderenza al Codice Aureo</text>
    </g>

    <!-- Card 4: Drawdown -->
    <g transform="translate(825, 0)">
      <rect width="255" height="150" rx="10" fill="#0D0F16" stroke="rgba(197,160,89,0.22)" stroke-width="1" />
      <rect x="0" y="0" width="255" height="3" fill="#94A3B8" />
      <text x="20" y="32" fill="#94A3B8" font-family="monospace" font-size="11" font-weight="bold" letter-spacing="1">DRAWDOWN MASSIMO</text>
      <text x="20" y="82" fill="#F4F4F6" font-family="monospace" font-size="34" font-weight="bold">${drawdown}</text>
      <text x="20" y="122" fill="#64748B" font-family="-apple-system, sans-serif" font-size="11">Preservazione del rischio</text>
    </g>
  </g>

  <!-- Bottom Footer Telemetry Bar -->
  <line x1="60" y1="480" x2="1140" y2="480" stroke="#C5A059" stroke-opacity="0.2" stroke-width="1" />

  <g transform="translate(60, 524)">
    <text x="0" y="0" fill="#94A3B8" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">HASH CERTIFICATO (MURMUR64):</text>
    <text x="0" y="24" fill="#E8C56A" font-family="monospace" font-size="16" font-weight="bold" letter-spacing="1">${hash}</text>
    <text x="1080" y="12" text-anchor="end" fill="#64748B" font-family="-apple-system, sans-serif" font-size="11">AUREUS PROTOCOL · BANCO DI FORGIATURA SOVRANO</text>
    <text x="1080" y="28" text-anchor="end" fill="#C5A059" font-family="monospace" font-size="10">IMMUTABILE &amp; CRITTOGRAFICAMENTE VERIFICABILE</text>
  </g>
</svg>`;
}

/**
 * Genera la pagina HTML responsive con metatag OpenGraph e Twitter Cards,
 * offrendo una visualizzazione solenne a chiunque clicchi sul link o lo condivida sui social.
 */
export function renderHonorCardHtml(
  seal: RegisteredHonorSeal | null,
  baseUrl: string,
  rawHash: string,
): string {
  const hash = escapeXml(seal?.hash || rawHash);
  const operatorName = escapeXml(seal?.operatorName || "Operatore dell'Ordine");
  const operatorGrade = escapeXml(seal?.operatorGrade || "L'Iniziato");
  const pnl = escapeXml(seal?.totalProfitFormatted || "+€0.00");
  const winRate = seal?.winRate != null ? `${seal.winRate}%` : "100%";
  const integrityScore = seal?.integrityScore != null ? `${seal.integrityScore}%` : "100%";
  const ogImageUrl = `${baseUrl}/api/public/og-honor/${encodeURIComponent(hash)}.svg`;
  const sharePageUrl = `${baseUrl}/api/public/verify-honor/${encodeURIComponent(hash)}`;

  const pageTitle = `AUREUS PROTOCOL · Sigillo d'Onore: ${operatorName} (${operatorGrade})`;
  const pageDescription = `Verifica crittografica certificata AUREUS-MURMUR64 · Rendimento: ${pnl} | Win Rate: ${winRate} | Integrità: ${integrityScore}% · Il Codice della Presenza e dell'Eredità.`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}" />
  <link rel="canonical" href="${sharePageUrl}" />

  <!-- OpenGraph Metadata -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="AUREUS PROTOCOL" />
  <meta property="og:url" content="${sharePageUrl}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${pageDescription}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${sharePageUrl}" />
  <meta name="twitter:title" content="${pageTitle}" />
  <meta name="twitter:description" content="${pageDescription}" />
  <meta name="twitter:image" content="${ogImageUrl}" />

  <style>
    :root {
      --bg-obsidian: #07080b;
      --bg-panel: #0d0f16;
      --gold-base: #C5A059;
      --gold-glow: #E8C56A;
      --gold-border: rgba(197, 160, 89, 0.25);
      --emerald: #10b981;
      --slate-subtle: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg-obsidian);
      color: #f4f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .wrapper {
      width: 100%;
      max-width: 860px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--gold-border);
      padding-bottom: 1rem;
    }
    .brand-title {
      font-family: Georgia, serif;
      font-size: 1.1rem;
      font-weight: bold;
      color: var(--gold-glow);
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .brand-sub {
      font-size: 0.7rem;
      color: var(--slate-subtle);
      font-mono;
      letter-spacing: 1px;
    }
    .status-badge {
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: bold;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    .card-preview-container {
      width: 100%;
      aspect-ratio: 1200 / 630;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--gold-border);
      box-shadow: 0 0 35px rgba(197, 160, 89, 0.12);
      background: var(--bg-panel);
    }
    .card-preview-container img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .telemetry-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .telemetry-card {
      background: var(--bg-panel);
      border: 1px solid var(--gold-border);
      border-radius: 8px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .metric-label {
      font-family: monospace;
      font-size: 0.7rem;
      color: var(--slate-subtle);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .metric-val {
      font-family: monospace;
      font-size: 1.4rem;
      font-weight: bold;
      color: var(--gold-glow);
    }
    .metric-val.green { color: var(--emerald); }
    .hash-banner {
      background: rgba(197, 160, 89, 0.08);
      border: 1px solid var(--gold-border);
      border-radius: 8px;
      padding: 0.85rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .hash-val {
      font-family: monospace;
      font-size: 0.9rem;
      color: var(--gold-glow);
      font-weight: bold;
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    .btn {
      font-family: monospace;
      font-size: 0.8rem;
      font-weight: bold;
      padding: 0.65rem 1.2rem;
      border-radius: 8px;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .btn-primary {
      background: linear-gradient(135deg, #C5A059 0%, #E8C56A 50%, #C5A059 100%);
      color: #07080b;
      box-shadow: 0 0 15px rgba(197, 160, 89, 0.3);
    }
    .btn-primary:hover {
      box-shadow: 0 0 25px rgba(197, 160, 89, 0.5);
      transform: translateY(-1px);
    }
    .btn-subtle {
      background: rgba(255, 255, 255, 0.05);
      color: #f4f4f6;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    .btn-subtle:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: var(--gold-base);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header class="header-bar">
      <div>
        <h1 class="brand-title">AUREUS PROTOCOL</h1>
        <p class="brand-sub">IL CODICE DELLA PRESENZA E DELL&apos;EREDITÀ</p>
      </div>
      <div class="status-badge">
        <span class="status-dot"></span>
        <span>${seal ? "FIRMA VERIFICATA · VERIFICATO MATEMATICAMENTE" : "HASH NON REGISTRATO"}</span>
      </div>
    </header>

    <main class="card-preview-container">
      <img src="${ogImageUrl}" alt="${pageTitle}" />
    </main>

    <section class="telemetry-grid">
      <div class="telemetry-card">
        <span class="metric-label">Operatore Sovrano</span>
        <span class="metric-val" style="font-size: 1.15rem;">${operatorName}</span>
      </div>
      <div class="telemetry-card">
        <span class="metric-label">Grado di Ascesa</span>
        <span class="metric-val" style="font-size: 1.15rem;">${operatorGrade}</span>
      </div>
      <div class="telemetry-card">
        <span class="metric-label">Rendimento Netto</span>
        <span class="metric-val green">${pnl}</span>
      </div>
      <div class="telemetry-card">
        <span class="metric-label">Indice d&apos;Integrità</span>
        <span class="metric-val green">${integrityScore}</span>
      </div>
    </section>

    <div class="hash-banner">
      <div>
        <div class="metric-label">Firma Crittografica (HMAC-SHA256)</div>
        <div class="hash-val">${hash}</div>
      </div>
      <button class="btn btn-subtle" onclick="navigator.clipboard.writeText('${sharePageUrl}').then(() => alert('Link di verifica copiato negli appunti'))">
        Copia Link Verifica
      </button>
    </div>

    <footer class="actions">
      <a href="/" class="btn btn-primary">
        Accedi al Cockpit AUREUS OS ↗
      </a>
    </footer>
  </div>
</body>
</html>`;
}
