import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  {
    ignores: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.mjs"]
  }
]);
