import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "cli/index": "src/cli/index.ts"
    },
    outDir: "dist",
    format: ["esm"],
    splitting: false,
    sourcemap: true,
    clean: true,
    dts: true,
    target: "node18",
    platform: "node"
  }
]);
