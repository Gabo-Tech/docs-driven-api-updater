import path from "node:path";
import { ensureDir, readTextFile, writeTextFile } from "../../utils/fs.js";
import { logger } from "../../utils/logger.js";

const DEFAULT_CONFIG = {
  integrations: [
    {
      name: "stripe",
      docUrls: ["https://docs.stripe.com/api", "https://docs.stripe.com/api/errors"],
      methodsFile: "src/integrations/stripe/supported-methods.json",
      targetDir: "src/integrations/stripe"
    }
  ]
};

const DEFAULT_ENV_EXAMPLE = `# LLM selection: openrouter or ollama
LLM_PROVIDER=openrouter

# OpenRouter config
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini

# Ollama config (used when LLM_PROVIDER=ollama)
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b

# Optional fallback chain (comma-separated)
FALLBACK_MODELS=openai/gpt-4o-mini,meta-llama/llama-3.1-8b-instruct
MAX_MODEL_ATTEMPTS=3

# Prompt and crawl controls
UPDATER_DOC_TIMEOUT_MS=20000
UPDATER_DOC_MAX_CHARS=24000
UPDATER_PROMPT_DOC_MAX_CHARS=30000
UPDATER_PROMPT_METHODS_MAX_CHARS=8000
UPDATER_LLM_TIMEOUT_MS=45000
UPDATER_LLM_BACKOFF_MS=500
`;

/**
 * Initializes updater config and .env.example files.
 */
export async function runInitCommand(): Promise<void> {
  const cwd = process.cwd();
  const configPath = path.resolve(cwd, "updater.config.json");
  const envExamplePath = path.resolve(cwd, ".env.example");
  const methodsPath = path.resolve(cwd, "src/integrations/stripe/supported-methods.json");

  const configExists = await readTextFile(configPath);
  if (!configExists) {
    await writeTextFile(configPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
    logger.success("Created updater.config.json");
  } else {
    logger.warn("updater.config.json already exists, skipped.");
  }

  const envExists = await readTextFile(envExamplePath);
  if (!envExists) {
    await writeTextFile(envExamplePath, DEFAULT_ENV_EXAMPLE);
    logger.success("Created .env.example");
  } else {
    logger.warn(".env.example already exists, skipped.");
  }

  await ensureDir(path.dirname(methodsPath));
  const methodsExists = await readTextFile(methodsPath);
  if (!methodsExists) {
    await writeTextFile(methodsPath, JSON.stringify(["customers.create", "charges.create"], null, 2) + "\n");
    logger.success("Created starter supported-methods.json");
  }

  logger.info('Initialization complete. Next step: run "docs-driven-api-updater update --dry-run".');
}
