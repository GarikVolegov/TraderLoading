import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUPPORTED_LANGUAGES } from "./lib/i18n";
import { DICT } from "./lib/i18n/all";

const files = [
  "lib/i18n/dict.it.ts",
  "pages/News.tsx",
  "components/MacroNewsTicker.tsx",
  "components/VolatilityWidget.tsx",
  "components/CotWidget.tsx",
  "components/broker-hub/BrokerHubWidget.tsx",
  "components/broker-hub/BrokerHubWorkspace.tsx",
];

const forbiddenVisibleCopy = [
  "Perplexity",
  "RSS Feed",
  "Yahoo Finance",
  "Fonte: Yahoo",
  "CFTC ·",
  "Groq",
  "Benzinga",
  "Finnhub",
  "Polygon",
  "providerStatuses.map",
  "status.provider",
  "Fonte principale",
  "Analisi AI Agent",
  "Â·",
];

for (const file of files) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const forbidden of forbiddenVisibleCopy) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${file} should not expose visible provider/debug copy: ${forbidden}`,
    );
  }
}

const i18nSource = readFileSync(new URL("lib/i18n/dict.it.ts", import.meta.url), "utf8");
for (const key of ["news.source.ai", "news.source.rss", "news.source.updated"]) {
  assert.match(i18nSource, new RegExp(`"${key}"`), `Missing copy key ${key}`);
}

const italianKeys = new Set(Object.keys(DICT.it));
for (const lang of SUPPORTED_LANGUAGES.filter((code) => code !== "it")) {
  const keys = new Set(Object.keys(DICT[lang]));
  const missing = [...italianKeys].filter((key) => !keys.has(key));
  assert.deepEqual(missing, [], `${lang} should include every Italian i18n key`);
}

const usedTranslationKeys: string[] = [];
function collectTranslationKeys(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTranslationKeys(absolutePath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.(test|static\.test)\./.test(entry.name)) continue;
    const source = readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
      usedTranslationKeys.push(match[1]);
    }
  }
}

collectTranslationKeys(fileURLToPath(new URL(".", import.meta.url)));
const missingUsedKeys = [...new Set(usedTranslationKeys)].filter((key) => !italianKeys.has(key));
assert.deepEqual(missingUsedKeys, [], "Every literal t() key should exist in DICT");

const newsSource = readFileSync(new URL("pages/News.tsx", import.meta.url), "utf8");
// "Apri articolo" is now routed through i18n (auto.ui.ee8a13250e) rather than
// a literal — assert the key + its Italian translation instead of the literal.
assert.match(newsSource, /auto\.ui\.ee8a13250e/);
assert.match(i18nSource, /"auto\.ui\.ee8a13250e":\s*"Apri articolo"/);
assert.doesNotMatch(newsSource, /Sito fonte/);

const localizedSurfaceNeedles: Record<string, string[]> = {
  "components/BillingSubscriptionPanel.tsx": [
    "Abbonamento",
    "Piano Pro, rinnovo",
    "Verifico stato abbonamento",
    "Annulla rinnovo",
    "Riattiva abbonamento",
    "Apri fattura Stripe",
  ],
  "components/admin/AdminShell.tsx": [
    "Admin Console",
    "Admin navigation",
    "Ruolo:",
    "verifica in corso",
    "Torna all'app",
  ],
  "components/account-bridge/AccountBridgeWorkspace.tsx": [
    "Conto reale MT5 attivo",
    "Demo adapter attivo",
    "Collega conto FP Trading",
    "Sicurezza conto reale",
    "Nessun conto collegato",
    "Ticket ordine",
    "Posizioni aperte",
  ],
  "components/BackgroundPresetsManager.tsx": [
    "Sfondi Personalizzati",
    "Limite di 6 sfondi",
    "Sfondo aggiunto",
    "Aggiungi sfondo",
    "Massimo 6 sfondi",
  ],
};

for (const [file, needles] of Object.entries(localizedSurfaceNeedles)) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const needle of needles) {
    assert.equal(
      source.includes(needle),
      false,
      `${file} should route visible copy through i18n, found hardcoded copy: ${needle}`,
    );
  }
}

const legacyHardcodedCopyFiles = new Set<string>([
  "components/PwaUpdateNotificationBanner.tsx",
  "components/academy/MentorDoctrineViewer.tsx",
  "components/milestones/DoctrineExamModal.tsx",
  "components/financial/PropFirmCalculatorModal.tsx",
  "components/financial/WealthAssetCard.tsx",
  "components/routine/EmotionQuizStep.tsx",
  "components/routine/ProgramCard.tsx",
  "components/routine/RoutineStatsPanel.tsx",
  "components/backtest-tournament/ArenaSpectatorShareModal.tsx",
  "components/backtest-tournament/LiveComparativeEquityChart.tsx",
  "components/backtest-terminal/BacktestAiSentinelPanel.tsx",
  "components/backtest-terminal/ChartAppearanceSettings.tsx",
  "components/backtest-terminal/CloudTemplateManager.tsx",
  "components/backtest-terminal/ColorControl.tsx",
  "components/backtest-terminal/DrawingPropertiesModal.tsx",
  "components/backtest-terminal/DrawingsOverlay.tsx",
  "components/backtest-terminal/TerminalHeader.tsx",
  "components/backtest-terminal/TerminalSettingsDialog.tsx",
  "components/backtest-terminal/ToolKnowledgeDrawer.tsx",
  "components/backtest-terminal/ToolRail.tsx",
  "components/backtest-terminal/TransportBar.tsx",
  "components/chart/LimenAiSetupOverlay.tsx",
  "components/chart/LimenChartHeader.tsx",
  "components/chart/LimenChartToolbar.tsx",
  "components/chart/LimenProprietaryChart.tsx",
  "components/cockpit/CockpitAiSentinelCard.tsx",
  "components/social/ConversationsWorkspace.tsx",
  "components/tornei/ArenaView.tsx",
  "pages/Tornei.tsx",
  "components/admin/AdminApplicationsPage.tsx",
  "components/admin/AdminSecurityPage.tsx",
  "components/admin/AdminSystemPage.tsx",
  "components/admin/AdminTradingPage.tsx",
  "components/admin/AdminUserDetailPage.tsx",
  "components/TopNav.tsx",
  "components/BottomNav.tsx",
  "components/account-bridge/AccountBridgeWorkspace.tsx",
  "components/cockpit/CockpitChartPrefsDialog.tsx",
  "components/cockpit/CockpitExamplesDialog.tsx",
  "components/cockpit/CockpitFavoriteTools.tsx",
  "components/cockpit/CockpitGuidanceBox.tsx",
  "components/cockpit/CockpitNewsDialog.tsx",
  "components/cockpit/CockpitNextSessionPlanner.tsx",
  "components/cockpit/CockpitOperativePlanDialog.tsx",
  "components/cockpit/CockpitSchematicLightbox.tsx",
  "components/cockpit/CockpitTradeRegisterModal.tsx",
  "components/cockpit/CockpitUserPlaybookDialog.tsx",
  "components/cockpit/CockpitVisualChoice.tsx",
  "components/JournalEntryModal.tsx",
  "components/journal/JournalGadgets.tsx",
  "components/journal/SessionDetailInspector.tsx",
  "components/journal/SessionJournal.tsx",
  "components/journal/SovereignJournalCockpit.tsx",
  "components/journal/UnifiedTradeLedgerTrajectory.tsx",
  "components/journal/EquityCurveChart.tsx",
  "components/journal/SovereignChronosHeatmap.tsx",
  "components/journal/DisciplineVirtueRadar.tsx",
  "components/journal/DisciplineVirtueRadarModal.tsx",
  "components/chart/ChartObjectTreeModal.tsx",
  "components/chart/LimenCompanionChartPane.tsx",
  "components/journal/DisciplineBioTensionChart.tsx",
  "components/journal/DisciplineBioTensionModal.tsx",
  "components/daily-order/DailyOrderMethodConsole.tsx",
  "components/daily-order/DailyOrderPulseHeader.tsx",
  "components/daily-order/DailyOrderStageCard.tsx",
  "components/financial/FinancialArchitectureBanner.tsx",
  "components/financial/MonteCarloSimulationCard.tsx",
  "components/financial/PillarsAllocationBar.tsx",
  "components/financial/PillarsDonutChart.tsx",
  "components/financial/TaxDoctrineModal.tsx",
  "components/milestones/LimenCertificateModal.tsx",
  "components/onboarding/ThresholdOfSelectionModal.tsx",
  "components/process/ProcessNextAction.tsx",
  "components/settings/ReferralSettingsSection.tsx",
  "components/settings/AccountDeletionSection.tsx",
  "components/settings/AccountExportSection.tsx",
  "components/settings/ChecklistSettings.tsx",
  "components/settings/PinSettings.tsx",
  "components/settings/SoundFxSettings.tsx",
  "components/settings/SmartWatchSettingsSection.tsx",
  "components/biometrics/SmartWatchConnectModal.tsx",
  "components/social/CreatePostModal.tsx",
  "components/social/CreateChannelModal.tsx",
  "components/social/VoiceChannelView.tsx",
  "components/social/MediaLightboxModal.tsx",
  "components/social/MessaggiTab.tsx",
  "components/social/PostCard.tsx",
  "components/social/PublicProfileLeftFlank.tsx",
  "components/social/PublicProfilesShowcaseFlank.tsx",
  "components/social/SocialTab.tsx",
  "components/social/SundayCouncilBanner.tsx",
  "components/social/UserProfileModal.tsx",
  "components/social/ClassificaTab.tsx",
  "components/stealth/GatekeepingModal.tsx",
  "components/stealth/GeneralCodexLibro1.tsx",
  "components/stealth/GeneralsCodex.tsx",
  "components/stealth/GeneralsCodexLibro2.tsx",
  "components/stealth/PartnerDashboard.tsx",
  "components/stealth/RoyaltyCalculator.tsx",
  "components/stealth/SandboxAcademy.tsx",
  "components/stealth/StealthVideoPlayer.tsx",
  // Reviewed Italian-only launch: training is explicitly labelled as Italian.
  "components/academy/AcademyVideoUpload.tsx",
  "components/academy/GeneralsBooksReader.tsx",
  "components/candidacy/LimenCandidacyModal.tsx",
  "components/candidacy/LimenServiceLockGate.tsx",
  "components/CommandPalette.tsx",
  "components/chart/LimenSentinelChartGadget.tsx",
  "components/decompression/BullRunnerGame.tsx",
  "components/decompression/DecompressionChamberModal.tsx",
  "components/decompression/MarketBreakerGame.tsx",
  "components/decompression/RiskTableGame.tsx",
  "components/decompression/chronicles/ChroniclesHub.tsx",
  "components/decompression/chronicles/ChroniclesSkillTreeModal.tsx",
  "components/decompression/chronicles/TacticalExpeditionGame.tsx",
  "components/decompression/fluidArchitect/FluidArchitectGame.tsx",
  "components/decompression/tacticalChess/TacticalChessGame.tsx",
  "components/decompression/tacticalCockpit/TacticalCockpitGame.tsx",
  "components/financial/InstrumentDossierModal.tsx",
  "components/financial/WealthProjectionChart.tsx",
  "pages/DecompressionPage.tsx",
  "components/landing/SchoolRequestForm.tsx",
  "components/admin/AdminSchoolRequestsPage.tsx",
  "pages/Academy.tsx",
  "pages/FinancialArchitecture.tsx",
  "pages/LandingPage.tsx",
  "pages/Milestones.tsx",
  "pages/OperatingDashboard.tsx",
  "pages/ProtocolloPage.tsx",
  "pages/TradingCockpit.tsx",
  "pages/Backtest.tsx",
  "pages/Journal.tsx",
  "pages/Settings.tsx",
  "components/ProfileWidget.tsx",
  "components/backtest-terminal/ReplayEquityCurve.tsx",
  "components/backtest-tournament/BacktestBattlesDrawer.tsx",
  "components/backtest-tournament/BacktestTournamentHub.tsx",
  "components/backtest-tournament/BacktestVictoryModal.tsx",
  "components/backtest-tournament/Forgia3DArena.tsx",
  "components/backtest-tournament/ForgiaEmbersOverlay.tsx",
  "components/backtest-tournament/BattleRoomLobbyModal.tsx",
  "components/backtest-tournament/CustomLobbyModal.tsx",
  "components/backtest-tournament/TribePresetsManager.tsx",
  "components/backtest-tournament/LiveBattleTelemetryHUD.tsx",
  "components/backtest-tournament/BattleInviteModal.tsx",
  "components/AuthPageShell.tsx",
  "components/cockpit/CockpitIntegritySentinelBar.tsx",
  "components/academy/SovereignVideoWatermark.tsx",
  "components/milestones/MasteryRadarChart.tsx",
  "components/journal/DisciplineVirtueRadar.tsx",
  "components/journal/DisciplineVirtueRadarModal.tsx",
  "components/chart/ChartObjectTreeModal.tsx",
  "components/chart/LimenCompanionChartPane.tsx",
  "components/journal/DisciplineBioTensionChart.tsx",
  "components/journal/DisciplineBioTensionModal.tsx",
  "components/honor-card/HonorCardShareModal.tsx",
  "components/notary/NotaryScrollModal.tsx",
  "components/journal/IntegrityConfessorModal.tsx",
  "pages/NicknameOnboarding.tsx",
  "pages/PublicNotaryVerification.tsx",
  "pages/PublicArenaSpectatorPage.tsx",
  "components/backtest-tournament/LiveComparativeEquityChart.tsx",
  "components/backtest-tournament/ArenaSpectatorShareModal.tsx",
  "components/backtest-terminal/ReplayBioTelemetryHUD.tsx",
  "components/backtest-terminal/ReplayBiometricVignetteOverlay.tsx",
  "components/backtest-terminal/OrderTicket.tsx",
  "components/DirectionalOutlookPanel.tsx",
  "components/cockpit/TacticalBreathModal.tsx",
  "components/journal/CardioPerformanceAnalyticsModal.tsx",
  "components/backtest-terminal/OfflineStorageModal.tsx",
  "components/ContextMarketDetail.tsx",
  "components/backtest-terminal/BacktestTerminal.tsx",
  "components/backtest-terminal/ChartAlertsOverlay.tsx",
  "components/backtest-terminal/FavoriteToolsBar.tsx",
  "components/cockpit/QuantitativeSynthesisDialog.tsx",
]);

const visibleTextPattern = /(?<![=!<>])>\s*([^<>{}`\n]*[A-Za-zÀ-ÿ][^<>{}`\n]*)\s*<(?=[/A-Za-z])/;
const visibleAttributePattern = /(aria-label|placeholder|title)="([^"]*[A-Za-zÀ-ÿ][^"]*)"/;
const visibleMessagePattern = /(toast\(|confirm\(|setMessage\(|setLocalMessage\(|new Notification\()[^"\n]*["']([^"']*[A-Za-zÀ-ÿ][^"']*)["']/;

function isAllowedVisibleLiteral(value: string): boolean {
  const normalized = value.trim();
  const technicalTerms = new Set([
    "Account",
    "Balance",
    "BE",
    "B/E",
    "Broker",
    "CLR",
    "Demo",
    "ENTRY",
    "Entry",
    "Equity",
    "Exit",
    "FX Blue",
    "FX Blue Account Sync",
    "Live",
    "AUREUS",
    "AUREUS PROTOCOL",
    "LIMEN",
    "LIMEN PROTOCOL",
    "MT4",
    "MT5",
    "P&L",
    "P&L $",
    "R:R",
    "SL",
    "STOP LOSS",
    "Stop Loss",
    "TP",
    "TAKE PROFIT",
    "Take Profit",
    "Trade",
    "0 ?",
    "userLevel &&",
    "Win Rate",
    "XP",
    "Indice",
  ]);
  return (
    normalized === ""
    || normalized === "TraderLoadings"
    || normalized === "TraderLoading"
    || normalized === "AUREUS"
    || normalized === "AUREUS PROTOCOL"
    || normalized === "LIMEN"
    || normalized === "LIMEN PROTOCOL"
    || technicalTerms.has(normalized)
    || normalized.includes("terminal64.exe")
  );
}

function hasUntranslatedVisibleCopy(source: string, file: string): boolean {
  return source.split(/\r?\n/).some((line) => {
    if (/=>|Promise<|ReturnType<|Dispatch<|SetStateAction<|interface |type /.test(line)) {
      return false;
    }

    if (file.endsWith(".tsx")) {
      const textMatch = line.match(visibleTextPattern);
      if (textMatch && !isAllowedVisibleLiteral(textMatch[1])) return true;

      const attrMatch = line.match(visibleAttributePattern);
      if (attrMatch && !isAllowedVisibleLiteral(attrMatch[2])) return true;
    }

    const messageMatch = line.match(visibleMessagePattern);
    if (messageMatch && !line.includes("t(") && !isAllowedVisibleLiteral(messageMatch[2])) return true;

    return false;
  });
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(absolutePath);
  }
  return out;
}

const copyScanRoot = fileURLToPath(new URL(".", import.meta.url));
const copyScanFiles = ["components", "pages", "contexts", "lib"]
  .flatMap((dir) => collectSourceFiles(join(copyScanRoot, dir)))
  .filter((file) => !/[/\\]components[/\\]ui[/\\]/.test(file))
  .filter((file) => !/\.(test|static\.test)\./.test(file))
  .filter((file) => !/(^|[/\\])i18n\.ts$/.test(file))
  .filter((file) => !/[/\\]i18n[/\\]dict\.[a-z]+\.ts$/.test(file))
  .filter((file) => !/[/\\]i18n[/\\]all\.ts$/.test(file))
  .filter((file) => !/(^|[/\\])production-copy\.static\.test\.ts$/.test(file));

const newHardcodedCopyFiles = copyScanFiles
  .filter((file) => {
    const source = readFileSync(file, "utf8");
    return hasUntranslatedVisibleCopy(source, file);
  })
  .map((file) => file.replace(copyScanRoot, "").replace(/\\/g, "/"))
  .filter((file) => !legacyHardcodedCopyFiles.has(file))
  .sort();

assert.deepEqual(
  newHardcodedCopyFiles,
  [],
  "New UI/client files with visible hardcoded copy must use i18n or be explicitly reviewed in the legacy baseline",
);

console.log("production copy static checks passed");
