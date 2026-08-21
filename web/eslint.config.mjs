import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs; FlatCompat is no longer needed.
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/content/**",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
