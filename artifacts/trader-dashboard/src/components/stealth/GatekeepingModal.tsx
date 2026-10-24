import { LimenCandidacyModal } from "@/components/candidacy/LimenCandidacyModal";

interface GatekeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReason?: string;
}

/**
 * GatekeepingModal: Portale di candidatura e configurazione della Dotazione d'Ordine LIMEN.
 */
export function GatekeepingModal({ isOpen, onClose }: GatekeepingModalProps) {
  return <LimenCandidacyModal isOpen={isOpen} onClose={onClose} />;
}
