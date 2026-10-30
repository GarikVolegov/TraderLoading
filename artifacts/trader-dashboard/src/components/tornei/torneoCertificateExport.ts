import QRCode from "qrcode";
import type { CertTier } from "./NftCertificate";
import { CERT_IMAGES } from "./NftCertificate";

export interface TorneoCertificateExportOptions {
  tier: CertTier;
  userName: string;
  seasonLabel?: string;
  certId?: number | string;
  verifyUrl?: string;
}

const TIER_COLORS: Record<CertTier, { text: string; glow: string; qrDark: string; qrLight: string }> = {
  champion: {
    text: "#F5D78A",
    glow: "rgba(230, 190, 90, 0.75)",
    qrDark: "#E6BE5A",
    qrLight: "#0B0D12",
  },
  podio: {
    text: "#E5E9F0",
    glow: "rgba(215, 222, 235, 0.75)",
    qrDark: "#D8DFEB",
    qrLight: "#0B0D12",
  },
  finisher: {
    text: "#E6A26E",
    glow: "rgba(218, 145, 90, 0.75)",
    qrDark: "#CD7F32",
    qrLight: "#0B0D12",
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

/**
 * Renderizza l'attestato ufficiale Limen su un Canvas 1024x1024
 * sovrapponendo in modo perfetto il nome utente e un QR code scansionabile funzionante.
 */
export async function renderTorneoCertificateToCanvas(
  options: TorneoCertificateExportOptions,
): Promise<HTMLCanvasElement> {
  const { tier, userName, certId, verifyUrl } = options;
  const colors = TIER_COLORS[tier] ?? TIER_COLORS.finisher;
  const imageSrc = CERT_IMAGES[tier] ?? CERT_IMAGES.finisher;

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossibile inizializzare il contesto Canvas 2D");

  // 1. Disegna l'immagine master di sfondo
  const baseImg = await loadImage(imageSrc);
  ctx.drawImage(baseImg, 0, 0, 1024, 1024);

  // 2. Copertura impeccabile dell'area "[ NOME UTENTE ]"
  const cleanName = (userName?.trim() || "OPERATORE AUREUS").toUpperCase();
  const bgGrad = ctx.createLinearGradient(200, 368, 824, 368);
  bgGrad.addColorStop(0, "rgba(12, 14, 18, 0)");
  bgGrad.addColorStop(0.12, "rgba(14, 17, 23, 0.96)");
  bgGrad.addColorStop(0.5, "rgba(15, 18, 25, 0.98)");
  bgGrad.addColorStop(0.88, "rgba(14, 17, 23, 0.96)");
  bgGrad.addColorStop(1, "rgba(12, 14, 18, 0)");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(200, 344, 624, 48);

  // 3. Stampa nobiliare del nome dell'operatore con ombra metallica
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fontSize = cleanName.length > 24 ? 18 : cleanName.length > 16 ? 22 : 28;
  ctx.font = `700 ${fontSize}px "Cinzel", "Cinzel Decorative", "Trajan Pro", "Times New Roman", Georgia, serif`;
  ctx.fillStyle = colors.text;
  ctx.shadowColor = colors.glow;
  ctx.shadowBlur = 14;

  ctx.fillText(cleanName, 512, 368);
  ctx.restore();

  // 4. Generazione e posizionamento del QR Code scansionabile e funzionante
  const origin = typeof window !== "undefined" ? window.location.origin : "https://aureus-os.app";
  const targetVerifyUrl =
    verifyUrl ||
    (certId ? `${origin}/tornei?cert=${certId}` : `${origin}/tornei`);

  const qrDataUrl = await QRCode.toDataURL(targetVerifyUrl, {
    margin: 1,
    color: { dark: colors.qrDark, light: colors.qrLight },
    width: 256,
  });
  const qrImg = await loadImage(qrDataUrl);

  // Copre il QR finto del template master con la base nera marmorea
  ctx.fillStyle = "#0B0D12";
  ctx.fillRect(174, 736, 134, 134);
  // Disegna il QR Code reale attivo e leggibile dagli smartphone
  ctx.drawImage(qrImg, 180, 742, 122, 122);

  return canvas;
}

/**
 * Genera il Data URL (PNG) per anteprima live rapida.
 */
export async function generateTorneoCertificateDataUrl(
  options: TorneoCertificateExportOptions,
): Promise<string> {
  const canvas = await renderTorneoCertificateToCanvas(options);
  return canvas.toDataURL("image/png");
}

/**
 * Scarica l'attestato master personalizzato in formato PNG HD a 1024x1024 pixel.
 */
export async function downloadTorneoCertificate(
  options: TorneoCertificateExportOptions,
): Promise<void> {
  const canvas = await renderTorneoCertificateToCanvas(options);
  return new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Errore generazione Blob PNG"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const cleanName = (options.userName || "Operatore").replace(/[^a-zA-Z0-9_-]/g, "_");
      const a = document.createElement("a");
      a.href = url;
      a.download = `AUREUS_Attestato_${options.tier.toUpperCase()}_${cleanName}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}
