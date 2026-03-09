import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import ora from "ora";
import { loadUpdaterConfig } from "../../utils/config.js";
import { readTextFile, resolveFromCwd, writeTextFile } from "../../utils/fs.js";
import { logger } from "../../utils/logger.js";
import { crawlAllDocs } from "../../updater/docCrawler.js";
import { askOllamaForPatchPlan } from "../../updater/ollama.js";
import { applyPlanFiles, planDiffs, summarizeDiffs, type PlannedDiff } from "../../updater/patcher.js";
import type { IntegrationDocsBundle, UpdateCommandOptions, UpdaterPlan } from "../../types.js";

/**
 * LLM output safety validation result.
 */
interface SafetyValidationResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Detects suspicious LLM plans before writing to disk.
 */
export function validateUpdaterPlanSafety(plan: UpdaterPlan, diffs: PlannedDiff[]): SafetyValidationResult {
  const reasons: string[] = [];
  const placeholderPattern = /(TODO|FIXME|your_api_key|your api key|<placeholder>|TBD)/i;
  const destructiveClassPattern = /class\s+\w+\s*\{[\s\S]*\}/m;

  for (const diff of diffs) {
    if (placeholderPattern.test(diff.nextContent)) {
      reasons.push(`Placeholder-like content detected in ${diff.filePath}`);
    }

    const prevLen = diff.previousContent.length;
    const nextLen = diff.nextContent.length;
    if (prevLen > 400 && nextLen < prevLen * 0.35) {
      reasons.push(`Abnormal file shrink detected in ${diff.filePath} (${prevLen} -> ${nextLen} chars)`);
    }

    const hadClass = destructiveClassPattern.test(diff.previousContent);
    const hasClass = destructiveClassPattern.test(diff.nextContent);
    if (hadClass && !hasClass && prevLen > 300) {
      reasons.push(`Potential destructive class rewrite in ${diff.filePath}`);
    }
  }

  if (!plan.updatedMethods.length) {
    reasons.push("Plan removed all supported methods.");
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Merges readme table into README markers when model omitted README.md output.
 */
async function mergedReadmeContent(readmeTable: string): Promise<string> {
  const current = (await readTextFile(resolveFromCwd("README.md"))) ?? "";
  const start = "<!-- AUTO-GENERATED-METHODS-TABLE:START -->";
  const end = "<!-- AUTO-GENERATED-METHODS-TABLE:END -->";
  const block = `${start}\n${readmeTable.trim()}\n${end}`;

  let next: string;
  if (current.includes(start) && current.includes(end)) {
    next = current.replace(new RegExp(`${start}[\\s\\S]*?${end}`, "m"), block);
  } else {
    next = `${current.trimEnd()}\n\n## Updated Methods Snapshot\n\n${block}\n`;
  }
  return next;
}

/**
 * Writes CI artifacts for review and PR text generation.
 */
async function writeArtifacts(
  planByIntegration: Record<string, UpdaterPlan>,
  diffSummary: Array<{ filePath: string; added: number; removed: number }>
): Promise<void> {
  const artifactsDir = resolveFromCwd(".artifacts");
  await fs.mkdir(artifactsDir, { recursive: true });
  await writeTextFile(path.join(artifactsDir, "update-plan.json"), JSON.stringify(planByIntegration, null, 2) + "\n");
  await writeTextFile(path.join(artifactsDir, "update-diff-summary.json"), JSON.stringify(diffSummary, null, 2) + "\n");

  const title = "chore: docs-driven API compatibility update";
  const body = [
    "## Summary",
    "- Automated docs-driven updater run completed.",
    "- Generated patches for supported integrations.",
    "",
    "## Diff stats",
    ...diffSummary.map((row) => `- \`${row.filePath}\`: +${row.added} / -${row.removed}`),
    "",
    "## Validation",
    "- [x] safety gate passed",
    "- [x] diff preview generated"
  ].join("\n");

  await writeTextFile(path.join(artifactsDir, "pr-title.txt"), `${title}\n`);
  await writeTextFile(path.join(artifactsDir, "pr-body.md"), `${body}\n`);
}

/**
 * Pretty-prints diffs to stdout.
 */
function printDiffPreview(diffs: PlannedDiff[]): void {
  for (const diff of diffs) {
    logger.info(`\n--- ${diff.filePath} ---`);
    console.log(diff.diff);
  }
}

/**
 * Requests interactive confirmation for applying changes.
 */
async function askForConfirmation(): Promise<boolean> {
  const rl = createInterface({ input, output });
  const answer = await rl.question("Apply these updates? (y/N): ");
  rl.close();
  return ["y", "yes"].includes(answer.trim().toLowerCase());
}

/**
 * Generates a single integration plan using crawled docs + current methods list.
 */
async function generateIntegrationPlan(
  docsBundle: IntegrationDocsBundle,
  methodsFile: string,
  options: UpdateCommandOptions
): Promise<UpdaterPlan> {
  const methodsContent = (await readTextFile(resolveFromCwd(methodsFile))) ?? "[]";
  const fallbackModels = options.fallbackModels?.split(",").map((item) => item.trim()).filter(Boolean);
  const maxModelAttempts = options.maxModelAttempts ? Number(options.maxModelAttempts) : undefined;
  const result = await askOllamaForPatchPlan({
    integrationName: docsBundle.integrationName,
    docsBundle,
    currentMethodsJson: methodsContent,
    fallbackModels,
    maxModelAttempts
  });
  logger.dim(
    `Planner attempts (${docsBundle.integrationName}): ${result.attempts
      .map((a) => `${a.model}:${a.ok ? "ok" : "fail"}`)
      .join(", ")}`
  );
  return result.plan;
}

/**
 * Runs docs-driven update pipeline end-to-end.
 */
export async function runUpdateCommand(options: UpdateCommandOptions): Promise<void> {
  const loadSpinner = ora("Loading updater config...").start();
  const config = await loadUpdaterConfig();
  loadSpinner.succeed(`Loaded ${config.integrations.length} integration(s).`);

  const crawlSpinner = ora("Crawling documentation pages...").start();
  const crawledDocs = await crawlAllDocs(config);
  crawlSpinner.succeed("Documentation crawl complete.");

  const planSpinner = ora("Generating LLM patch plans...").start();
  const planByIntegration: Record<string, UpdaterPlan> = {};
  for (const integration of config.integrations) {
    const bundle = crawledDocs.find((item) => item.integrationName === integration.name);
    if (!bundle) {
      throw new Error(`Missing crawled docs bundle for integration ${integration.name}.`);
    }
    const plan = await generateIntegrationPlan(bundle, integration.methodsFile, options);
    const methodsPath = integration.methodsFile.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!Object.prototype.hasOwnProperty.call(plan.files, methodsPath)) {
      plan.files[methodsPath] = `${JSON.stringify(plan.updatedMethods, null, 2)}\n`;
    }
    if (!Object.prototype.hasOwnProperty.call(plan.files, "README.md") && plan.readmeTable.trim()) {
      plan.files["README.md"] = await mergedReadmeContent(plan.readmeTable);
    }
    planByIntegration[integration.name] = plan;
  }
  planSpinner.succeed("Patch plan generation complete.");

  const allDiffs: PlannedDiff[] = [];
  for (const integration of config.integrations) {
    const plan = planByIntegration[integration.name];
    const diffs = await planDiffs(plan, config);
    allDiffs.push(...diffs);
  }

  const safetyFailures: string[] = [];
  for (const integration of config.integrations) {
    const plan = planByIntegration[integration.name];
    const integrationDiffs = allDiffs.filter(
      (diff) =>
        diff.filePath === "README.md" ||
        diff.filePath === integration.methodsFile.replace(/\\/g, "/").replace(/^\.\//, "") ||
        diff.filePath.startsWith(`${integration.targetDir.replace(/\\/g, "/").replace(/^\.\//, "")}/`)
    );
    const safety = validateUpdaterPlanSafety(plan, integrationDiffs);
    if (!safety.ok) {
      safetyFailures.push(`[${integration.name}] ${safety.reasons.join("; ")}`);
    }
  }
  if (safetyFailures.length) {
    throw new Error(`Safety validation rejected update plan:\n- ${safetyFailures.join("\n- ")}`);
  }

  const summary = summarizeDiffs(allDiffs);
  printDiffPreview(allDiffs);
  await writeArtifacts(planByIntegration, summary);

  if (options.dryRun) {
    logger.info("Dry run complete. No files were written.");
    return;
  }

  if (!options.yes && !options.ci) {
    const confirmed = await askForConfirmation();
    if (!confirmed) {
      logger.warn("Update cancelled by user.");
      return;
    }
  }

  const applySpinner = ora("Applying updates to files...").start();
  await applyPlanFiles(allDiffs);
  applySpinner.succeed(`Applied updates to ${allDiffs.length} file(s).`);

  const rebuildSpinner = ora("Rebuilding package...").start();
  execSync("npm run build", { stdio: "ignore" });
  rebuildSpinner.succeed("Build completed.");

  if (options.ci && options.openPr) {
    logger.info(
      'CI mode enabled with --open-pr. Use ".artifacts/pr-title.txt" and ".artifacts/pr-body.md" in your PR step.'
    );
  }
}
