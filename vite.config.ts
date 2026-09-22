import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["*/tests/**/*.test.{ts,mjs}"],
    exclude: ["**/node_modules/**", "**/dist/**", "local/**"],
    environment: "node",
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/raycast-env.d.ts", "local/**"],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    printWidth: 80,
    singleQuote: false,
    ignorePatterns: [
      "**/dist/**",
      "**/raycast-env.d.ts",
      "pnpm-lock.yaml",
      "local/**",
    ],
  },
});
