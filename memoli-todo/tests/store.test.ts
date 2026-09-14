import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyChange, saveChange, tasksFrom } from "../src/store.ts";

test("task notes round-trip without becoming tasks or changing neighboring text", () => {
  const note = "補足\n\n- [ ] メモ内のチェックリスト\n```\nコード\n```";
  const added = applyChange("", { kind: "add", title: "相談", note });
  assert.equal(tasksFrom(added).length, 1);
  assert.equal(tasksFrom(added)[0].note, note);
  assert.equal(
    tasksFrom(
      applyChange(added, { kind: "toggle", task: tasksFrom(added)[0] }),
    )[0].note,
    note,
  );
  const original =
    "# Todo\r\n  - [ ] 相談\r\n    > 古いメモ\r\n    >\r\n    > 続き\r\n    - [ ] 子タスク\r\n普通の文章\r\n- [x] 次\r\n";
  const task = tasksFrom(original)[0];
  assert.equal(task.note, "古いメモ\n\n続き");
  assert.equal(tasksFrom(original).length, 3);
  const edited = applyChange(original, {
    kind: "edit",
    task,
    title: "相談",
    note: "新規\r\n詳細",
  });
  assert.equal(
    edited,
    original.replace(
      "    > 古いメモ\r\n    >\r\n    > 続き",
      "    > 新規\r\n    > 詳細",
    ),
  );
  assert.equal(
    applyChange(original, { kind: "edit", task, title: "別名" }),
    original.replace("[ ] 相談", "[ ] 別名"),
  );
  assert.equal(
    applyChange(original, { kind: "edit", task, title: "相談", note: "" }),
    original.replace("    > 古いメモ\r\n    >\r\n    > 続き\r\n", ""),
  );
  assert.equal(
    applyChange(original, { kind: "delete", task }),
    "# Todo\r\n    - [ ] 子タスク\r\n普通の文章\r\n- [x] 次\r\n",
  );
  assert.equal(
    tasksFrom(
      applyChange("- [ ] EOF", {
        kind: "edit",
        task: tasksFrom("- [ ] EOF")[0],
        title: "EOF",
        note,
      }),
    )[0].note,
    note,
  );
  assert.throws(
    () =>
      applyChange(original.replace("古いメモ", "外部変更"), {
        kind: "edit",
        task,
        title: "相談",
        note: "上書き",
      }),
    /メモが変更/,
  );
  assert.throws(() =>
    applyChange("", { kind: "add", title: "タスク", note: "\u0000" }),
  );
});

test("checklist CRUD preserves prose, formatting, and rejects stale writes", () => {
  const original =
    "# Todo\r\nメモ\r\n- [ ] 買い物\r\n  * [X] 済み\r\n```md\r\n- [ ] example\r\n```\r\n";
  const tasks = tasksFrom(original);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[1].done, true);
  assert.equal(
    applyChange(original, { kind: "toggle", task: tasks[0] }),
    original.replace("[ ] 買い物", "[x] 買い物"),
  );
  assert.equal(
    applyChange(original, { kind: "edit", task: tasks[1], title: "変更" }),
    original.replace("[X] 済み", "[X] 変更"),
  );
  assert.equal(
    applyChange(original, { kind: "delete", task: tasks[0] }),
    original.replace("- [ ] 買い物\r\n", ""),
  );
  assert.equal(applyChange("", { kind: "add", title: "新規" }), "- [ ] 新規\n");
  assert.equal(
    applyChange("# Todo", { kind: "add", title: "新規" }),
    "# Todo\n- [ ] 新規\n",
  );
  assert.throws(() => applyChange("", { kind: "add", title: "a\nb" }));
  assert.throws(() => applyChange("", { kind: "add", title: " " }));
  assert.throws(() =>
    applyChange("```\ncode", { kind: "add", title: "hidden" }),
  );
  const dir = mkdtempSync(join(tmpdir(), "memoli-todo-test-"));
  const file = join(dir, "todo.md");
  try {
    writeFileSync(file, original);
    saveChange(file, original, { kind: "toggle", task: tasks[0] });
    const saved = readFileSync(file, "utf8");
    assert.equal(saved, original.replace("[ ] 買い物", "[x] 買い物"));
    assert.equal(readFileSync(file + ".raycast.bak", "utf8"), original);
    assert.throws(
      () => saveChange(file, original, { kind: "delete", task: tasks[1] }),
      /外部で変更/,
    );
    assert.equal(readFileSync(file, "utf8"), saved);
    assert.equal(existsSync(file + ".raycast.lock"), false);
    writeFileSync(file + ".raycast.lock", "");
    assert.throws(() =>
      saveChange(file, saved, { kind: "add", title: "locked" }),
    );
    assert.equal(readFileSync(file, "utf8"), saved);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
