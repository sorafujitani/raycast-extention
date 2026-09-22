import { expect, test } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { blockedPaths, outgoingPaths } from "../check-public-files.mjs";

const root = new URL("../../", import.meta.url);

test("only public tools and named workspace files are allowed", () => {
  expect(
    blockedPaths([
      "README.md",
      ".npmrc",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "raytodo/src/raytodo.tsx",
      "gh-assigned/src/assigned.tsx",
      "ray-dsl-viewer/src/dsl-viewer.tsx",
      ".githooks/pre-commit",
      ".githooks/pre-push",
      "scripts/check-public-files.mjs",
      "scripts/tests/public-files.test.mjs",
    ]),
  ).toEqual([]);
  const privatePaths = [
    "local/company-tool/src/index.tsx",
    "local/company-tool/pnpm-lock.yaml",
    "company-tool/src/index.tsx",
    "company notes.md",
    "private.json",
    ".env",
    "raytodo/.env.local",
    "raytodo/node_modules/pkg/index.js",
    "raytodo/package-lock.json",
    "gh-assigned/dist/assigned.js",
    "ray-dsl-viewer/dev.log",
    "raytodo/raycast-env.d.ts",
    "scripts/company-script.mjs",
    ".githooks/other-hook",
  ];
  expect(blockedPaths(privatePaths)).toEqual(privatePaths);
  expect(blockedPaths([])).toEqual([]);
});

test("pre-push examines outgoing history and handles unchanged/deleted refs", () => {
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const zero = "0".repeat(head.length);
  expect(
    outgoingPaths(`refs/heads/main ${head} refs/heads/main ${head}\n`),
  ).toEqual([]);
  expect(outgoingPaths(`(delete) ${zero} refs/heads/main ${head}\n`)).toEqual(
    [],
  );
  expect(
    outgoingPaths(`refs/heads/main ${head} refs/heads/main ${zero}\n`),
  ).toContain("README.md");
  expect(outgoingPaths("")).toEqual([]);
  expect(() => outgoingPaths("invalid input")).toThrow(
    "Invalid pre-push input",
  );
});
