import { createCanvas, loadImage } from "@napi-rs/canvas";
import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs";

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
<title id="title">AUREUS · ${xmlText(cert.tier)}</title>
<desc id="desc">Certificato del torneo ${xmlText(cert.seasonLabel)}</desc>
<rect width="1000" height="640" rx="32" fill="#10191b"/>
<rect x="28" y="28" width="944" height="584" rx="20" fill="none" stroke="#C5A059" stroke-width="2"/>
<path d="M500 94l20 42 46 7-33 32 8 46-41-22-41 22 8-46-33-32 46-7z" fill="#C5A059"/>
<g font-family="system-ui,sans-serif" text-anchor="middle">
<text x="500" y="276" fill="#C5A059" font-size="24" letter-spacing="5">AUREUS</text>
<text x="500" y="344" fill="#f5f7f6" font-size="40">${xmlText(cert.tier)}</text>
<text x="500" y="399" fill="#c1cfcb" font-size="24">${xmlText(cert.seasonLabel)}</text>
<text x="500" y="481" fill="#c1cfcb" font-size="20">${xmlText(cert.edition)} · ${xmlText(cert.rarity)}</text>
<text x="500" y="558" fill="#829892" font-size="16">Certificato del torneo</text>
</g></svg>`;
}

const TIER_COLORS: Record<string, { text: string; glow: string; qrDark: string }> = {
  champion: { text: "#F5D78A", glow: "rgba(230, 190, 90, 0.75)", qrDark: "#E6BE5A" },
  podio: { text: "#E5E9F0", glow: "rgba(215, 222, 235, 0.75)", qrDark: "#D8DFEB" },
  finisher: { text: "#E6A26E", glow: "rgba(218, 145, 90, 0.75)", qrDark: "#CD7F32" },
};

function resolveTemplatePath(tier: string): string {
  const normTier = tier.toLowerCase();
  const fileCandidates = [
    path.resolve(process.cwd(), "artifacts/api-server/src/assets/tornei", `cert-${normTier}.jpg`),
    path.resolve(process.cwd(), "artifacts/trader-dashboard/public/images/tornei", `cert-${normTier}.jpg`),
    path.resolve(process.cwd(), "src/assets/tornei", `cert-${normTier}.jpg`),
  ];
  for (const candidate of fileCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return fileCandidates[0]!;
}

/**
 * Genera l'immagine master personalizzata 1024x1024 in PNG con:
 * 1. Lo sfondo cesellato ufficiale del torneo.
 * 2. Il nome reale del trader vincitore impresso con precisione nobiliare.
 * 3. Il QR Code scansionabile reale che rimanda alla pagina di verifica on-chain.
 */
export async function renderCertificatePng(cert: {
  id?: number | string;
  tier: string;
  userName?: string | null;
  seasonLabel?: string;
  verifyUrl?: string;
}): Promise<Buffer> {
  const tierKey = (cert.tier || "finisher").toLowerCase();
  const templatePath = resolveTemplatePath(tierKey);
  const baseImg = await loadImage(templatePath);

  const canvas = createCanvas(1024, 1024);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImg, 0, 0, 1024, 1024);

  // 1. Sostituzione impeccabile del placeholder [ NOME UTENTE ]
  const cleanName = (cert.userName || "OPERATORE AUREUS").trim().toUpperCase();
  const bgGrad = ctx.createLinearGradient(200, 368, 824, 368);
  bgGrad.addColorStop(0, "rgba(12, 14, 18, 0)");
  bgGrad.addColorStop(0.12, "rgba(14, 17, 23, 0.96)");
  bgGrad.addColorStop(0.5, "rgba(15, 18, 25, 0.98)");
  bgGrad.addColorStop(0.88, "rgba(14, 17, 23, 0.96)");
  bgGrad.addColorStop(1, "rgba(12, 14, 18, 0)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(200, 344, 624, 48);

  const colors = TIER_COLORS[tierKey] ?? TIER_COLORS.finisher!;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = cleanName.length > 24 ? 18 : cleanName.length > 16 ? 22 : 28;
  ctx.font = `700 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = colors.text;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 14;
  ctx.fillText(cleanName, 512, 368);
  ctx.restore();

  // 2. Generazione del QR Code scansionabile con fotocamera
  const qrUrl = cert.verifyUrl || `https://aureus-os.app/tornei${cert.id ? `?cert=${cert.id}` : ""}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    color: { dark: colors.qrDark, light: "#0B0D12" },
    width: 256,
  });
  const qrImg = await loadImage(qrDataUrl);
  ctx.fillStyle = "#0B0D12";
  ctx.fillRect(174, 736, 134, 134);
  ctx.drawImage(qrImg, 180, 742, 122, 122);

  return canvas.toBuffer("image/png");
}
