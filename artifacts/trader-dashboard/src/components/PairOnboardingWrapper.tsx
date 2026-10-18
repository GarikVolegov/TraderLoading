import { useState, useEffect, useRef } from "react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useSavePairs } from "@/hooks/useSavePairs";
import { PairOnboardingScreen } from "./PairOnboardingScreen";
import { PairSelectionModal } from "./PairSelectionModal";

interface PairOnboardingWrapperProps {
  /** When true, uses the full-screen onboarding (used from Settings to re-open as modal) */
  settingsMode?: boolean;
  settingsModeOpen?: boolean;
  onSettingsModeClose?: () => void;
}

export function PairOnboardingWrapper({
  settingsMode = false,
  settingsModeOpen = false,
  onSettingsModeClose,
}: PairOnboardingWrapperProps = {}) {
  const { selectedPairs, settingsLoaded } = useBackground();
  const [show, setShow] = useState(false);
  const confirmedRef = useRef(false);
  const { save, saving, failed } = useSavePairs();

  useEffect(() => {
    if (settingsLoaded && selectedPairs.length === 0 && !confirmedRef.current) {
      setShow(true);
    } else if (selectedPairs.length > 0) {
      setShow(false);
    }
  }, [settingsLoaded, selectedPairs.length]);

  const handleConfirm = async (pairs: string[]) => {
    if (!(await save(pairs))) return;
    confirmedRef.current = true;
    setShow(false);
    onSettingsModeClose?.();
  };

  // Settings mode: re-open as a dismissible modal from Settings page
  if (settingsMode) {
    return (
      <PairSelectionModal
        open={settingsModeOpen}
        onConfirm={handleConfirm}
        initialPairs={selectedPairs}
        saving={saving}
        failed={failed}
        dismissible
        onClose={onSettingsModeClose}
      />
    );
  }

  // Onboarding mode: full-screen experience for new users
  if (!show) return null;

  return (
    <PairOnboardingScreen
      initialPairs={selectedPairs}
      saving={saving}
      failed={failed}
      onConfirm={handleConfirm}
    />
  );
}
