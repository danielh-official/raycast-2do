import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { alias } from "../vitest.config.ts";

// The live tests run one at a time against the real 2Do, in the order written. Rooted here so only
// live/*.test.ts runs, whichever folder the command starts in.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: { alias },
  test: { include: ["*.test.ts"], testTimeout: 60_000, fileParallelism: false },
});
