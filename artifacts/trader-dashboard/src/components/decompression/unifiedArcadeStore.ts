/**
 * LIMEN PROTOCOL — Master Arcade Store & Unified Aurei Vault
 * Centralized persistence for Aurei wallet, detachment seconds, audio mute state,
 * and cross-game progression across all 5 3D decompression experiences.
 */

const MASTER_VAULT_KEY = "limen_master_aurei_vault_v1";
const AUDIO_MUTE_KEY = "limen_game_audio_enabled";

export interface MasterArcadeState {
  masterAurei: number;
  audioEnabled: boolean;
}

export function loadMasterVault(): MasterArcadeState {
  if (typeof window === "undefined") {
    return { masterAurei: 25, audioEnabled: true };
  }

  try {
    const rawAurei = localStorage.getItem(MASTER_VAULT_KEY);
    const rawAudio = localStorage.getItem(AUDIO_MUTE_KEY);

    // Initial seed if not present: check legacy wallets
    let initialAurei = 25;
    if (rawAurei !== null) {
      initialAurei = Math.max(0, parseInt(rawAurei, 10) || 0);
    } else {
      // Check if chronicles has wallet
      try {
        const chron = localStorage.getItem("limen_chronicles_persistence_v1");
        if (chron) {
          const parsed = JSON.parse(chron);
          if (parsed.totalAureiWallet) initialAurei = Math.max(initialAurei, parsed.totalAureiWallet);
        }
      } catch {}
      localStorage.setItem(MASTER_VAULT_KEY, initialAurei.toString());
    }

    const audioEnabled = rawAudio !== null ? rawAudio === "1" : true;

    return { masterAurei: initialAurei, audioEnabled };
  } catch {
    return { masterAurei: 25, audioEnabled: true };
  }
}

export function addMasterAurei(amount: number): number {
  if (typeof window === "undefined") return amount;
  try {
    const current = loadMasterVault().masterAurei;
    const updated = Math.max(0, current + amount);
    localStorage.setItem(MASTER_VAULT_KEY, updated.toString());

    // Also update legacy chronicles key for backward compatibility
    syncLegacyAurei(updated);

    return updated;
  } catch {
    return amount;
  }
}

export function spendMasterAurei(amount: number): { success: boolean; newBalance: number } {
  if (typeof window === "undefined") return { success: true, newBalance: 0 };
  try {
    const current = loadMasterVault().masterAurei;
    if (current < amount) return { success: false, newBalance: current };

    const updated = current - amount;
    localStorage.setItem(MASTER_VAULT_KEY, updated.toString());
    syncLegacyAurei(updated);

    return { success: true, newBalance: updated };
  } catch {
    return { success: false, newBalance: 0 };
  }
}

function syncLegacyAurei(newBalance: number) {
  try {
    // 1. Chronicles persistence
    const chronRaw = localStorage.getItem("limen_chronicles_persistence_v1");
    if (chronRaw) {
      const parsed = JSON.parse(chronRaw);
      parsed.totalAureiWallet = newBalance;
      localStorage.setItem("limen_chronicles_persistence_v1", JSON.stringify(parsed));
    }

    // 2. Risk table persistence
    const riskRaw = localStorage.getItem("limen_risk_table_save_v1");
    if (riskRaw) {
      const parsed = JSON.parse(riskRaw);
      parsed.totalAurei = newBalance;
      localStorage.setItem("limen_risk_table_save_v1", JSON.stringify(parsed));
    }
  } catch {}
}
