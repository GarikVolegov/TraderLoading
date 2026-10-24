import { reportClientError } from "@/lib/clientErrorReporter";

export type BackgroundDevice = "desktop" | "mobile";

export interface BackgroundPreset {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
  device: BackgroundDevice;
}

export const MAX_CUSTOM_PER_DEVICE = 2;

export const DEFAULT_BACKGROUNDS_DESKTOP: BackgroundPreset[] = [
  { id: "nero-ossidiana", name: "Nero Ossidiana", url: "/images/backgrounds/desktop/nero-ossidiana.webp", isDefault: true, device: "desktop" },
  { id: "ordo-geometrico", name: "Ordo Geometrico", url: "/images/backgrounds/desktop/ordo-geometrico.webp", isDefault: true, device: "desktop" },
  { id: "aureus-noir", name: "Aureus Noir", url: "/images/backgrounds/desktop/aureus-noir.webp", isDefault: true, device: "desktop" },
  { id: "cyber-matrix", name: "Cyber Matrix", url: "/images/backgrounds/desktop/cyber-matrix.webp", isDefault: true, device: "desktop" },
  { id: "nocturne-city", name: "Financial Nocturne", url: "/images/backgrounds/desktop/nocturne-city.webp", isDefault: true, device: "desktop" },
  { id: "pietra-antracite", name: "Pietra Antracite", url: "/images/backgrounds/desktop/pietra-antracite.webp", isDefault: true, device: "desktop" },
];

export const DEFAULT_BACKGROUNDS_MOBILE: BackgroundPreset[] = [
  { id: "nero-ossidiana", name: "Nero Ossidiana", url: "/images/backgrounds/mobile/nero-ossidiana.webp", isDefault: true, device: "mobile" },
  { id: "ordo-geometrico", name: "Ordo Geometrico", url: "/images/backgrounds/mobile/ordo-geometrico.webp", isDefault: true, device: "mobile" },
  { id: "aureus-noir", name: "Aureus Noir", url: "/images/backgrounds/mobile/aureus-noir.webp", isDefault: true, device: "mobile" },
  { id: "cyber-matrix", name: "Cyber Matrix", url: "/images/backgrounds/mobile/cyber-matrix.webp", isDefault: true, device: "mobile" },
  { id: "nocturne-city", name: "Financial Nocturne", url: "/images/backgrounds/mobile/nocturne-city.webp", isDefault: true, device: "mobile" },
  { id: "pietra-antracite", name: "Pietra Antracite", url: "/images/backgrounds/mobile/pietra-antracite.webp", isDefault: true, device: "mobile" },
];

const LEGACY_KEY = "tl_background_presets";
const customKey = (device: BackgroundDevice) => `tl_background_presets_${device}`;

export function defaultsForDevice(device: BackgroundDevice): BackgroundPreset[] {
  return device === "mobile" ? DEFAULT_BACKGROUNDS_MOBILE : DEFAULT_BACKGROUNDS_DESKTOP;
}

export function pickActiveBackgroundUrl(args: {
  isMobile: boolean;
  desktopUrl: string | null;
  mobileUrl: string | null;
}): string | null {
  return args.isMobile ? args.mobileUrl : args.desktopUrl;
}

function customsForDevice(device: BackgroundDevice, customs: BackgroundPreset[]): BackgroundPreset[] {
  return customs.filter((c) => c.device === device).slice(0, MAX_CUSTOM_PER_DEVICE);
}

export function resolveDeviceCatalog(device: BackgroundDevice, customs: BackgroundPreset[]): BackgroundPreset[] {
  return [...defaultsForDevice(device), ...customsForDevice(device, customs)];
}

export function canAddCustom(device: BackgroundDevice, customs: BackgroundPreset[]): boolean {
  return customs.filter((c) => c.device === device).length < MAX_CUSTOM_PER_DEVICE;
}

export function loadCustomBackgrounds(device: BackgroundDevice): BackgroundPreset[] {
  try {
    const raw = localStorage.getItem(customKey(device));
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      return (parsed as BackgroundPreset[]).map((p) => ({ ...p, device, isDefault: false }));
    }
  } catch (error) {
    reportClientError(error, { context: "custom backgrounds load", notify: false });
  }
  return [];
}

export function saveCustomBackgrounds(device: BackgroundDevice, list: BackgroundPreset[]): void {
  localStorage.setItem(customKey(device), JSON.stringify(list));
}

export function migrateLegacyCustomBackgrounds(): void {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const customs = (parsed as Array<{ id: string; name: string; url: string; isDefault?: boolean }>)
        .filter((p) => !p.isDefault)
        .map((p) => ({ id: p.id, name: p.name, url: p.url, isDefault: false, device: "mobile" as const }))
        .slice(0, MAX_CUSTOM_PER_DEVICE);
      if (customs.length > 0) saveCustomBackgrounds("mobile", customs);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch (error) {
    reportClientError(error, { context: "legacy backgrounds migrate", notify: false });
  }
}
