import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const extensionRequire = createRequire(new URL("../extension/package.json", import.meta.url));

// vi.mock("@raycast/utils") must resolve to the same file extension/src imports, or the mock
// never applies and the real runAppleScript talks to 2Do. (@raycast/api has no runtime entry
// outside Raycast, so the tests mock it whole and it needs no alias.)
export default defineConfig({
  resolve: {
    alias: {
      "@raycast/utils": extensionRequire.resolve("@raycast/utils"),
    },
  },
});
