import { describe, expect, it } from "vitest";
import { updaterPlanSchema } from "../src/updater/schemas.js";

describe("updaterPlanSchema", () => {
  it("accepts strict valid plans", () => {
    const parsed = updaterPlanSchema.parse({
      summary: "Updated Stripe methods",
      updatedMethods: ["customers.create"],
      changes: [{ type: "new", message: "Added customers.search" }],
      files: { "src/integrations/stripe/client.ts": "export const x = 1;\n" },
      readmeTable: "| Method | Status | Notes |\n|---|---|---|\n| customers.create | stable | - |"
    });
    expect(parsed.updatedMethods).toContain("customers.create");
  });

  it("rejects unknown keys", () => {
    expect(() =>
      updaterPlanSchema.parse({
        summary: "x",
        updatedMethods: ["y"],
        changes: [{ type: "new", message: "z" }],
        files: {},
        readmeTable: "table",
        extra: true
      })
    ).toThrow();
  });
});
