import { test } from "vite-plus/test";
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

test("legacy term comments stay hidden without losing tasks or metadata", () => {
  for (const suffix of [
    " <!-- triage:high --> <!-- term:week -->",
    " <!-- term:month --> <!-- triage:high -->",
  ]) {
    const original = `- [/] 相談${suffix}\n  > 詳細\n`;
    assert.deepEqual(tasksFrom(original)[0], {
      line: 0,
      title: "相談",
      status: "inprogress",
      triage: "high",
      note: "詳細",
    });
    const edited = applyChange(original, {
      kind: "edit",
      task: tasksFrom(original)[0],
      title: "変更",
    });
    assert.equal(edited, original.replace("相談", "変更"));
    const reprioritized = applyChange(edited, {
      kind: "triage",
      task: tasksFrom(edited)[0],
      direction: -1,
    });
    assert.ok(reprioritized.includes(suffix.match(/<!-- term:\w+ -->/)![0]));
    assert.equal(tasksFrom(reprioritized)[0].title, "変更");
    assert.equal(tasksFrom(reprioritized)[0].triage, "mid");
  }
});

test("bulk deletion removes only done tasks and their notes", () => {
  for (const newline of ["\n", "\r\n"]) {
    const original = [
      "# Todo",
      "普通の文章",
      "- [x] 完了 <!-- term:week -->",
      "  > 完了メモ",
      "  >",
      "  - [ ] 未完の子",
      "- [/] 作業中 <!-- term:month -->",
      "  > 残すメモ",
      "- [-] 保留",
      "```md",
      "- [x] コード内",
      "```",
      "~~~",
      "- [X] コード内2",
      "~~~",
      "1. [X] 完了2 <!-- term:future -->",
      "  > 詳細",
      "- [x] 末尾",
    ].join(newline);
    const expected = [
      "# Todo",
      "普通の文章",
      "  - [ ] 未完の子",
      "- [/] 作業中 <!-- term:month -->",
      "  > 残すメモ",
      "- [-] 保留",
      "```md",
      "- [x] コード内",
      "```",
      "~~~",
      "- [X] コード内2",
      "~~~",
    ].join(newline);
    assert.equal(applyChange(original, { kind: "delete-done" }), expected);
    assert.equal(applyChange(expected, { kind: "delete-done" }), expected);
  }
  assert.equal(applyChange("", { kind: "delete-done" }), "");
  assert.equal(
    applyChange("- [x] 済み\n  > メモ\n", { kind: "delete-done" }),
    "",
  );
  assert.equal(
    applyChange("- [x] 親\n  - [X] 子\n    > 子のメモ\n", {
      kind: "delete-done",
    }),
    "",
  );
});

test("status and triage change independently and survive editing and reload", () => {
  let text = "- [ ] 相談\n  > メモ\n- [X] 済み\n";
  assert.equal(tasksFrom(text)[0].triage, "mid");
  for (const [status, marker] of [
    ["inprogress", "/"],
    ["pend", "-"],
    ["done", "x"],
    ["todo", " "],
  ] as const) {
    text = applyChange(text, {
      kind: "status",
      task: tasksFrom(text)[0],
      status,
    });
    assert.ok(text.startsWith(`- [${marker}] 相談`));
    assert.equal(tasksFrom(text)[0].status, status);
    assert.equal(tasksFrom(text)[0].triage, "mid");
    assert.equal(tasksFrom(text)[0].note, "メモ");
  }
  text = applyChange(text, {
    kind: "triage",
    task: tasksFrom(text)[0],
    direction: 1,
  });
  assert.ok(text.startsWith("- [ ] 相談 <!-- triage:high -->\n"));
  assert.equal(tasksFrom(text)[0].title, "相談");
  assert.equal(
    applyChange(text, {
      kind: "triage",
      task: tasksFrom(text)[0],
      direction: 1,
    }),
    text,
  );
  text = applyChange(text, {
    kind: "status",
    task: tasksFrom(text)[0],
    status: "pend",
  });
  text = applyChange(text, {
    kind: "edit",
    task: tasksFrom(text)[0],
    title: "変更",
    note: "詳細",
  });
  assert.equal(text, "- [-] 変更 <!-- triage:high -->\n  > 詳細\n- [X] 済み\n");
  for (const triage of ["mid", "low"] as const) {
    text = applyChange(text, {
      kind: "triage",
      task: tasksFrom(text)[0],
      direction: -1,
    });
    assert.equal(tasksFrom(text)[0].triage, triage);
    assert.equal(tasksFrom(text)[0].status, "pend");
  }
  assert.equal(
    applyChange(text, {
      kind: "triage",
      task: tasksFrom(text)[0],
      direction: -1,
    }),
    text,
  );
  text = applyChange(text, { kind: "toggle", task: tasksFrom(text)[0] });
  assert.equal(tasksFrom(text)[0].status, "done");
  assert.equal(tasksFrom(text)[0].triage, "low");
  assert.throws(
    () =>
      applyChange(text.replace("triage:low", "triage:mid"), {
        kind: "toggle",
        task: tasksFrom(text)[0],
      }),
    /変更されています/,
  );
  assert.throws(() =>
    applyChange("", { kind: "add", title: "予約 <!-- triage:low -->" }),
  );
  assert.equal(tasksFrom("```\n- [/] 例\n```\n- [-] 保留\n").length, 1);
});

test("reordering swaps visible task blocks with notes and preserves the rest of the file", () => {
  for (const newline of ["\n", "\r\n"]) {
    const original = [
      "# Todo",
      "",
      "- [/] 同名 <!-- triage:high -->",
      "  > 一行",
      "  > 二行",
      "",
      "- [x] 非表示",
      "",
      "- [-] 同名",
    ].join(newline);
    const tasks = tasksFrom(original);
    const moved = applyChange(original, {
      kind: "move",
      task: tasks[0],
      target: tasks[2],
    });
    assert.equal(
      moved,
      [
        "# Todo",
        "",
        "- [-] 同名",
        "",
        "- [x] 非表示",
        "",
        "- [/] 同名 <!-- triage:high -->",
        "  > 一行",
        "  > 二行",
      ].join(newline),
    );
    const after = tasksFrom(moved);
    assert.equal(after[2].note, "一行\n二行");
    assert.equal(after[2].triage, "high");
    assert.equal(
      applyChange(moved, { kind: "move", task: after[2], target: after[0] }),
      original,
    );
    assert.equal(
      applyChange(original, { kind: "move", task: tasks[0], target: tasks[0] }),
      original,
    );
    assert.throws(
      () =>
        applyChange(original, {
          kind: "move",
          task: tasks[0],
          target: { ...tasks[2], title: "古いタイトル" },
        }),
      /移動先が変更/,
    );
  }
  for (const original of [
    "- [ ] A\n## 別の見出し\n- [ ] B\n",
    "- [ ] A\n普通の文章\n- [ ] B\n",
    "- [ ] A\n  - [ ] 子\n- [ ] B\n",
    "- [ ] A\n- [ ] B\n  - [ ] 子\n",
  ]) {
    const tasks = tasksFrom(original);
    const target = tasks.find((task) => task.title === "B")!;
    assert.throws(
      () => applyChange(original, { kind: "move", task: tasks[0], target }),
      /同じ階層|子項目/,
    );
  }
  const nested = "- [ ] 親\n  - [ ] 子A\n  - [ ] 子B\n";
  const children = tasksFrom(nested);
  assert.equal(
    applyChange(nested, {
      kind: "move",
      task: children[2],
      target: children[1],
    }),
    "- [ ] 親\n  - [ ] 子B\n  - [ ] 子A\n",
  );
});

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
  assert.equal(tasks[1].status, "done");
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
    assert.throws(
      () => saveChange(file, original, { kind: "delete-done" }),
      /外部で変更/,
    );
    assert.equal(readFileSync(file, "utf8"), saved);
    saveChange(file, saved, { kind: "delete-done" });
    const cleared = readFileSync(file, "utf8");
    assert.equal(
      cleared,
      "# Todo\r\nメモ\r\n```md\r\n- [ ] example\r\n```\r\n",
    );
    assert.equal(readFileSync(file + ".raycast.bak", "utf8"), saved);
    writeFileSync(file + ".raycast.lock", "");
    assert.throws(() =>
      saveChange(file, cleared, { kind: "add", title: "locked" }),
    );
    assert.equal(readFileSync(file, "utf8"), cleared);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
