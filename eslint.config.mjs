import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: [".next/**", ".next-e2e/**", "node_modules/**", "storage*/**", "playwright-report/**", "test-results/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];
