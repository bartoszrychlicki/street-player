import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "ios/StreetPlayer/.xcode-packages/**",
    "ios/StreetPlayer/build-xcode.log",
    "ios/StreetPlayer/build-run.log",
    "ios/StreetPlayer/*.log",
    "ios/StreetPlayer/build/**",
  ]),
]);

export default eslintConfig;
