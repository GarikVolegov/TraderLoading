/** PostgreSQL serial IDs: reject numeric aliases and out-of-range values before querying. */
export function certificateIdFromParam(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

function xmlText(value: string): string {
  return Array.from(value.slice(0, 160)).filter(char => {
    const code = char.codePointAt(0)!;
    return (code >= 32 || code === 9 || code === 10 || code === 13)
      && (code < 55296 || code > 57343) && code !== 65534 && code !== 65535;
  }).join("")
    .replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]!);
}

/** Public award artwork deliberately contains no account, wallet, avatar or external resources. */
export function renderCertificateImage(cert: { tier: string; seasonLabel: string; edition: string; rarity: string }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640" viewBox="0 0 1000 640" role="img" aria-labelledby="title desc">
<title id="title">TraderLoading · ${xmlText(cert.tier)}</title>
<desc id="desc">Certificato del torneo ${xmlText(cert.seasonLabel)}</desc>
<rect width="1000" height="640" rx="32" fill="#10191b"/>
<rect x="28" y="28" width="944" height="584" rx="20" fill="none" stroke="#4ba88e" stroke-width="2"/>
<path d="M500 94l20 42 46 7-33 32 8 46-41-22-41 22 8-46-33-32 46-7z" fill="#4ba88e"/>
<g font-family="system-ui,sans-serif" text-anchor="middle">
<text x="500" y="276" fill="#4ba88e" font-size="24" letter-spacing="5">TRADERLOADING</text>
<text x="500" y="344" fill="#f5f7f6" font-size="40">${xmlText(cert.tier)}</text>
<text x="500" y="399" fill="#c1cfcb" font-size="24">${xmlText(cert.seasonLabel)}</text>
<text x="500" y="481" fill="#c1cfcb" font-size="20">${xmlText(cert.edition)} · ${xmlText(cert.rarity)}</text>
<text x="500" y="558" fill="#829892" font-size="16">Certificato del torneo</text>
</g></svg>`;
}
