export interface DuelCardInfo {
  code: string;
  hostName?: string | null;
  challengerName?: string | null;
  pair?: string | null;
  timeframe?: string | null;
  durationMinutes?: number | null;
  status?: string | null;
}

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
 * Genera il payload SVG vettoriale 1200x630 del Duello / Arena della Disciplina AUREUS,
 * ottimizzato per OpenGraph e Twitter Card previews ad altissima definizione.
 */
export function renderDuelCardSvg(info: DuelCardInfo): string {
  const code = escapeXml(info.code.toUpperCase());
  const host = escapeXml(info.hostName || "Guerriero Aureus");
  const challenger = escapeXml(info.challengerName || "Sfidante dell'Ordine");
  const pair = escapeXml(info.pair || "XAUUSD");
  const tf = escapeXml(info.timeframe || "M5");
  const mins = info.durationMinutes ?? 15;
  const isFinished = info.status === "finished";
  const statusLabel = isFinished ? "DUELLO CONCLUSO" : "ARENA IN CORSO";
  const statusColor = isFinished ? "#94A3B8" : "#10B981";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <radialGradient id="arenaGoldGlow" cx="50%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#C5A059" stop-opacity="0.16" />
      <stop offset="60%" stop-color="#C5A059" stop-opacity="0.03" />
      <stop offset="100%" stop-color="#07080B" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="arenaBg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d0f16" />
      <stop offset="50%" stop-color="#07080b" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>
    <linearGradient id="arenaGoldBorder" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C5A059" stop-opacity="0.7" />
      <stop offset="50%" stop-color="#E8C56A" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#C5A059" stop-opacity="0.6" />
    </linearGradient>
    <filter id="arenaGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#C5A059" flood-opacity="0.3" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#arenaBg)" />
  <rect width="1200" height="630" fill="url(#arenaGoldGlow)" />

  <!-- Outer Imperial Border -->
  <rect x="24" y="24" width="1152" height="582" rx="12" stroke="url(#arenaGoldBorder)" stroke-width="1.5" fill="none" />
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
    <text x="52" y="32" fill="#94A3B8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="600" letter-spacing="2">LE PROVE DEL FUOCO · ARENA DELLA DISCIPLINA</text>

    <!-- Status Chip -->
    <g transform="translate(860, 4)">
      <rect width="220" height="32" rx="6" fill="rgba(16,185,129,0.12)" stroke="${statusColor}" stroke-opacity="0.4" stroke-width="1" />
      <circle cx="16" cy="16" r="4" fill="${statusColor}" />
      <text x="28" y="20" fill="${statusColor}" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">${statusLabel}</text>
    </g>
  </g>

  <!-- Divider Line -->
  <line x1="60" y1="112" x2="1140" y2="112" stroke="#C5A059" stroke-opacity="0.2" stroke-width="1" />

  <!-- Main Duel Headline -->
  <g transform="translate(60, 150)">
    <text x="0" y="0" fill="#C5A059" font-family="monospace" font-size="11" font-weight="bold" letter-spacing="3" text-transform="uppercase">STANZA DI BATTAGLIA · FORGIA DEL PASSATO</text>
    <text x="0" y="44" fill="#F4F4F6" font-family="Cinzel, Georgia, serif" font-size="36" font-weight="bold" filter="url(#arenaGlow)">${code}</text>

    <!-- Combatants VS Banner -->
    <g transform="translate(0, 75)">
      <!-- Host Box -->
      <rect width="440" height="90" rx="8" fill="#11131c" stroke="#C5A059" stroke-opacity="0.3" stroke-width="1" />
      <text x="20" y="30" fill="#94A3B8" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">SFIDANTE 1 (HOST)</text>
      <text x="20" y="65" fill="#E8C56A" font-family="Cinzel, Georgia, serif" font-size="24" font-weight="bold">${host}</text>

      <!-- VS Medallion -->
      <circle cx="510" cy="45" r="28" fill="#07080B" stroke="#E8C56A" stroke-width="1.5" />
      <text x="510" y="52" text-anchor="middle" fill="#E8C56A" font-family="monospace" font-size="16" font-weight="bold">VS</text>

      <!-- Challenger Box -->
      <g transform="translate(580, 0)">
        <rect width="440" height="90" rx="8" fill="#11131c" stroke="#C5A059" stroke-opacity="0.3" stroke-width="1" />
        <text x="20" y="30" fill="#94A3B8" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">SFIDANTE 2 (AVVERSARIO)</text>
        <text x="20" y="65" fill="#F4F4F6" font-family="Cinzel, Georgia, serif" font-size="24" font-weight="bold">${challenger}</text>
      </g>
    </g>

    <!-- Arena Specs Strip -->
    <g transform="translate(0, 200)">
      <rect width="1020" height="64" rx="8" fill="#0d0f14" stroke="#C5A059" stroke-opacity="0.2" stroke-width="1" />
      
      <g transform="translate(30, 24)">
        <text x="0" y="0" fill="#94A3B8" font-family="monospace" font-size="9" font-weight="bold" letter-spacing="1">ASSET OPERATIVO</text>
        <text x="0" y="24" fill="#E8C56A" font-family="monospace" font-size="16" font-weight="bold">${pair}</text>
      </g>

      <g transform="translate(280, 24)">
        <text x="0" y="0" fill="#94A3B8" font-family="monospace" font-size="9" font-weight="bold" letter-spacing="1">TIMEFRAME</text>
        <text x="0" y="24" fill="#F4F4F6" font-family="monospace" font-size="16" font-weight="bold">${tf}</text>
      </g>

      <g transform="translate(530, 24)">
        <text x="0" y="0" fill="#94A3B8" font-family="monospace" font-size="9" font-weight="bold" letter-spacing="1">DURATA SESSIONE</text>
        <text x="0" y="24" fill="#F4F4F6" font-family="monospace" font-size="16" font-weight="bold">${mins} Minuti</text>
      </g>

      <g transform="translate(780, 24)">
        <text x="0" y="0" fill="#94A3B8" font-family="monospace" font-size="9" font-weight="bold" letter-spacing="1">CAPITALE DI FORGIA</text>
        <text x="0" y="24" fill="#10B981" font-family="monospace" font-size="16" font-weight="bold">€100.000</text>
      </g>
    </g>
  </g>

  <!-- Bottom Footer Telemetry Bar -->
  <line x1="60" y1="490" x2="1140" y2="490" stroke="#C5A059" stroke-opacity="0.2" stroke-width="1" />

  <g transform="translate(60, 535)">
    <text x="0" y="0" fill="#94A3B8" font-family="monospace" font-size="10" font-weight="bold" letter-spacing="1">TRASMISSIONE SPETTATORI IN DIRETTA CRITTOGRAFICA:</text>
    <text x="0" y="22" fill="#E8C56A" font-family="monospace" font-size="15" font-weight="bold" letter-spacing="1">HTTPS://AUREUS-OS.APP/DUELLO/${code}</text>
    <text x="1080" y="10" text-anchor="end" fill="#64748B" font-family="-apple-system, sans-serif" font-size="11">AUREUS PROTOCOL · LE PROVE DEL FUOCO</text>
    <text x="1080" y="26" text-anchor="end" fill="#C5A059" font-family="monospace" font-size="10">INTEGRITÀ MATEMATICA SOVRANA</text>
  </g>
</svg>`;
}

/**
 * Genera la pagina HTML responsive con metatag OpenGraph e Twitter Cards per le Arene della Disciplina.
 */
export function renderDuelCardHtml(info: DuelCardInfo, baseUrl: string): string {
  const code = escapeXml(info.code.toUpperCase());
  const host = escapeXml(info.hostName || "Guerriero Aureus");
  const challenger = escapeXml(info.challengerName || "Sfidante dell'Ordine");
  const pair = escapeXml(info.pair || "XAUUSD");
  const tf = escapeXml(info.timeframe || "M5");
  const mins = info.durationMinutes ?? 15;

  const pageTitle = `AUREUS PROTOCOL · Arena della Disciplina: ${host} vs ${challenger} [${code}]`;
  const pageDescription = `Assisti al duello di trading in tempo reale nella Forgia del Passato sul protocollo AUREUS [${pair} · ${tf} · ${mins} min · €100.000]. Rigore matematico ad armi pari.`;
  const url = `${baseUrl}/duello/${encodeURIComponent(code)}`;
  const ogImageUrl = `${baseUrl}/api/public/og-duello/${encodeURIComponent(code)}.svg`;

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDescription}" />
  <link rel="canonical" href="${url}" />

  <!-- OpenGraph Metadata -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="AUREUS PROTOCOL" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${pageTitle}" />
  <meta property="og:description" content="${pageDescription}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:type" content="image/svg+xml" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter / X Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${url}" />
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
    .card-preview {
      width: 100%;
      aspect-ratio: 1200 / 630;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--gold-border);
      box-shadow: 0 0 35px rgba(197, 160, 89, 0.12);
      background: var(--bg-panel);
    }
    .card-preview img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.85rem 1.75rem;
      border-radius: 8px;
      background: linear-gradient(135deg, #E8C56A, #C5A059);
      color: #07080B;
      font-family: monospace;
      font-size: 0.9rem;
      font-weight: bold;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-decoration: none;
      box-shadow: 0 0 20px rgba(197, 160, 89, 0.35);
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-action:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card-preview">
      <img src="${ogImageUrl}" alt="${pageTitle}" width="1200" height="630" />
    </div>

    <div style="text-align: center; margin-top: 1rem;">
      <a href="${url}" class="btn-action">
        Accedi al Banco Spettatori in Tempo Reale
      </a>
      <p style="margin-top: 0.75rem; font-family: monospace; font-size: 0.75rem; color: var(--slate-subtle);">
        Trasmissione sincronizzata sul protocollo AUREUS
      </p>
    </div>
  </div>
</body>
</html>`;
}
