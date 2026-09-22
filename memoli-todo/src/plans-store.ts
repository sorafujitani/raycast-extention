import { existsSync, readFileSync } from "node:fs";
import { ensureDataFile, saveSnapshot } from "./data-files";

export const periods = ["week", "month", "year", "future"] as const;
export type Period = (typeof periods)[number];
export const periodLabels: Record<Period, string> = {
  week: "Week",
  month: "Month",
  year: "Year",
  future: "Future",
};
export type Plan = {
  id: string;
  title: string;
  note: string;
  period: Period;
  done: boolean;
};
export type PlanChange =
  | { kind: "add"; plan: Plan }
  | { kind: "edit"; id: string; title: string; note: string; period: Period }
  | { kind: "move"; id: string; period: Period }
  | { kind: "reorder"; id: string; targetId: string }
  | { kind: "toggle"; id: string }
  | { kind: "delete"; id: string };

export function isPeriod(value: unknown): value is Period {
  return periods.some((period) => period === value);
}

function isPlan(value: unknown): value is Plan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<Plan>;
  return (
    typeof plan.id === "string" &&
    plan.id.length > 0 &&
    typeof plan.title === "string" &&
    plan.title.trim().length > 0 &&
    typeof plan.note === "string" &&
    isPeriod(plan.period) &&
    typeof plan.done === "boolean"
  );
}

export function parsePlans(text: string | undefined): Plan[] {
  if (text === undefined) return [];
  let plans: unknown;
  try {
    plans = JSON.parse(text);
  } catch {
    throw new Error("保存データを読み込めません。データは上書きしていません。");
  }
  if (
    !Array.isArray(plans) ||
    !plans.every(isPlan) ||
    new Set(plans.map((plan) => plan.id)).size !== plans.length
  ) {
    throw new Error("保存データの形式が不正です。データは上書きしていません。");
  }
  return plans;
}

export async function loadPlansFile(
  path: string,
  readLegacy: () => Promise<string | undefined>,
): Promise<string> {
  let text = readFileSync(path, "utf8");
  const plans = parsePlans(text);
  const marker = path + ".horizon-imported";
  if (!existsSync(marker)) {
    if (plans.length === 0) {
      const legacy = parsePlans(await readLegacy());
      if (legacy.length > 0)
        text = saveSnapshot(path, text, JSON.stringify(legacy, null, 2) + "\n");
    }
    ensureDataFile(marker, () => "");
  }
  return text;
}

export function savePlanChange(
  path: string,
  snapshot: string,
  change: PlanChange,
) {
  const next = applyPlanChange(parsePlans(snapshot), change);
  return saveSnapshot(path, snapshot, JSON.stringify(next, null, 2) + "\n");
}

export function applyPlanChange(plans: Plan[], change: PlanChange): Plan[] {
  if (change.kind === "add") {
    if (
      !isPlan(change.plan) ||
      plans.some((plan) => plan.id === change.plan.id)
    )
      throw new Error("追加するタスクが不正です");
    return [...plans, { ...change.plan, title: change.plan.title.trim() }];
  }
  const target = plans.find((plan) => plan.id === change.id);
  if (!target)
    throw new Error("タスクが見つかりません。再読み込みしてください。");
  if (change.kind === "delete")
    return plans.filter((plan) => plan.id !== change.id);
  if (change.kind === "reorder") {
    const other = plans.find((plan) => plan.id === change.targetId);
    if (!other || other.period !== target.period || other.done !== target.done)
      throw new Error("同じ期間・完了状態のタスク同士で並べ替えてください");
    return plans.map((plan) => {
      if (plan.id === target.id) return other;
      if (plan.id === other.id) return target;
      return plan;
    });
  }
  const next = { ...target };
  if (change.kind === "toggle") next.done = !next.done;
  if (change.kind === "move" || change.kind === "edit")
    next.period = change.period;
  if (change.kind === "edit") {
    next.title = change.title.trim();
    next.note = change.note;
  }
  if (!isPlan(next)) throw new Error("タスク名または期間が不正です");
  return plans.map((plan) => (plan.id === next.id ? next : plan));
}
