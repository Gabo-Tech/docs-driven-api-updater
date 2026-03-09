import { z } from "zod";

/**
 * Strict schema for validating updater.config.json.
 */
export const integrationConfigSchema = z.object({
  name: z.string().min(1),
  docUrls: z.array(z.string().url()).min(1),
  methodsFile: z.string().min(1),
  targetDir: z.string().min(1)
});

/**
 * Strict schema for all integrations in config.
 */
export const updaterConfigSchema = z.object({
  integrations: z.array(integrationConfigSchema).min(1)
});

/**
 * Strict schema used to validate LLM update plans.
 */
export const updaterPlanSchema = z
  .object({
    summary: z.string().min(1),
    updatedMethods: z.array(z.string()).min(1),
    changes: z
      .array(
        z.object({
          type: z.enum(["breaking", "new", "deprecated", "fixed", "note"]),
          message: z.string().min(1),
          affectedFiles: z.array(z.string()).optional()
        })
      )
      .min(1),
    files: z.record(z.string(), z.string()),
    readmeTable: z.string().min(1)
  })
  .strict();

export type UpdaterConfigInput = z.infer<typeof updaterConfigSchema>;
export type UpdaterPlanInput = z.infer<typeof updaterPlanSchema>;
