import { useState, useEffect, useRef } from "react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useUpdateUserSettings, getGetUserSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
  const { selectedPairs, setSelectedPairs, settingsLoaded } = useBackground();
  const [show, setShow] = useState(false);
  const confirmedRef = useRef(false);
  const updateMutation = useUpdateUserSettings();
  const qc = useQueryClient();

  useEffect(() => {
    if (settingsLoaded && selectedPairs.length === 0 && !confirmedRef.current) {
      setShow(true);
    } else if (selectedPairs.length > 0) {
      setShow(false);
    }
  }, [settingsLoaded, selectedPairs.length]);

  const handleConfirm = async (pairs: string[]) => {
    if (pairs.length === 0) return;
    confirmedRef.current = true;
    setSelectedPairs(pairs);
    setShow(false);
    onSettingsModeClose?.();
    try {
      await updateMutation.mutateAsync({ data: { selectedPairs: pairs } });
      qc.invalidateQueries({ queryKey: getGetUserSettingsQueryKey() });
    } catch (err) {
      console.error("Failed to save selected pairs:", err);
    }
  };

  // Settings mode: re-open as a dismissible modal from Settings page
  if (settingsMode) {
    return (
      <PairSelectionModal
        open={settingsModeOpen}
        onConfirm={handleConfirm}
        initialPairs={selectedPairs}
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
      onConfirm={handleConfirm}
    />
  );
}
