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
  { id: "nyc-skyline", name: "NYC Skyline", url: "/images/backgrounds/desktop/nyc-skyline.webp", isDefault: true, device: "desktop" },
  { id: "dubai-skyline", name: "Dubai", url: "/images/backgrounds/desktop/dubai-skyline.webp", isDefault: true, device: "desktop" },
  { id: "molten-gold", name: "Molten Gold", url: "/images/backgrounds/desktop/molten-gold.webp", isDefault: true, device: "desktop" },
  { id: "jade-wave", name: "Jade Wave", url: "/images/backgrounds/desktop/jade-wave.webp", isDefault: true, device: "desktop" },
  { id: "mountain-dawn", name: "Mountain Dawn", url: "/images/backgrounds/desktop/mountain-dawn.webp", isDefault: true, device: "desktop" },
  { id: "luxury-watch", name: "Luxury", url: "/images/backgrounds/desktop/luxury-watch.webp", isDefault: true, device: "desktop" },
];

export const DEFAULT_BACKGROUNDS_MOBILE: BackgroundPreset[] = [
  { id: "singapore-marina", name: "Singapore", url: "/images/backgrounds/mobile/singapore-marina.webp", isDefault: true, device: "mobile" },
  { id: "hongkong-towers", name: "Hong Kong", url: "/images/backgrounds/mobile/hongkong-towers.webp", isDefault: true, device: "mobile" },
  { id: "jade-gradient", name: "Jade", url: "/images/backgrounds/mobile/jade-gradient.webp", isDefault: true, device: "mobile" },
  { id: "gold-bokeh", name: "Gold", url: "/images/backgrounds/mobile/gold-bokeh.webp", isDefault: true, device: "mobile" },
  { id: "forest-path", name: "Forest", url: "/images/backgrounds/mobile/forest-path.webp", isDefault: true, device: "mobile" },
  { id: "ocean-calm", name: "Ocean", url: "/images/backgrounds/mobile/ocean-calm.webp", isDefault: true, device: "mobile" },
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
