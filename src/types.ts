/**
 * Integration configuration entry loaded from updater.config.json.
 */
export interface IntegrationConfig {
  name: string;
  docUrls: string[];
  methodsFile: string;
  targetDir: string;
}

/**
 * Root configuration file format.
 */
export interface UpdaterConfig {
  integrations: IntegrationConfig[];
}

/**
 * Parsed normalized docs content for one URL.
 */
export interface CrawledDocPage {
  url: string;
  title: string;
  normalizedText: string;
  tableRows: string[];
}

/**
 * Crawl output grouped by integration.
 */
export interface IntegrationDocsBundle {
  integrationName: string;
  pages: CrawledDocPage[];
}

/**
 * Structured change item returned by the LLM.
 */
export interface PlanChangeItem {
  type: "breaking" | "new" | "deprecated" | "fixed" | "note";
  message: string;
  affectedFiles?: string[];
}

/**
 * Whole update plan produced by the LLM.
 */
export interface UpdaterPlan {
  summary: string;
  updatedMethods: string[];
  changes: PlanChangeItem[];
  files: Record<string, string>;
  readmeTable: string;
}

/**
 * Update command options parsed from CLI.
 */
export interface UpdateCommandOptions {
  ci?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  openPr?: boolean;
  fallbackModels?: string;
  maxModelAttempts?: string;
}

/**
 * Sanitized provider response metadata used for diagnostics.
 */
export interface ProviderAttemptResult {
  provider: "openrouter" | "ollama";
  model: string;
  ok: boolean;
  statusCode?: number;
  errorMessage?: string;
}
