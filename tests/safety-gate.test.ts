import { describe, expect, it } from "vitest";
import { validateUpdaterPlanSafety } from "../src/cli/commands/update.js";
import type { UpdaterPlan } from "../src/types.js";

describe("validateUpdaterPlanSafety", () => {
  it("flags placeholder rewrites", () => {
    const plan: UpdaterPlan = {
      summary: "x",
      updatedMethods: ["a"],
      changes: [{ type: "note", message: "x" }],
      files: { "src/integrations/stripe/client.ts": "const key = 'your api key';\n" },
      readmeTable: "|m|s|n|"
    };
    const result = validateUpdaterPlanSafety(plan, [
      {
        filePath: "src/integrations/stripe/client.ts",
        previousContent: "const a = 1;\n",
        nextContent: "const key = 'your api key';\n",
        diff: ""
      }
    ]);
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toContain("Placeholder-like");
  });
});
