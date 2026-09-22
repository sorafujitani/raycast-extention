import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
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

test("install creates private files without Memoli and never resets existing data", () => {
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
    assert.equal(existsSync(join(home, ".memoli")), false);
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

test("legacy todo is copied once and then works independently", () => {
  const home = mkdtempSync(join(tmpdir(), "raytodo-migrate-"));
  try {
    const legacy = join(home, ".memoli", "memo");
    mkdirSync(legacy, { recursive: true });
    const original = "- [/] task <!-- triage:high -->\r\n  > note\r\n";
    writeFileSync(join(legacy, "todo.md"), original);
    const path = initializeTodo(home);
    assert.equal(readFileSync(path, "utf8"), original);
    assert.equal(readFileSync(join(legacy, "todo.md"), "utf8"), original);
    rmSync(join(home, ".memoli"), { recursive: true });
    writeFileSync(path, "updated\n");
    initializeTodo(home);
    assert.equal(readFileSync(path, "utf8"), "updated\n");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
