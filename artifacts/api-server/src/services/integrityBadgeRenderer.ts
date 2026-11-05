function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe == null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface IntegrityBadgeOptions {
  label?: string;
  score?: number | string;
  sealCode?: string;
  statusText?: string;
}

/**
 * Genera un badge vettoriale SVG ad alta definizione in stile Shields.io
 * con palette AUREUS (Nero Ossidiana, Oro Imperiale e Smeraldo dell'Integrità),
 * idoneo per GitHub README, documentazioni, siti esterni e profili social.
 */
export function renderIntegrityBadgeSvg(options: IntegrityBadgeOptions = {}): string {
  const label = escapeXml(options.label || "AUREUS");
  const scoreNum = Number(options.score ?? 100);
  const isValidScore = Number.isFinite(scoreNum) && scoreNum >= 0 && scoreNum <= 100;
  const scoreDisplay = isValidScore ? `${Math.round(scoreNum)}%` : "100%";
  const status = escapeXml(options.statusText || `${scoreDisplay} INTEGRITY`);
  const seal = options.sealCode ? escapeXml(options.sealCode) : null;

  const leftText = label.toUpperCase();
  const rightText = seal ? `${status} · ${seal}` : status;

  const leftWidth = Math.max(70, leftText.length * 8.5 + 20);
  const rightWidth = Math.max(95, rightText.length * 7.5 + 22);
  const totalWidth = leftWidth + rightWidth;
  const height = 26;

  const leftCenter = leftWidth / 2;
  const rightCenter = leftWidth + rightWidth / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="${leftText}: ${rightText}">
  <title>${leftText}: ${rightText}</title>
  <defs>
    <linearGradient id="goldText" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#E8C56A" />
      <stop offset="100%" stop-color="#C5A059" />
    </linearGradient>
    <clipPath id="rounded">
      <rect width="${totalWidth}" height="${height}" rx="5" fill="#fff" />
    </clipPath>
  </defs>

  <g clip-path="url(#rounded)">
    <!-- Left panel (Obsidian base) -->
    <rect width="${leftWidth}" height="${height}" fill="#0d0f16" />
    <!-- Right panel (Deep void) -->
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="#07080b" />
  </g>

  <!-- Border -->
  <rect width="${totalWidth}" height="${height}" rx="5" fill="none" stroke="#C5A059" stroke-opacity="0.38" stroke-width="1" />

  <!-- Divider line -->
  <line x1="${leftWidth}" y1="0" x2="${leftWidth}" y2="${height}" stroke="#C5A059" stroke-opacity="0.25" stroke-width="1" />

  <!-- Text -->
  <g font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="10.5" font-weight="700">
    <text x="${leftCenter}" y="17" fill="url(#goldText)" text-anchor="middle" letter-spacing="0.5">${leftText}</text>
    <text x="${rightCenter}" y="17" fill="#10B981" text-anchor="middle" letter-spacing="0.3">${rightText}</text>
  </g>
</svg>`;
}
