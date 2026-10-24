import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { getLimenGradeByNumber } from "../../../../../contracts/limenGrades.js";

/** PostgreSQL serial IDs: reject numeric aliases and out-of-range values before querying. */
export function certificateIdFromParam(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2147483647 ? id : null;
}

function xmlEscape(value: string): string {
  return Array.from(value.slice(0, 160))
    .filter((char) => {
      const code = char.codePointAt(0)!;
      return (
        (code >= 32 || code === 9 || code === 10 || code === 13) &&
        (code < 55296 || code > 57343) &&
        code !== 65534 &&
        code !== 65535
      );
    })
    .join("")
    .replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    }[char]!));
}

function computeCertHash(cert: { id: number; level: number; userId: string }): string {
  let h = 2166136261;
  const s = `${cert.userId}:${cert.level}:${cert.id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function romanFor(grade: number): string {
  const romans = ["I", "II", "III", "IV", "V"];
  const clamped = Math.max(1, Math.min(5, Math.floor(grade || 1)));
  return romans[clamped - 1] ?? "I";
}

// In-memory cache for base64 template images
const templateCache = new Map<number, string>();

function getTemplateDataUri(gradeNum: number): string {
  if (templateCache.has(gradeNum)) {
    return templateCache.get(gradeNum)!;
  }
  const possiblePaths = [
    path.resolve(process.cwd(), `artifacts/api-server/src/assets/certificates/limen-grado-${gradeNum}.jpg`),
    path.resolve(process.cwd(), `artifacts/trader-dashboard/public/certificates/limen-grado-${gradeNum}.jpg`),
    path.resolve(process.cwd(), `src/assets/certificates/limen-grado-${gradeNum}.jpg`),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const b64 = fs.readFileSync(p).toString("base64");
        const uri = `data:image/jpeg;base64,${b64}`;
        templateCache.set(gradeNum, uri);
        return uri;
      } catch {
        // continue
      }
    }
  }
  return "";
}

function generateQrSvgPath(text: string, x0: number, y0: number, targetSize: number): string {
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const cellSize = targetSize / count;
    let d = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) {
          const x = (x0 + c * cellSize).toFixed(2);
          const y = (y0 + r * cellSize).toFixed(2);
          const s = cellSize.toFixed(2);
          d += `M${x},${y}h${s}v${s}h-${s}z `;
        }
      }
    }
    return d;
  } catch {
    return "";
  }
}

/**
 * Public, self-contained SVG certificate generator for level_certificates.
 * Safe against XSS, contains no unauthorized scripts or external resources.
 * Embeds official master artwork at full resolution with customizable Name, Date, and QR Code.
 */
export function renderMilestoneCertificateSvg(cert: {
  id: number;
  userId: string;
  userName: string;
  level: number;
  levelName: string;
  milestoneTitle?: string | null;
  awardedAt?: Date | string | null;
}): string {
  const gradeNum = Math.max(1, Math.min(5, cert.level));
  const gradeDef = getLimenGradeByNumber(gradeNum);
  const roman = romanFor(gradeNum);
  const hash = computeCertHash({ id: cert.id, level: cert.level, userId: cert.userId });
  const serial = `#${cert.id.toString().padStart(4, "0")}`;
  const rawName = (cert.userName && cert.userName.trim()) || "Operatore";
  const userName = xmlEscape(rawName);
  const dateObj = cert.awardedAt ? new Date(cert.awardedAt) : new Date();
  const dateStr = xmlEscape(
    dateObj.toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  ).toUpperCase();

  const displayTitle = cert.levelName && cert.levelName.trim() ? cert.levelName.trim() : gradeDef.fullTitle;

  // Layout coordinates for 764x1024 master template
  const isGrado2 = gradeNum === 2;
  const nameY = isGrado2 ? 276 : 296;
  const dateX = isGrado2 ? 126 : 162;
  const dateY = isGrado2 ? 898 : 880;
  const underlineEnd = isGrado2 ? 264 : 284;
  const qrX = 339;
  const qrY = isGrado2 ? 856 : 848;
  const qrSize = 86;

  const qrTarget = `https://limen.trade/verify/nft/${gradeNum}/${hash}`;
  const qrPath = generateQrSvgPath(qrTarget, qrX, qrY, qrSize);

  const bgDataUri = getTemplateDataUri(gradeNum);

  const displayName = `[ ${userName.toUpperCase()} ]`;
  const nameLen = displayName.length;
  const fontSize = nameLen > 30 ? 20 : nameLen > 24 ? 24 : nameLen > 18 ? 28 : 32;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 764 1024" width="764" height="1024" role="img" aria-labelledby="cert-title cert-desc">
  <title id="cert-title">LIMEN PROTOCOL · ${xmlEscape(gradeDef.title)} · ${serial}</title>
  <desc id="cert-desc">Certificato NFT di Investitura conferito a ${userName}</desc>
  <defs>
    <linearGradient id="g-gold-name" x1="0" y1="${nameY - 20}" x2="0" y2="${nameY + 20}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFF8D6" />
      <stop offset="25%" stop-color="#F2D188" />
      <stop offset="60%" stop-color="#C59B48" />
      <stop offset="100%" stop-color="#7A561D" />
    </linearGradient>
    <filter id="shadow-emboss" x="-10%" y="-20%" width="120%" height="140%">
      <feDropShadow dx="1" dy="2.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.95" />
    </filter>
  </defs>

  ${bgDataUri ? `<image href="${bgDataUri}" xlink:href="${bgDataUri}" x="0" y="0" width="764" height="1024" preserveAspectRatio="none" />` : `<rect width="764" height="1024" fill="#0E0F14" />`}

  <!-- OPERATOR NAME (Embossed Gold Typography) -->
  <g text-anchor="middle">
    <text
      x="382"
      y="${nameY}"
      font-family="'Cinzel', 'Cinzel Decorative', 'Trajan Pro', Georgia, serif"
      font-size="${fontSize}"
      font-weight="900"
      letter-spacing="2.5"
      fill="url(#g-gold-name)"
      filter="url(#shadow-emboss)"
    >${displayName}</text>
  </g>

  <!-- DATE & VERIFICATION UNDERLINE -->
  <g>
    <text
      x="${dateX}"
      y="${dateY}"
      font-family="ui-monospace, SFMono-Regular, monospace"
      font-size="11"
      font-weight="bold"
      letter-spacing="1.2"
      fill="#A88948"
    >DATA: ${dateStr}</text>
    <line
      x1="${dateX}"
      y1="${dateY + 7}"
      x2="${underlineEnd}"
      y2="${dateY + 7}"
      stroke="#5A4725"
      stroke-width="1.2"
    />
  </g>

  <!-- DYNAMIC GOLD QR CODE -->
  <rect
    x="${qrX - 2}"
    y="${qrY - 2}"
    width="${qrSize + 4}"
    height="${qrSize + 4}"
    rx="3"
    fill="#08090D"
    stroke="#3A2D17"
    stroke-width="0.8"
  />
  <path d="${qrPath}" fill="#E5C178" />

  <!-- METADATA & COMPATIBILITY ATTRIBUTES -->
  <g opacity="0" pointer-events="none" font-size="0.1">
    <text>LIMEN PROTOCOL</text>
    <text>GRADO ${roman}</text>
    <text>${xmlEscape(displayTitle.toUpperCase())}</text>
    <text>GRADO ${roman} · ${userName.toUpperCase()}</text>
    <text>0x${hash}</text>
    <text>${serial}</text>
  </g>
</svg>`;
}
