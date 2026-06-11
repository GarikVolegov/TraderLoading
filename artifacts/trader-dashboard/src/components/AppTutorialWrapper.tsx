import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetUserSettingsQueryKey,
  useGetUserSettings,
  useUpdateUserSettings,
} from "@workspace/api-client-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { AppTutorialWizard } from "@/components/AppTutorialWizard";

export function AppTutorialWrapper() {
  const { selectedPairs, settingsLoaded } = useBackground();
  const { data: settings } = useGetUserSettings();
  const updateSettings = useUpdateUserSettings();
  const queryClient = useQueryClient();
  const completedThisSessionRef = useRef(false);

  const shouldShow =
    settingsLoaded &&
    selectedPairs.length > 0 &&
    !settings?.onboardingTutorialCompletedAt &&
    !completedThisSessionRef.current;

  const completeTutorial = async () => {
    if (completedThisSessionRef.current) return;
    completedThisSessionRef.current = true;
    try {
      await updateSettings.mutateAsync({
        data: { onboardingTutorialCompletedAt: new Date().toISOString() },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetUserSettingsQueryKey(),
      });
    } catch (error) {
      console.error("Failed to save app tutorial completion:", error);
    }
  };

  return (
    <AppTutorialWizard
      open={shouldShow}
      onSkip={() => {
        void completeTutorial();
      }}
      onFinish={() => {
        void completeTutorial();
      }}
    />
  );
}
