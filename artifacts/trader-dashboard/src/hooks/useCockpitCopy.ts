import { cockpitLabelKey } from "@/lib/i18n/cockpit";
import { useLanguage } from "@/contexts/LanguageContext";
export function useCockpitCopy() {
  const { t } = useLanguage();
  return (key: string) => t(cockpitLabelKey(key));
}
