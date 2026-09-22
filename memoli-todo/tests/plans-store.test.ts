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
import { test } from "vite-plus/test";
import { initializePlans } from "../src/data-files.ts";
import {
  applyPlanChange,
  loadPlansFile,
  savePlanChange,
  parsePlans,
  periods,
  type Plan,
} from "../src/plans-store.ts";

const plan: Plan = {
  id: "first",
  title: "旅行を計画する",
  note: "候補を調べる\n予算を決める",
  period: "future",
  done: false,
};

test("legacy plans migrate once; edits persist with backup and stale writes are rejected", async () => {
  const home = mkdtempSync(join(tmpdir(), "rayteam-store-"));
  try {
    const path = initializePlans(home);
    const legacy = JSON.stringify([plan]);
    let reads = 0;
    const readLegacy = async () => {
      reads++;
      return legacy;
    };
    const snapshot = await loadPlansFile(path, readLegacy);
    assert.deepEqual(parsePlans(snapshot), [plan]);
    assert.equal(reads, 1);
    assert.equal(readFileSync(path + ".raycast.bak", "utf8"), "[]\n");
    const saved = savePlanChange(path, snapshot, {
      kind: "toggle",
      id: plan.id,
    });
    assert.equal(parsePlans(saved)[0].done, true);
    assert.equal(readFileSync(path + ".raycast.bak", "utf8"), snapshot);
    assert.throws(
      () => savePlanChange(path, snapshot, { kind: "delete", id: plan.id }),
      /外部で変更/,
    );
    assert.equal(readFileSync(path, "utf8"), saved);
    writeFileSync(path + ".raycast.lock", "");
    assert.throws(() =>
      savePlanChange(path, saved, { kind: "delete", id: plan.id }),
    );
    rmSync(path + ".raycast.lock");
    savePlanChange(path, saved, { kind: "delete", id: plan.id });
    assert.deepEqual(parsePlans(await loadPlansFile(path, readLegacy)), []);
    assert.equal(reads, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("failed migration and corrupt files are preserved; existing rayteam data wins", async () => {
  const home = mkdtempSync(join(tmpdir(), "rayteam-invalid-"));
  try {
    const path = initializePlans(home);
    await assert.rejects(loadPlansFile(path, async () => "broken"));
    assert.equal(readFileSync(path, "utf8"), "[]\n");
    assert.equal(existsSync(path + ".horizon-imported"), false);
    writeFileSync(path, "broken file");
    await assert.rejects(
      loadPlansFile(path, async () => JSON.stringify([plan])),
    );
    assert.equal(readFileSync(path, "utf8"), "broken file");
    const existing = JSON.stringify([{ ...plan, title: "new data" }]);
    writeFileSync(path, existing);
    assert.equal(
      await loadPlansFile(path, async () => {
        throw new Error("must not read legacy");
      }),
      existing,
    );
    assert.equal(readFileSync(path, "utf8"), existing);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("plans survive add, edit, every period, completion, reload and deletion", () => {
  let plans = applyPlanChange(parsePlans(undefined), {
    kind: "add",
    plan: { ...plan, title: `  ${plan.title}  ` },
  });
  assert.deepEqual(plans, [plan]);
  const original = plans;
  plans = applyPlanChange(plans, {
    kind: "edit",
    id: plan.id,
    title: "  行き先を決める  ",
    note: "更新したメモ",
    period: "year",
  });
  assert.deepEqual(original, [plan]);
  assert.equal(plans[0].title, "行き先を決める");
  assert.equal(plans[0].note, "更新したメモ");
  assert.equal(plans[0].period, "year");
  plans = applyPlanChange(plans, { kind: "toggle", id: plan.id });
  for (const period of periods) {
    plans = applyPlanChange(plans, { kind: "move", id: plan.id, period });
    assert.deepEqual(plans[0], {
      id: plan.id,
      title: "行き先を決める",
      note: "更新したメモ",
      period,
      done: true,
    });
  }
  assert.deepEqual(parsePlans(JSON.stringify(plans)), plans);
  plans = applyPlanChange(plans, { kind: "toggle", id: plan.id });
  assert.equal(plans[0].done, false);
  plans = applyPlanChange(plans, { kind: "delete", id: plan.id });
  assert.deepEqual(plans, []);
});

test("changing one plan preserves other plans and never mutates the input", () => {
  const other = { ...plan, id: "second", period: "week" as const };
  const input = [Object.freeze(plan), Object.freeze(other)];
  const output = applyPlanChange(input, { kind: "toggle", id: plan.id });
  assert.equal(output[0].done, true);
  assert.equal(input[0].done, false);
  assert.deepEqual(output[1], other);
  assert.deepEqual(applyPlanChange(output, { kind: "delete", id: plan.id }), [
    other,
  ]);
});

test("reordering swaps visible neighbors with their notes and persists the order", () => {
  for (const done of [false, true]) {
    const first = { ...plan, done };
    const hidden = { ...plan, id: "hidden", title: "検索対象外" };
    const otherPeriod = { ...plan, id: "week", period: "week" as const };
    const second = { ...plan, id: "second", note: "別のメモ", done };
    const original = [first, hidden, otherPeriod, second];
    const reordered = applyPlanChange(original, {
      kind: "reorder",
      id: first.id,
      targetId: second.id,
    });
    assert.deepEqual(original, [first, hidden, otherPeriod, second]);
    assert.deepEqual(reordered, [second, hidden, otherPeriod, first]);
    assert.deepEqual(parsePlans(JSON.stringify(reordered)), reordered);
    assert.deepEqual(
      applyPlanChange(reordered, {
        kind: "reorder",
        id: first.id,
        targetId: second.id,
      }),
      original,
    );
  }
});

test("reordering rejects missing tasks and crossing period or completion boundaries", () => {
  for (const other of [
    { ...plan, id: "other", period: "week" as const },
    { ...plan, id: "other", done: true },
  ]) {
    assert.throws(() =>
      applyPlanChange([plan, other], {
        kind: "reorder",
        id: plan.id,
        targetId: other.id,
      }),
    );
  }
  assert.throws(() =>
    applyPlanChange([plan], {
      kind: "reorder",
      id: plan.id,
      targetId: "missing",
    }),
  );
  assert.throws(() =>
    applyPlanChange([plan], {
      kind: "reorder",
      id: "missing",
      targetId: plan.id,
    }),
  );
});

test("invalid stored data is rejected rather than silently reset", () => {
  for (const text of [
    "",
    "{",
    "null",
    "{}",
    "[null]",
    JSON.stringify([plan, plan]),
    ...[
      { id: "" },
      { title: " " },
      { title: 1 },
      { note: null },
      { period: "feature" },
      { period: "daily" },
      { done: "false" },
    ].map((fields) => JSON.stringify([{ ...plan, ...fields }])),
  ])
    assert.throws(() => parsePlans(text));
});

test("empty titles, duplicate IDs and stale changes cannot replace saved tasks", () => {
  assert.throws(() => applyPlanChange([plan], { kind: "add", plan }));
  assert.throws(() =>
    applyPlanChange([], { kind: "add", plan: { ...plan, title: " " } }),
  );
  assert.throws(() =>
    applyPlanChange([plan], {
      kind: "edit",
      id: plan.id,
      title: "\t",
      note: "",
      period: "week",
    }),
  );
  assert.throws(() =>
    applyPlanChange([plan], { kind: "delete", id: "missing" }),
  );
  assert.throws(() => applyPlanChange([], { kind: "toggle", id: plan.id }));
});
