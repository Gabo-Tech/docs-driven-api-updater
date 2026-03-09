#!/usr/bin/env node
import { Command } from "commander";
import { loadEnv } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { runInitCommand } from "./commands/init.js";
import { runUpdateCommand } from "./commands/update.js";

loadEnv();

const program = new Command();

program
  .name("docs-driven-api-updater")
  .description("Docs-driven universal API integration updater")
  .version("1.0.0");

program
  .command("init")
  .description("Create updater.config.json and .env.example")
  .action(async () => {
    try {
      await runInitCommand();
    } catch (error) {
      logger.error(error instanceof Error ? error.message : "Init command failed.");
      process.exitCode = 1;
    }
  });

program
  .command("update")
  .description("Run docs-driven update pipeline")
  .option("--ci", "Run in CI mode")
  .option("--yes", "Skip prompts and auto-confirm")
  .option("--dry-run", "Preview changes without writing files")
  .option("--open-pr", "Generate PR artifacts in CI mode")
  .option("--fallback-models <models>", "Comma-separated fallback models")
  .option("--max-model-attempts <n>", "Maximum model attempts")
  .action(async (options) => {
    try {
      await runUpdateCommand(options);
    } catch (error) {
      logger.error(error instanceof Error ? error.message : "Update command failed.");
      process.exitCode = 1;
    }
  });

void program.parseAsync(process.argv);
