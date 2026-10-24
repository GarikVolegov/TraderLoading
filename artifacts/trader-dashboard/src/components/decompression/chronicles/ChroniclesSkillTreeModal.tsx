import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SKILL_UPGRADE_TIERS,
  loadChroniclesPersistence,
  saveChroniclesPersistence,
} from "./chroniclesCampaignData";
import { spendMasterAurei, loadMasterVault } from "../unifiedArcadeStore";
import { type BullRunnerSkills } from "./chroniclesTypes";
import {
  Shield,
  Zap,
  Coins,
  Sparkles,
  Lock,
  CheckCircle2,
  Hourglass,
  Palette,
} from "lucide-react";

interface ChroniclesSkillTreeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSkillsUpdated: (skills: BullRunnerSkills, newWallet: number) => void;
}

export function ChroniclesSkillTreeModal({
  open,
  onOpenChange,
  onSkillsUpdated,
}: ChroniclesSkillTreeModalProps) {
  const [saveData, setSaveData] = useState(() => loadChroniclesPersistence());

  useEffect(() => {
    if (open) {
      setSaveData(loadChroniclesPersistence());
    }
  }, [open]);

  const masterAurei = loadMasterVault().masterAurei;

  const handleUpgradeMagnet = (targetLevel: number, cost: number) => {
    if (masterAurei < cost) return;
    const spendRes = spendMasterAurei(cost);
    if (!spendRes.success) return;

    const nextSkills = {
      ...saveData.bullSkills,
      magnetismLevel: targetLevel,
    };
    const updated = saveChroniclesPersistence({
      bullSkills: nextSkills,
      totalAureiWallet: spendRes.newBalance,
    });
    setSaveData(updated);
    onSkillsUpdated(updated.bullSkills, updated.totalAureiWallet);
  };

  const handleUnlockShield = (cost: number) => {
    if (masterAurei < cost) return;
    const spendRes = spendMasterAurei(cost);
    if (!spendRes.success) return;

    const nextSkills = {
      ...saveData.bullSkills,
      shieldCharges: 2,
    };
    const updated = saveChroniclesPersistence({
      bullSkills: nextSkills,
      totalAureiWallet: spendRes.newBalance,
    });
    setSaveData(updated);
    onSkillsUpdated(updated.bullSkills, updated.totalAureiWallet);
  };

  const handleUnlockBulletTime = (cost: number) => {
    if (masterAurei < cost) return;
    const spendRes = spendMasterAurei(cost);
    if (!spendRes.success) return;

    const nextSkills = {
      ...saveData.bullSkills,
      bulletTimeEnabled: true,
    };
    const updated = saveChroniclesPersistence({
      bullSkills: nextSkills,
      totalAureiWallet: spendRes.newBalance,
    });
    setSaveData(updated);
    onSkillsUpdated(updated.bullSkills, updated.totalAureiWallet);
  };

  const handleSelectSkin = (skinId: "gold" | "obsidian" | "emerald", cost: number) => {
    if (skinId !== "gold" && saveData.bullSkills.activeSkin !== skinId && cost > 0) {
      if (masterAurei < cost) return;
      const spendRes = spendMasterAurei(cost);
      if (!spendRes.success) return;

      const nextSkills = {
        ...saveData.bullSkills,
        activeSkin: skinId,
      };
      const updated = saveChroniclesPersistence({
        bullSkills: nextSkills,
        totalAureiWallet: spendRes.newBalance,
      });
      setSaveData(updated);
      onSkillsUpdated(updated.bullSkills, updated.totalAureiWallet);
      return;
    }

    const nextSkills = {
      ...saveData.bullSkills,
      activeSkin: skinId,
    };
    const updated = saveChroniclesPersistence({
      bullSkills: nextSkills,
    });
    setSaveData(updated);
    onSkillsUpdated(updated.bullSkills, updated.totalAureiWallet);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#07080b] border border-[#C5A059]/30 max-w-2xl text-foreground p-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="px-5 py-4 bg-[#0d0f14] border-b border-[#C5A059]/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 flex items-center justify-center text-[#E8C56A]">
              <Sparkles size={16} />
            </div>
            <div>
              <DialogTitle className="text-sm font-mono font-bold text-foreground">
                ARSENALE & COMPETENZE DEL TORO
              </DialogTitle>
              <p className="text-[11px] font-mono text-muted-foreground">
                Investi gli Aurei conquistati nei capitoli per potenziare la tua corsa.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-[#C5A059]/40 text-xs font-mono text-[#E8C56A]">
            <Coins size={14} />
            <span className="font-bold tabular-nums whitespace-nowrap">
              {masterAurei} Aurei
            </span>
          </div>
        </div>

        {/* Upgrade Branches */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-xs font-mono">
          {/* Branch 1: Magnetismo */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground font-bold">
                <Zap size={14} className="text-[#E8C56A]" />
                <span>Magnetismo Istituzionale</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Livello Attuale: <strong className="text-[#E8C56A]">{saveData.bullSkills.magnetismLevel}/3</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SKILL_UPGRADE_TIERS.magnetism.map((tier) => {
                const isUnlocked = saveData.bullSkills.magnetismLevel >= tier.level;
                const canBuy =
                  saveData.bullSkills.magnetismLevel === tier.level - 1 &&
                  masterAurei >= tier.cost;

                return (
                  <button
                    key={tier.level}
                    type="button"
                    disabled={isUnlocked || !canBuy}
                    onClick={() => handleUpgradeMagnet(tier.level, tier.cost)}
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                      isUnlocked
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : canBuy
                        ? "bg-[#C5A059]/10 border-[#C5A059]/50 hover:bg-[#C5A059]/20 text-[#E8C56A] cursor-pointer"
                        : "bg-black/20 border-white/5 text-muted-foreground/50 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span>{tier.label}</span>
                        {isUnlocked && <CheckCircle2 size={12} />}
                      </div>
                      <p className="text-[9.5px] mt-1 text-muted-foreground leading-tight">
                        {tier.desc}
                      </p>
                    </div>
                    {!isUnlocked && (
                      <div className="mt-2 text-[10px] font-bold flex items-center gap-1 text-[#E8C56A]">
                        <Coins size={11} /> {tier.cost} Aurei
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Branch 2: Corazza di Titanio & Bullet Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Corazza */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-foreground font-bold mb-1">
                  <Shield size={14} className="text-[#E8C56A]" />
                  <span>{SKILL_UPGRADE_TIERS.shield.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {SKILL_UPGRADE_TIERS.shield.desc}
                </p>
              </div>

              <div className="mt-3">
                {saveData.bullSkills.shieldCharges === 2 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 size={13} /> Sbloccato (2 Cariche)
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={masterAurei < SKILL_UPGRADE_TIERS.shield.cost}
                    onClick={() => handleUnlockShield(SKILL_UPGRADE_TIERS.shield.cost)}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#C5A059] text-black font-bold text-xs hover:bg-[#d8b167] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Coins size={12} />
                    <span>Sblocca ({SKILL_UPGRADE_TIERS.shield.cost} Aurei)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bullet Time */}
            <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-foreground font-bold mb-1">
                  <Hourglass size={14} className="text-cyan-400" />
                  <span>{SKILL_UPGRADE_TIERS.bulletTime.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  {SKILL_UPGRADE_TIERS.bulletTime.desc}
                </p>
              </div>

              <div className="mt-3">
                {saveData.bullSkills.bulletTimeEnabled ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                    <CheckCircle2 size={13} /> Sbloccato
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={masterAurei < SKILL_UPGRADE_TIERS.bulletTime.cost}
                    onClick={() => handleUnlockBulletTime(SKILL_UPGRADE_TIERS.bulletTime.cost)}
                    className="w-full py-1.5 px-3 rounded-lg bg-cyan-600 text-white font-bold text-xs hover:bg-cyan-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Coins size={12} />
                    <span>Sblocca ({SKILL_UPGRADE_TIERS.bulletTime.cost} Aurei)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Branch 3: Pelli Sovrane del Toro */}
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2 text-foreground font-bold">
              <Palette size={14} className="text-[#E8C56A]" />
              <span>Vesti Sovrane del Toro (Skin 3D)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SKILL_UPGRADE_TIERS.skins.map((skin) => {
                const isActive = saveData.bullSkills.activeSkin === skin.id;

                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() =>
                      handleSelectSkin(
                        skin.id as "gold" | "obsidian" | "emerald",
                        isActive ? 0 : skin.cost,
                      )
                    }
                    className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                      isActive
                        ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.2)]"
                        : "bg-black/30 border-white/10 hover:border-white/20 text-muted-foreground hover:text-foreground cursor-pointer"
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-bold flex items-center justify-between">
                        <span>{skin.label}</span>
                        {isActive && <CheckCircle2 size={12} className="text-[#E8C56A]" />}
                      </div>
                      <p className="text-[9.5px] mt-1 text-muted-foreground leading-tight">
                        {skin.desc}
                      </p>
                    </div>
                    {!isActive && skin.cost > 0 && (
                      <div className="mt-2 text-[10px] font-bold flex items-center gap-1 text-[#E8C56A]">
                        <Coins size={11} /> {skin.cost} Aurei
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
