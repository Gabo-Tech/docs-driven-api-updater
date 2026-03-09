import path from "node:path";
import { readTextFile } from "./fs.js";
import { updaterConfigSchema } from "../updater/schemas.js";
import type { IntegrationConfig, UpdaterConfig } from "../types.js";

/**
 * Default config filename used by the updater.
 */
export const UPDATER_CONFIG_FILE = "updater.config.json";

/**
 * Loads and validates updater.config.json from current working directory.
 */
export async function loadUpdaterConfig(cwd = process.cwd()): Promise<UpdaterConfig> {
  const configPath = path.resolve(cwd, UPDATER_CONFIG_FILE);
  const raw = await readTextFile(configPath);
  if (!raw) {
    throw new Error(`Missing ${UPDATER_CONFIG_FILE}. Run "docs-driven-api-updater init" first.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${UPDATER_CONFIG_FILE}.`);
  }

  return updaterConfigSchema.parse(parsed);
}

/**
 * Gets an integration by name and throws if not found.
 */
export function getIntegrationByName(config: UpdaterConfig, name: string): IntegrationConfig {
  const integration = config.integrations.find((item) => item.name === name);
  if (!integration) {
    throw new Error(`Integration "${name}" not found in updater.config.json.`);
  }
  return integration;
}
