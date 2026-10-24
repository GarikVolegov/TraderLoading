import QRCode from "qrcode";
import { getLimenGradeByNumber, type LimenGradeDefinition } from "../../../../../contracts/limenGrades";
import { getGradeRoman } from "./LimenGradeSigil";

export interface CertificateData {
  id: number;
  userId: string | number;
  userName: string;
  avatarUrl: string | null;
  level: number;
  levelName: string;
  milestoneTitle?: string;
  awardedAt: string;
  customGradeTitle?: string;
  customGradeLabel?: string;
  customDate?: string;
  customQrCode?: string;
  showBrackets?: boolean;
}

export interface CertificateLayout {
  nameY: number;
  dateX: number;
  dateY: number;
  underlineEnd: number;
  qrX: number;
  qrY: number;
  qrSize: number;
}

export function getCertificateLayout(grade: number): CertificateLayout {
  const clamped = Math.max(1, Math.min(5, Math.floor(grade || 1)));
  if (clamped === 2) {
    return {
      nameY: 276,
      dateX: 126,
      dateY: 898,
      underlineEnd: 264,
      qrX: 339,
      qrY: 856,
      qrSize: 86,
    };
  }
  return {
    nameY: 296,
    dateX: 162,
    dateY: 880,
    underlineEnd: 284,
    qrX: 339,
    qrY: 848,
    qrSize: 86,
  };
}

export function getCertificateUrl(grade: number): string {
  const clamped = Math.max(1, Math.min(5, Math.floor(grade || 1)));
  return `/certificates/limen-grado-${clamped}.jpg`;
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function computeCertHash(cert: { id: number; level: number; userId: string | number }): string {
  let h = 2166136261;
  const s = `${cert.userId}:${cert.level}:${cert.id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function generateQrSvgPath(text: string, x0: number, y0: number, targetSize: number): string {
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
  } catch (err) {
    console.warn("Error generating QR SVG path:", err);
    return "";
  }
}

/**
 * Returns complete standalone luxury SVG string for an official LIMEN NFT Certificate.
 * Portrait format: 764 x 1024 px matching the official high-resolution artwork.
 */
export function generateCertificateSvg(
  cert: CertificateData,
  formattedDate?: string,
  imageHref?: string,
): string {
  const gradeNum = Math.max(1, Math.min(5, cert.level));
  const gradeDef: LimenGradeDefinition = getLimenGradeByNumber(gradeNum);
  const roman = getGradeRoman(gradeNum);
  const hash = computeCertHash(cert);
  const serial = `#${cert.id.toString().padStart(4, "0")}`;
  const layout = getCertificateLayout(gradeNum);

  const rawName = (cert.userName && cert.userName.trim()) || "OPERATORE";
  const withBrackets = cert.showBrackets !== false;
  const displayName = withBrackets ? `[ ${rawName.toUpperCase()} ]` : rawName.toUpperCase();

  const nameLen = displayName.length;
  const fontSize = nameLen > 30 ? 20 : nameLen > 24 ? 24 : nameLen > 18 ? 28 : 32;

  const displayDate = xmlEscape(
    cert.customDate?.trim() ||
      formattedDate ||
      new Date(cert.awardedAt || Date.now()).toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
  ).toUpperCase();

  const defaultQrUrl = `https://limen.trade/verify/nft/${gradeNum}/${hash}`;
  const qrTarget = cert.customQrCode?.trim() || defaultQrUrl;
  const qrPath = generateQrSvgPath(qrTarget, layout.qrX, layout.qrY, layout.qrSize);

  const bgHref = imageHref || getCertificateUrl(gradeNum);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 764 1024" width="764" height="1024" role="img" aria-labelledby="cert-title cert-desc">
  <title id="cert-title">LIMEN PROTOCOL · ${xmlEscape(gradeDef.title)} · ${serial}</title>
  <desc id="cert-desc">Certificato NFT di Grado conferito a ${xmlEscape(rawName)}</desc>
  <defs>
    <!-- Gold Gradient for Name Text -->
    <linearGradient id="cert-name-gold" x1="0" y1="${layout.nameY - 20}" x2="0" y2="${layout.nameY + 20}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#FFF8D6" />
      <stop offset="25%" stop-color="#F2D188" />
      <stop offset="60%" stop-color="#C59B48" />
      <stop offset="100%" stop-color="#7A561D" />
    </linearGradient>

    <!-- Deep 3D Shadow for Embossed Gold Typography -->
    <filter id="cert-emboss-shadow" x="-10%" y="-20%" width="120%" height="140%">
      <feDropShadow dx="1" dy="2.5" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.95" />
    </filter>

    <style>
      .font-serif-luxury {
        font-family: 'Cinzel', 'Cinzel Decorative', 'Trajan Pro', Georgia, 'Times New Roman', serif;
      }
      .font-mono-cert {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
    </style>
  </defs>

  <!-- 1. OFFICIAL MASTER CERTIFICATE ARTWORK (Full 764x1024) -->
  <image href="${bgHref}" xlink:href="${bgHref}" x="0" y="0" width="764" height="1024" preserveAspectRatio="none" />

  <!-- 2. CUSTOM OPERATOR NAME (Embossed Metallic Gold) -->
  <g text-anchor="middle">
    <text
      x="382"
      y="${layout.nameY}"
      class="font-serif-luxury"
      font-size="${fontSize}"
      font-weight="900"
      letter-spacing="2.5"
      fill="url(#cert-name-gold)"
      filter="url(#cert-emboss-shadow)"
    >${xmlEscape(displayName)}</text>
  </g>

  <!-- 3. CUSTOM DATE & VERIFICATION UNDERLINE -->
  <g>
    <text
      x="${layout.dateX}"
      y="${layout.dateY}"
      class="font-mono-cert"
      font-size="11"
      font-weight="bold"
      letter-spacing="1.2"
      fill="#A88948"
    >DATA: ${displayDate}</text>
    <line
      x1="${layout.dateX}"
      y1="${layout.dateY + 7}"
      x2="${layout.underlineEnd}"
      y2="${layout.dateY + 7}"
      stroke="#5A4725"
      stroke-width="1.2"
    />
  </g>

  <!-- 4. DYNAMIC HIGH-RESOLUTION SCANNABLE QR CODE (Vector Gold Modules) -->
  <!-- Dark QR Background Shield -->
  <rect
    x="${layout.qrX - 2}"
    y="${layout.qrY - 2}"
    width="${layout.qrSize + 4}"
    height="${layout.qrSize + 4}"
    rx="3"
    fill="#08090D"
    stroke="#3A2D17"
    stroke-width="0.8"
  />
  <path d="${qrPath}" fill="#E5C178" />

  <!-- Embedded Hidden Metadata (Accessible by scrapers/parsers) -->
  <metadata>
    <limen:certificate
      xmlns:limen="https://limen.trade/protocol"
      id="${cert.id}"
      grade="${gradeNum}"
      roman="${roman}"
      operator="${xmlEscape(rawName)}"
      hash="0x${hash}"
      date="${displayDate}"
      standard="ERC-721 Sovereign Asset"
    />
  </metadata>
</svg>`;
}

/**
 * Converts template image URL into base64 Data URL so downloaded SVG files work completely offline.
 */
export async function getCertificateDataUri(grade: number): Promise<string> {
  const url = getCertificateUrl(grade);
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Could not inline template image as Data URI:", err);
    return url;
  }
}

/**
 * Triggers direct browser download of the standalone Certificate SVG (with inlined base64 artwork).
 */
export async function downloadCertificateSvg(cert: CertificateData, formattedDate?: string): Promise<void> {
  const gradeNum = Math.max(1, Math.min(5, cert.level));
  const dataUri = await getCertificateDataUri(gradeNum);
  const svg = generateCertificateSvg(cert, formattedDate, dataUri);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const hash = computeCertHash(cert);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Certificato_NFT_Grado_${gradeNum}_${hash}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Triggers high-res PNG download (renders background artwork + vector gold text + QR code onto Canvas at 2x or 3x scale).
 */
export async function downloadCertificatePng(
  cert: CertificateData,
  formattedDate?: string,
  scale: number = 2,
): Promise<void> {
  const gradeNum = Math.max(1, Math.min(5, cert.level));
  const layout = getCertificateLayout(gradeNum);
  const hash = computeCertHash(cert);

  const rawName = (cert.userName && cert.userName.trim()) || "OPERATORE";
  const withBrackets = cert.showBrackets !== false;
  const displayName = withBrackets ? `[ ${rawName.toUpperCase()} ]` : rawName.toUpperCase();

  const displayDate = (
    cert.customDate?.trim() ||
    formattedDate ||
    new Date(cert.awardedAt || Date.now()).toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  ).toUpperCase();

  const defaultQrUrl = `https://limen.trade/verify/nft/${gradeNum}/${hash}`;
  const qrTarget = cert.customQrCode?.trim() || defaultQrUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        const w = 764 * scale;
        const h = 1024 * scale;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Impossibile inizializzare il contesto Canvas 2D");
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // 1. Draw Master Certificate Background Artwork
        ctx.drawImage(img, 0, 0, w, h);

        // 2. Draw Operator Name
        const nameLen = displayName.length;
        const baseFontSize = nameLen > 30 ? 20 : nameLen > 24 ? 24 : nameLen > 18 ? 28 : 32;
        const scaledFontSize = baseFontSize * scale;
        const nameY = layout.nameY * scale;
        const nameX = 382 * scale;

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${scaledFontSize}px 'Cinzel', Georgia, 'Times New Roman', serif`;

        // Gold linear gradient
        const goldGrad = ctx.createLinearGradient(0, nameY - 18 * scale, 0, nameY + 18 * scale);
        goldGrad.addColorStop(0, "#FFF8D6");
        goldGrad.addColorStop(0.3, "#F2D188");
        goldGrad.addColorStop(0.65, "#C59B48");
        goldGrad.addColorStop(1, "#7A561D");

        ctx.shadowColor = "rgba(0, 0, 0, 0.95)";
        ctx.shadowOffsetX = 1 * scale;
        ctx.shadowOffsetY = 2.5 * scale;
        ctx.shadowBlur = 3 * scale;

        ctx.fillStyle = goldGrad;
        ctx.fillText(displayName, nameX, nameY);

        // 3. Draw Date & Underline
        ctx.shadowColor = "transparent";
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.font = `bold ${11 * scale}px ui-monospace, SFMono-Regular, monospace`;
        ctx.fillStyle = "#A88948";
        ctx.fillText(`DATA: ${displayDate}`, layout.dateX * scale, layout.dateY * scale);

        ctx.strokeStyle = "#5A4725";
        ctx.lineWidth = 1.2 * scale;
        ctx.beginPath();
        ctx.moveTo(layout.dateX * scale, (layout.dateY + 7) * scale);
        ctx.lineTo(layout.underlineEnd * scale, (layout.dateY + 7) * scale);
        ctx.stroke();

        // 4. Draw Scannable Gold QR Code
        const qrDataUrl = await QRCode.toDataURL(qrTarget, {
          margin: 1,
          color: {
            dark: "#E5C178",
            light: "#08090D",
          },
          width: Math.round(layout.qrSize * scale),
        });

        const qrImg = new Image();
        qrImg.onload = () => {
          // QR background border
          ctx.fillStyle = "#08090D";
          ctx.strokeStyle = "#3A2D17";
          ctx.lineWidth = 0.8 * scale;
          const qrX = layout.qrX * scale;
          const qrY = layout.qrY * scale;
          const qrS = layout.qrSize * scale;

          ctx.fillRect(qrX - 2 * scale, qrY - 2 * scale, qrS + 4 * scale, qrS + 4 * scale);
          ctx.strokeRect(qrX - 2 * scale, qrY - 2 * scale, qrS + 4 * scale, qrS + 4 * scale);
          ctx.drawImage(qrImg, qrX, qrY, qrS, qrS);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Errore generazione blob PNG"));
                return;
              }
              const pngUrl = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = pngUrl;
              a.download = `Certificato_NFT_Grado_${gradeNum}_${hash}.png`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(pngUrl);
              resolve();
            },
            "image/png",
            1.0,
          );
        };
        qrImg.onerror = () => reject(new Error("Errore caricamento immagine QR code"));
        qrImg.src = qrDataUrl;
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error(`Errore caricamento template certificato grado ${gradeNum}`));
    };

    img.src = getCertificateUrl(gradeNum);
  });
}

/**
 * Triggers dedicated high-res print dialog for the Certificate.
 */
export function printCertificate(cert: CertificateData, formattedDate?: string): void {
  const gradeNum = Math.max(1, Math.min(5, cert.level));
  const svgString = generateCertificateSvg(cert, formattedDate);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Certificato NFT Grado ${gradeNum} - LIMEN PROTOCOL</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #060709;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          svg {
            max-width: 100vw;
            max-height: 100vh;
            width: auto;
            height: 98vh;
            display: block;
            box-shadow: 0 0 30px rgba(0,0,0,0.8);
          }
        </style>
      </head>
      <body>
        ${svgString}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
