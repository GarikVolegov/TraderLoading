import {
  type CampaignChapter,
  type BullRunnerSkills,
  type ChroniclesPersistence,
} from "./chroniclesTypes";

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [
  {
    id: 1,
    title: "Capitolo I · L'Agonia dell'Accumulazione",
    subtitle: "Sopravvivi alla compressione e raccogli il capitale iniziale",
    lorePreamble:
      "Il mercato è chiuso in un corridoio asfittico. I manipolatori cercano di farti perdere la pazienza prima dell'impulso. Non anticipare: raccogli il capitale ed esci indenne dalla congestione.",
    doctrineQuote: "La pazienza nell'ombra è la virtù che separa l'Iniziato dalla vittima.",
    targetMeters: 450,
    targetAurei: 35,
    rewardAurei: 100,
    accentColor: "#C5A059",
  },
  {
    id: 2,
    title: "Capitolo II · Il Canyon degli Stop-Hunt",
    subtitle: "Schiva gli spike predatori dei market maker",
    lorePreamble:
      "I market maker scatenano raffiche di candele a spillo sui pool di liquidità. I trader deboli saltano uno dopo l'altro. Il Toro dell'Ordine avanza imperterrito con salti chirurgici.",
    doctrineQuote: "Ciò che la massa scambia per breakout è solo una trappola per la fretta.",
    targetMeters: 650,
    targetSpikesAvoided: 12,
    rewardAurei: 150,
    accentColor: "#ef4444",
  },
  {
    id: 3,
    title: "Capitolo III · La Tempesta dei Tassi",
    subtitle: "Attraversa l'alta volatilità macroeconomica senza soccombere",
    lorePreamble:
      "Rilascio dei dati sull'inflazione e tassi delle banche centrali. La pista trema, la velocità raddoppia e la vista si annebbia. Mantieni la calma e assorbi le sfere di liquidità verde.",
    doctrineQuote: "Chi governa la propria mente durante la tempesta eredita il regno.",
    targetMeters: 800,
    rewardAurei: 220,
    accentColor: "#10b981",
  },
  {
    id: 4,
    title: "Capitolo IV · Il Titano dell'Orso (Boss Fight)",
    subtitle: "Affronta il colosso ribassista e infrangi la pressione di vendita",
    lorePreamble:
      "Un gigantesco Titano dell'Orso corazzato sbarra la via del Toro. Lancia massi di vendita istituzionale e barriere di crollo. Raccogli le Sfere di Breakout e scagliale contro il Titano per aprirti il passaggio!",
    doctrineQuote: "Non c'è orso che possa resistere alla convergenza della disciplina assoluta.",
    targetMeters: 1000,
    isBossChapter: true,
    bossName: "Il Titano dell'Orso Corazzato",
    bossMaxHp: 6, // 6 Breakout Orbs needed to defeat him
    rewardAurei: 350,
    accentColor: "#8b5cf6",
  },
  {
    id: 5,
    title: "Capitolo V · Il Trionfo dell'Eredità",
    subtitle: "Raggiungi il Varco Dorato e consacra il tuo Indice di Integrità",
    lorePreamble:
      "Hai resistito a tutte le trappole mentali ed emotive del mercato. Ora corri verso il Varco Dorato dell'Architetto. La posizione a mercato è protetta, la tua mente è sovrana.",
    doctrineQuote: "Il trading non è indovinare il domani, ma incarnare l'Ordine oggi.",
    targetMeters: 900,
    rewardAurei: 500,
    accentColor: "#E8C56A",
  },
];

export const SKILL_UPGRADE_TIERS = {
  magnetism: [
    { level: 1, cost: 80, label: "Magnete Istituzionale I", desc: "Attira Aurei entro 1.5 corsie" },
    { level: 2, cost: 180, label: "Magnete Istituzionale II", desc: "Attira Aurei e Liquidità da tutte le corsie" },
    { level: 3, cost: 320, label: "Magnete Sovrano", desc: "Attrazione a lungo raggio + 10% valore monete" },
  ],
  shield: {
    cost: 200,
    label: "Corazza di Titanio",
    desc: "Lo scudo aureo assorbe 2 collisioni invece di 1 sola",
  },
  bulletTime: {
    cost: 250,
    label: "Riflesso di Gann (Bullet Time)",
    desc: "In prossimità di spuntoni e barriere critiche, il tempo rallenta per 0.4s",
  },
  skins: [
    { id: "gold", cost: 0, label: "Toro Aureus (Standard)", desc: "Oro regale con riflessi imperiali" },
    { id: "obsidian", cost: 150, label: "Toro Cyber-Ossidiana", desc: "Nero opaco con corna neon ciano e occhi viola" },
    { id: "emerald", cost: 300, label: "Toro di Giada Sovrana", desc: "Cristallo verde smeraldo con corna d'oro massiccio" },
  ],
};

const CHRONICLES_KEY = "limen_chronicles_save_v2";

export function loadChroniclesPersistence(): ChroniclesPersistence {
  if (typeof window === "undefined") {
    return defaultPersistence();
  }
  try {
    const raw = localStorage.getItem(CHRONICLES_KEY);
    if (!raw) return defaultPersistence();
    const parsed = JSON.parse(raw);
    return {
      unlockedChapter: Math.max(1, Math.min(5, Number(parsed.unlockedChapter) || 1)),
      completedChapters: Array.isArray(parsed.completedChapters) ? parsed.completedChapters : [],
      bullSkills: {
        magnetismLevel: Math.max(0, Math.min(3, Number(parsed.bullSkills?.magnetismLevel) || 0)),
        shieldCharges: Number(parsed.bullSkills?.shieldCharges) === 2 ? 2 : 1,
        bulletTimeEnabled: Boolean(parsed.bullSkills?.bulletTimeEnabled),
        activeSkin: ["gold", "obsidian", "emerald"].includes(parsed.bullSkills?.activeSkin)
          ? parsed.bullSkills.activeSkin
          : "gold",
      },
      totalAureiWallet: Math.max(0, Number(parsed.totalAureiWallet) || 120), // 120 starting gift
      bestExpeditionSector: Math.max(1, Number(parsed.bestExpeditionSector) || 1),
      totalExpeditionsWon: Math.max(0, Number(parsed.totalExpeditionsWon) || 0),
      totalDetachmentSeconds: Math.max(0, Number(parsed.totalDetachmentSeconds) || 0),
    };
  } catch {
    return defaultPersistence();
  }
}

export function saveChroniclesPersistence(data: Partial<ChroniclesPersistence>): ChroniclesPersistence {
  const current = loadChroniclesPersistence();
  const updated: ChroniclesPersistence = {
    ...current,
    ...data,
    bullSkills: {
      ...current.bullSkills,
      ...(data.bullSkills || {}),
    },
  };
  try {
    localStorage.setItem(CHRONICLES_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

function defaultPersistence(): ChroniclesPersistence {
  return {
    unlockedChapter: 1,
    completedChapters: [],
    bullSkills: {
      magnetismLevel: 0,
      shieldCharges: 1,
      bulletTimeEnabled: false,
      activeSkin: "gold",
    },
    totalAureiWallet: 120,
    bestExpeditionSector: 1,
    totalExpeditionsWon: 0,
    totalDetachmentSeconds: 0,
  };
}
