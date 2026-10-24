import { LimenCandidacyModal } from "@/components/candidacy/LimenCandidacyModal";
import type { LimenBillingCycle, LimenTierId } from "../../../../../contracts/limenServices";

interface GatekeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReason?: string;
  defaultBillingCycle?: LimenBillingCycle;
  defaultTierId?: LimenTierId;
}

/**
 * GatekeepingModal: Portale di candidatura e configurazione della Dotazione d'Ordine LIMEN.
 */
export function GatekeepingModal({
  isOpen,
  onClose,
  defaultBillingCycle,
  defaultTierId,
}: GatekeepingModalProps) {
  return (
    <LimenCandidacyModal
      isOpen={isOpen}
      onClose={onClose}
      defaultBillingCycle={defaultBillingCycle}
      defaultTierId={defaultTierId}
    />
  );
}
