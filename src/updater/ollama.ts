import axios, { AxiosError } from "axios";
import { updaterPlanSchema } from "./schemas.js";
import { env, envNumber } from "../utils/env.js";
import type { IntegrationDocsBundle, ProviderAttemptResult, UpdaterPlan } from "../types.js";

const RETRYABLE_OR_FALLBACK_CODES = new Set([402, 404, 408, 429]);
const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

/**
 * Prompt inputs for LLM plan generation.
 */
export interface AskOllamaForPatchPlanInput {
  integrationName: string;
  docsBundle: IntegrationDocsBundle;
  currentMethodsJson: string;
  fallbackModels?: string[];
  maxModelAttempts?: number;
}

/**
 * Reads provider mode from env and defaults to OpenRouter.
 */
function resolveProvider(): "openrouter" | "ollama" {
  return env("LLM_PROVIDER") === "ollama" ? "ollama" : "openrouter";
}

/**
 * Truncates large prompt sections for cost and reliability.
 */
function truncateForPrompt(input: string, maxChars: number): string {
  if (input.length <= maxChars) {
    return input;
  }
  return `${input.slice(0, maxChars)}\n...[truncated ${input.length - maxChars} chars]`;
}

/**
 * Normalizes an error to avoid exposing secrets or giant request dumps.
 */
function sanitizeAxiosError(error: unknown): { statusCode?: number; message: string } {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    const message =
      error.response?.data && typeof error.response.data === "object"
        ? JSON.stringify(error.response.data)
        : error.message;
    return {
      statusCode,
      message: message.slice(0, 500)
    };
  }
  return { message: error instanceof Error ? error.message : "Unknown error" };
}

/**
 * Tries parsing JSON from plain text or fenced code block response.
 */
function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i) ?? trimmed.match(/```([\s\S]*?)```/i);
  if (!fenced) {
    throw new Error("Model did not return JSON output.");
  }
  return JSON.parse(fenced[1].trim());
}

/**
 * Builds the strict prompt for docs-driven update planning.
 */
function buildPlannerPrompt(input: AskOllamaForPatchPlanInput): string {
  const docsMaxChars = envNumber("UPDATER_PROMPT_DOC_MAX_CHARS", 30_000);
  const methodsMaxChars = envNumber("UPDATER_PROMPT_METHODS_MAX_CHARS", 8_000);
  const flattenedDocs = JSON.stringify(input.docsBundle, null, 2);

  return [
    "You are an API SDK maintainer. Return STRICT JSON only.",
    "Do not include markdown.",
    "Use this schema exactly:",
    JSON.stringify(
      {
        summary: "string",
        updatedMethods: ["string"],
        changes: [
          {
            type: "breaking|new|deprecated|fixed|note",
            message: "string",
            affectedFiles: ["optional-string"]
          }
        ],
        files: {
          "path/to/file.ts": "full file output content"
        },
        readmeTable: "| Method | Status | Notes |\\n|---|---|---|\\n| ... | ... | ... |"
      },
      null,
      2
    ),
    "",
    `Integration name: ${input.integrationName}`,
    "Current supported-methods.json:",
    truncateForPrompt(input.currentMethodsJson, methodsMaxChars),
    "",
    "Crawled official docs payload:",
    truncateForPrompt(flattenedDocs, docsMaxChars),
    "",
    "Requirements:",
    "- Update only integration-related wrappers/endpoints/types and README method table.",
    "- Provide full file outputs in files map (not patches).",
    "- Keep changes minimal and production-safe."
  ].join("\n");
}

/**
 * Calls OpenRouter chat completions endpoint.
 */
async function callOpenRouter(model: string, prompt: string): Promise<string> {
  const apiKey = env("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY for LLM_PROVIDER=openrouter.");
  }

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    },
    {
      timeout: envNumber("UPDATER_LLM_TIMEOUT_MS", 45_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned an empty response.");
  }
  return content;
}

/**
 * Calls local Ollama chat endpoint.
 */
async function callOllama(model: string, prompt: string): Promise<string> {
  const host = env("OLLAMA_HOST") ?? "http://127.0.0.1:11434";
  const response = await axios.post(
    `${host.replace(/\/$/, "")}/api/chat`,
    {
      model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: {
        temperature: 0.1
      }
    },
    {
      timeout: envNumber("UPDATER_LLM_TIMEOUT_MS", 45_000)
    }
  );
  const content = response.data?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned an empty response.");
  }
  return content;
}

/**
 * Waits briefly before next fallback attempt.
 */
async function shortBackoff(attempt: number): Promise<void> {
  const base = envNumber("UPDATER_LLM_BACKOFF_MS", 500);
  const waitMs = Math.min(base * (attempt + 1), 2_500);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

/**
 * Picks model chain from env + CLI overrides.
 */
function modelChain(provider: "openrouter" | "ollama", fallbackModels?: string[]): string[] {
  const envMain = provider === "openrouter" ? env("OPENROUTER_MODEL") : env("OLLAMA_MODEL");
  const defaults = [provider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : DEFAULT_OLLAMA_MODEL];
  const fromEnvFallback = (env("FALLBACK_MODELS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const fromCliFallback = fallbackModels?.map((item) => item.trim()).filter(Boolean) ?? [];
  const chain = [envMain, ...fromCliFallback, ...fromEnvFallback, ...defaults].filter(Boolean) as string[];
  return [...new Set(chain)];
}

/**
 * Returns whether an error should trigger retry/fallback.
 */
function shouldFallback(error: unknown): boolean {
  const status = (error as AxiosError)?.response?.status;
  return typeof status === "number" && RETRYABLE_OR_FALLBACK_CODES.has(status);
}

/**
 * Sends crawled docs + current methods to configured LLM and returns a strict update plan.
 */
export async function askOllamaForPatchPlan(input: AskOllamaForPatchPlanInput): Promise<{
  plan: UpdaterPlan;
  attempts: ProviderAttemptResult[];
}> {
  const provider = resolveProvider();
  const prompt = buildPlannerPrompt(input);
  const attempts: ProviderAttemptResult[] = [];
  const models = modelChain(provider, input.fallbackModels);
  const maxAttempts = input.maxModelAttempts ?? envNumber("MAX_MODEL_ATTEMPTS", models.length);
  const limitedModels = models.slice(0, Math.max(maxAttempts, 1));

  for (let i = 0; i < limitedModels.length; i += 1) {
    const model = limitedModels[i];
    try {
      const raw = provider === "openrouter" ? await callOpenRouter(model, prompt) : await callOllama(model, prompt);
      const json = extractJsonObject(raw);
      const plan = updaterPlanSchema.parse(json);
      attempts.push({ provider, model, ok: true });
      return { plan, attempts };
    } catch (error) {
      const sanitized = sanitizeAxiosError(error);
      attempts.push({
        provider,
        model,
        ok: false,
        statusCode: sanitized.statusCode,
        errorMessage: sanitized.message
      });

      if (!shouldFallback(error) && i === limitedModels.length - 1) {
        throw new Error(`Planner failed (${provider}/${model}): ${sanitized.message}`);
      }
      if (i < limitedModels.length - 1) {
        await shortBackoff(i);
      }
    }
  }

  const last = attempts[attempts.length - 1];
  throw new Error(
    `All planner attempts failed. Last model=${last?.model ?? "unknown"} status=${last?.statusCode ?? "n/a"}`
  );
}
