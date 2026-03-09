import path from "node:path";
import { createTwoFilesPatch } from "diff";
import { readTextFile, resolveFromCwd, writeTextFile } from "../utils/fs.js";
import type { UpdaterPlan, UpdaterConfig } from "../types.js";

/**
 * Planned diff output for preview.
 */
export interface PlannedDiff {
  filePath: string;
  previousContent: string;
  nextContent: string;
  diff: string;
}

/**
 * Builds regexes for paths this updater is allowed to mutate.
 */
function buildAllowedPathMatchers(config: UpdaterConfig): RegExp[] {
  const readmeMatcher = /^README\.md$/;
  const integrationTsMatcher = /^src\/integrations\/[^/]+\/[^/]+\.ts$/;
  const methodsMatchers = config.integrations.map((integration) => {
    const normalized = integration.methodsFile.replace(/\\/g, "/").replace(/^\.\//, "");
    return new RegExp(`^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
  });
  return [readmeMatcher, integrationTsMatcher, ...methodsMatchers];
}

/**
 * Returns true if path is in the updater allowlist.
 */
function isAllowedTargetPath(filePath: string, config: UpdaterConfig): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\//, "");
  return buildAllowedPathMatchers(config).some((matcher) => matcher.test(normalized));
}

/**
 * Computes git-style diffs for files included in a plan.
 */
export async function planDiffs(plan: UpdaterPlan, config: UpdaterConfig): Promise<PlannedDiff[]> {
  const entries = Object.entries(plan.files);
  const diffs: PlannedDiff[] = [];

  for (const [relativePath, nextContent] of entries) {
    if (!isAllowedTargetPath(relativePath, config)) {
      continue;
    }

    const absPath = resolveFromCwd(relativePath);
    const previousContent = (await readTextFile(absPath)) ?? "";
    const diff = createTwoFilesPatch(relativePath, relativePath, previousContent, nextContent, "before", "after");
    diffs.push({
      filePath: relativePath,
      previousContent,
      nextContent,
      diff
    });
  }

  return diffs;
}

/**
 * Applies planned file contents to disk.
 */
export async function applyPlanFiles(diffs: PlannedDiff[]): Promise<void> {
  for (const item of diffs) {
    await writeTextFile(resolveFromCwd(item.filePath), item.nextContent);
  }
}

/**
 * Ensures methods file is consistent with plan.updatedMethods array.
 */
export async function syncMethodsFile(plan: UpdaterPlan, methodsFile: string): Promise<void> {
  const absPath = resolveFromCwd(methodsFile);
  const methodsPayload = JSON.stringify(plan.updatedMethods, null, 2) + "\n";
  const methodsPath = methodsFile.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!Object.prototype.hasOwnProperty.call(plan.files, methodsPath)) {
    await writeTextFile(absPath, methodsPayload);
  }
}

/**
 * Returns concise one-line diff stats for artifacts.
 */
export function summarizeDiffs(diffs: PlannedDiff[]): Array<{ filePath: string; added: number; removed: number }> {
  return diffs.map((item) => {
    const lines = item.diff.split("\n");
    const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
    const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
    return {
      filePath: item.filePath,
      added,
      removed
    };
  });
}

/**
 * Produces default file path for integration README update table.
 */
export function integrationReadmePath(integrationName: string): string {
  return path.join("src", "integrations", integrationName, "README.md").replace(/\\/g, "/");
}
