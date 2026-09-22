import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  Keyboard,
  List,
  LocalStorage,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { randomUUID } from "node:crypto";
import { useEffect, useRef, useState } from "react";
import { dataPaths, initializePlans } from "./data-files";
import { SwitchCommandAction } from "./switch-command";
import {
  loadPlansFile,
  savePlanChange,
  isPeriod,
  parsePlans,
  periodLabels,
  periods,
  type Period,
  type Plan,
  type PlanChange,
} from "./plans-store";

const path = dataPaths().plans;
const storageKey = "horizon-todo-v1";
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function PlanForm({
  plan,
  period,
  initialTitle,
  onSave,
}: {
  plan?: Plan;
  period: Period;
  initialTitle: string;
  onSave: (change: PlanChange) => Promise<boolean>;
}) {
  const { pop } = useNavigation();
  const [error, setError] = useState<string>();
  const [selectedPeriod, setSelectedPeriod] = useState(plan?.period ?? period);
  const [titleFocused, setTitleFocused] = useState(true);
  const noteRef = useRef<Form.TextArea>(null);
  return (
    <Form
      navigationTitle={plan ? "タスクを編集" : "タスクを追加"}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="保存"
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onSubmit={async (values: {
              title: string;
              note: string;
              period: string;
            }) => {
              if (!values.title.trim()) {
                setError("タスクを入力してください");
                return;
              }
              if (!isPeriod(values.period)) return;
              const fields = {
                title: values.title,
                note: values.note,
                period: values.period,
              };
              if (
                await onSave(
                  plan
                    ? { kind: "edit", id: plan.id, ...fields }
                    : {
                        kind: "add",
                        plan: { id: randomUUID(), done: false, ...fields },
                      },
                )
              )
                pop();
            }}
          />
          {titleFocused && (
            <Action
              title="メモに移動"
              shortcut={{ modifiers: [], key: "return" }}
              onAction={() => noteRef.current?.focus()}
            />
          )}
          {([-1, 1] as const).map((direction) => (
            <Action
              key={direction}
              title={direction === -1 ? "前の期間へ" : "次の期間へ"}
              shortcut={{
                modifiers: ["shift"],
                key: direction === -1 ? "arrowLeft" : "arrowRight",
              }}
              onAction={() =>
                setSelectedPeriod(
                  (value) =>
                    periods[periods.indexOf(value) + direction] ?? value,
                )
              }
            />
          ))}
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="タスク"
        defaultValue={plan?.title ?? initialTitle}
        error={error}
        onChange={() => setError(undefined)}
        autoFocus
        onFocus={() => setTitleFocused(true)}
      />
      <Form.Dropdown
        id="period"
        title="期間"
        value={selectedPeriod}
        onChange={(value) => {
          if (isPeriod(value)) setSelectedPeriod(value);
        }}
        onFocus={() => setTitleFocused(false)}
      >
        {periods.map((value) => (
          <Form.Dropdown.Item
            key={value}
            value={value}
            title={periodLabels[value]}
          />
        ))}
      </Form.Dropdown>
      <Form.TextArea
        id="note"
        title="メモ"
        defaultValue={plan?.note ?? ""}
        ref={noteRef}
        onFocus={() => setTitleFocused(false)}
      />
    </Form>
  );
}

export default function Command() {
  const [plans, setPlans] = useState<Plan[]>();
  const [failure, setFailure] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [snapshot, setSnapshot] = useState<string>();
  const busy = useRef(false);

  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const text = await loadPlansFile(initializePlans(), () =>
        LocalStorage.getItem<string>(storageKey),
      );
      setSnapshot(text);
      setPlans(parsePlans(text));
      setFailure(undefined);
    } catch (error) {
      setSnapshot(undefined);
      setPlans(undefined);
      setFailure(message(error));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  async function save(change: PlanChange): Promise<boolean> {
    if (busy.current || snapshot === undefined) return false;
    busy.current = true;
    setLoading(true);
    try {
      const text = savePlanChange(path, snapshot, change);
      setSnapshot(text);
      setPlans(parsePlans(text));
      if (change.kind === "reorder") setSelectedId(change.id);
      return true;
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "保存できませんでした",
        message: message(error),
      });
      return false;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function actions(plan?: Plan, previous?: Plan, next?: Plan) {
    return (
      <ActionPanel>
        {plan && (
          <>
            <Action
              title={plan.done ? "未完了に戻す" : "完了にする"}
              icon={plan.done ? Icon.Circle : Icon.CheckCircle}
              onAction={() => save({ kind: "toggle", id: plan.id })}
            />
            <Action.Push
              title="タスクを編集"
              icon={Icon.Pencil}
              shortcut={Keyboard.Shortcut.Common.Edit}
              target={
                <PlanForm
                  plan={plan}
                  period={plan.period}
                  initialTitle=""
                  onSave={save}
                />
              }
            />
            {(
              [
                {
                  title: "上に移動",
                  key: "arrowUp",
                  icon: Icon.ArrowUp,
                  target: previous,
                },
                {
                  title: "下に移動",
                  key: "arrowDown",
                  icon: Icon.ArrowDown,
                  target: next,
                },
              ] as const
            ).map(({ title, key, icon, target }) => (
              <Action
                key={key}
                title={title}
                icon={icon}
                shortcut={{ modifiers: ["shift"], key }}
                onAction={() =>
                  target &&
                  target.done === plan.done &&
                  save({ kind: "reorder", id: plan.id, targetId: target.id })
                }
              />
            ))}
            <ActionPanel.Submenu title="期間を移動" icon={Icon.ArrowRight}>
              {periods
                .filter((value) => value !== plan.period)
                .map((value) => (
                  <Action
                    key={value}
                    title={periodLabels[value]}
                    onAction={() =>
                      save({ kind: "move", id: plan.id, period: value })
                    }
                  />
                ))}
            </ActionPanel.Submenu>
          </>
        )}
        {plans !== undefined && (
          <Action.Push
            title="タスクを追加"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={
              <PlanForm
                period={isPeriod(period) ? period : "future"}
                initialTitle={search}
                onSave={save}
              />
            }
          />
        )}
        <Action
          title="再読み込み"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={refresh}
        />
        <SwitchCommandAction target="todo" />
        <Action.Open
          title="JSONファイルを開く"
          target={path}
          shortcut={Keyboard.Shortcut.Common.Open}
        />
        {plan && (
          <Action
            title="タスクを削除"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
            onAction={async () => {
              if (
                await confirmAlert({
                  title: "タスクを削除しますか？",
                  message: plan.title,
                  primaryAction: {
                    title: "削除",
                    style: Alert.ActionStyle.Destructive,
                  },
                })
              )
                await save({ kind: "delete", id: plan.id });
            }}
          />
        )}
      </ActionPanel>
    );
  }

  const query = search.trim().toLocaleLowerCase();
  return (
    <List
      isLoading={loading}
      navigationTitle="rayteam"
      searchBarPlaceholder="タスク・メモを検索…（⌘Nで追加）"
      searchText={search}
      onSearchTextChange={setSearch}
      filtering={false}
      selectedItemId={selectedId}
      onSelectionChange={(id) => setSelectedId(id ?? undefined)}
      actions={actions()}
      searchBarAccessory={
        <List.Dropdown tooltip="期間（⌘P）" value={period} onChange={setPeriod}>
          <List.Dropdown.Item title="すべての期間" value="all" />
          {periods.map((value) => (
            <List.Dropdown.Item
              key={value}
              value={value}
              title={periodLabels[value]}
            />
          ))}
        </List.Dropdown>
      }
    >
      <List.EmptyView
        title={failure ? "保存データを読み込めません" : "タスクがありません"}
        description={failure ?? "⌘Nで追加 · ⌘Pで期間を切替"}
        icon={Icon.CheckList}
        actions={actions()}
      />
      {periods
        .filter((value) => period === "all" || period === value)
        .map((value) => {
          const items = (plans ?? [])
            .filter(
              (plan) =>
                plan.period === value &&
                `${plan.title}\n${plan.note}`
                  .toLocaleLowerCase()
                  .includes(query),
            )
            .sort((a, b) => Number(a.done) - Number(b.done));
          return (
            <List.Section key={value} title={periodLabels[value]}>
              {items.map((plan, index) => (
                <List.Item
                  key={plan.id}
                  id={plan.id}
                  title={plan.title}
                  subtitle={plan.note.split("\n").find((line) => line.trim())}
                  icon={{
                    source: plan.done ? Icon.CheckCircle : Icon.Circle,
                    tintColor: plan.done ? Color.Green : Color.SecondaryText,
                  }}
                  accessories={plan.done ? [{ text: "完了" }] : []}
                  actions={actions(plan, items[index - 1], items[index + 1])}
                />
              ))}
            </List.Section>
          );
        })}
    </List>
  );
}
