import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyChange, saveChange, tasksFrom } from "../src/store.ts";

test("priority sorting saves all statuses, keeps equal priorities stable, and moves notes", () => {
  for (const newline of ["\n", "\r\n"]) {
    const original = [
      "# raytodo",
      "- [ ] 低 <!-- triage:low -->",
      "  > 低のメモ",
      "- [x] 高A <!-- triage:high -->",
      "- [ ] 中",
      "- [/] 高B <!-- triage:high -->",
      "- [ ] 低B <!-- triage:low -->",
      "",
    ].join(newline);
    const expected = [
      "# raytodo",
      "- [x] 高A <!-- triage:high -->",
      "- [/] 高B <!-- triage:high -->",
      "- [ ] 中",
      "- [ ] 低 <!-- triage:low -->",
      "  > 低のメモ",
      "- [ ] 低B <!-- triage:low -->",
      "",
    ].join(newline);
    const directory = mkdtempSync(join(tmpdir(), "raytodo-priority-sort-"));
    const path = join(directory, "todo.md");
    try {
      writeFileSync(path, original);
      assert.equal(
        saveChange(path, original, { kind: "sort-priority" }),
        expected,
      );
      assert.equal(readFileSync(path, "utf8"), expected);
      assert.equal(readFileSync(path + ".raycast.bak", "utf8"), original);
      assert.deepEqual(
        tasksFrom(expected).map((task) => task.title),
        ["高A", "高B", "中", "低", "低B"],
      );
      assert.equal(applyChange(expected, { kind: "sort-priority" }), expected);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("priority sorting does not move tasks across Markdown structure", () => {
  for (const original of [
    "- [ ] 低 <!-- triage:low -->\n## 別の見出し\n- [ ] 高 <!-- triage:high -->\n",
    "- [ ] 低 <!-- triage:low -->\n普通の文章\n- [ ] 高 <!-- triage:high -->\n",
    "- [ ] 低 <!-- triage:low -->\n- [ ] 親\n  - [ ] 子 <!-- triage:high -->\n",
  ]) {
    const directory = mkdtempSync(join(tmpdir(), "raytodo-priority-sort-"));
    const path = join(directory, "todo.md");
    try {
      writeFileSync(path, original);
      assert.throws(
        () => saveChange(path, original, { kind: "sort-priority" }),
        /同じ階層|子項目/,
      );
      assert.equal(readFileSync(path, "utf8"), original);
      assert.equal(existsSync(path + ".raycast.bak"), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});
