export { crawlAllDocs } from "./updater/docCrawler.js";
export { askOllamaForPatchPlan } from "./updater/ollama.js";
export { applyPlanFiles, planDiffs, summarizeDiffs, syncMethodsFile } from "./updater/patcher.js";
export { runInitCommand } from "./cli/commands/init.js";
export { runUpdateCommand, validateUpdaterPlanSafety } from "./cli/commands/update.js";
export type {
  CrawledDocPage,
  IntegrationConfig,
  IntegrationDocsBundle,
  PlanChangeItem,
  ProviderAttemptResult,
  UpdateCommandOptions,
  UpdaterConfig,
  UpdaterPlan
} from "./types.js";
