import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Installed agent skills (.agents, .claude) and their working files (.taste-skill) are tooling, not the app.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".agents/**", ".claude/**", ".taste-skill/**"]),
]);

export default eslintConfig;
