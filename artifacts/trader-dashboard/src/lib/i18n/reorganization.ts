import type { Language } from "../i18n";
import { reorganizationCore } from "./reorganizationCore";
import { REORGANIZATION_JOURNAL } from "./reorganizationJournal";
import { reorganizationArchive } from "./reorganizationArchive";
import { marketIntelligenceDictionary } from "./marketIntelligence";
import { toolCatalogDictionary } from "./toolCatalog";
import { guidedWorkspaceDictionary } from "./guidedWorkspace";
import { cockpitDictionary } from "./cockpit";

export function reorganizationDictionary(language: Language): Record<string, string> {
  return {
    ...reorganizationCore[language],
    ...REORGANIZATION_JOURNAL[language],
    ...reorganizationArchive[language],
    ...marketIntelligenceDictionary(language),
    ...guidedWorkspaceDictionary(language),
    ...toolCatalogDictionary(language),
    ...cockpitDictionary(language),
  };
}
