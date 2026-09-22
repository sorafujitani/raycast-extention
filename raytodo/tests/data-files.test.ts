import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "vite-plus/test";
import {
  dataPaths,
  initializePlans,
  initializeTodo,
} from "../src/data-files.ts";

test("install creates private files and never resets existing data", () => {
  const home = mkdtempSync(join(tmpdir(), "raytodo-install-"));
  try {
    const install = () =>
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL("../scripts/init-data.mjs", import.meta.url))],
        {
          env: { ...process.env, HOME: home },
        },
      );
    install();
    const paths = dataPaths(home);
    assert.equal(readFileSync(paths.todo, "utf8"), "# raytodo\n");
    assert.equal(readFileSync(paths.plans, "utf8"), "[]\n");
    assert.equal(statSync(paths.todo).mode & 0o777, 0o600);
    assert.equal(statSync(paths.plans).mode & 0o777, 0o600);
    writeFileSync(paths.todo, "- [ ] keep\n");
    writeFileSync(paths.plans, "invalid data must not be reset");
    install();
    assert.equal(readFileSync(paths.todo, "utf8"), "- [ ] keep\n");
    assert.equal(
      readFileSync(paths.plans, "utf8"),
      "invalid data must not be reset",
    );
    assert.equal(initializeTodo(home), paths.todo);
    assert.equal(initializePlans(home), paths.plans);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("first launch creates files even when install scripts were skipped", () => {
  const home = mkdtempSync(join(tmpdir(), "raytodo-first-launch-"));
  try {
    assert.equal(readFileSync(initializeTodo(home), "utf8"), "# raytodo\n");
    assert.equal(readFileSync(initializePlans(home), "utf8"), "[]\n");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
