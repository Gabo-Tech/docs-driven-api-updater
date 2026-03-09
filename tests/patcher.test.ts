import { describe, expect, it } from "vitest";
import { summarizeDiffs } from "../src/updater/patcher.js";

describe("summarizeDiffs", () => {
  it("counts added and removed lines", () => {
    const result = summarizeDiffs([
      {
        filePath: "README.md",
        previousContent: "a\n",
        nextContent: "b\n",
        diff: `--- README.md
+++ README.md
@@ -1 +1 @@
-a
+b
`
      }
    ]);
    expect(result[0].added).toBe(1);
    expect(result[0].removed).toBe(1);
  });
});
