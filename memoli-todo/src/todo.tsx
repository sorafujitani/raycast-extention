import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  Keyboard,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { readFileSync } from "node:fs";
import { dataPaths, initializeTodo } from "./data-files";
import { SwitchCommandAction } from "./switch-command";
import {
  saveChange,
  statuses,
  tasksFrom,
  type Change,
  type Task,
} from "./store";

const statusIcons = {
  todo: Icon.Circle,
  inprogress: Icon.Clock,
  pend: Icon.Pause,
  done: Icon.CheckCircle,
};
const statusColors = {
  todo: Color.SecondaryText,
  inprogress: Color.Blue,
  pend: "#C4B5FD",
  done: Color.Green,
};
const triageColors = {
  low: Color.SecondaryText,
  mid: Color.Yellow,
  high: "#67D4F5",
};

const path = dataPaths().todo;
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function TaskForm({
  task,
  initialTitle,
  onSave,
}: {
  task?: Task;
  initialTitle?: string;
  onSave: (change: Change) => Promise<boolean>;
}) {
  const { pop } = useNavigation();
  const [error, setError] = useState<string>();
  const [titleFocused, setTitleFocused] = useState(true);
  const noteRef = useRef<Form.TextArea>(null);
  return (
    <Form
      navigationTitle={task ? "タスクを編集" : "タスクを追加"}
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={task ? "保存" : "タスクを作成"}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            onSubmit={async (values: { title: string; note: string }) => {
              if (!values.title.trim()) {
                setError("タスクを入力してください");
                return;
              }
              if (
                await onSave(
                  task
                    ? {
                        kind: "edit",
                        task,
                        title: values.title,
                        note: values.note,
                      }
                    : { kind: "add", title: values.title, note: values.note },
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
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="タスク"
        defaultValue={task?.title ?? initialTitle}
        error={error}
        onChange={() => setError(undefined)}
        autoFocus
        onFocus={() => setTitleFocused(true)}
      />
      <Form.TextArea
        id="note"
        title="メモ"
        defaultValue={task?.note ?? ""}
        ref={noteRef}
        onFocus={() => setTitleFocused(false)}
      />
    </Form>
  );
}

export default function Command() {
  const [text, setText] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const matches = (task: Task) =>
    (filter === "all" || task.status === filter) &&
    `${task.title}\n${task.note}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase());
  const allTasks = tasksFrom(text ?? "");
  const tasks = allTasks.filter(matches);
  const doneCount = allTasks.filter((task) => task.status === "done").length;
  function refresh() {
    try {
      setText(readFileSync(initializeTodo(), "utf8"));
      setFailure(undefined);
    } catch (error) {
      setText(undefined);
      setFailure(message(error));
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function mutate(change: Change, snapshot: string): Promise<boolean> {
    try {
      const next = saveChange(path, snapshot, change);
      const after = tasksFrom(next);
      const index =
        change.kind === "add"
          ? after.length - 1
          : change.kind === "delete-done"
            ? 0
            : tasksFrom(snapshot).findIndex(
                (task) =>
                  task.line ===
                  (change.kind === "move"
                    ? change.target.line
                    : change.task.line),
              );
      const selected = after[Math.min(index, after.length - 1)];
      setText(next);
      setFailure(undefined);
      setSelectedId(
        selected && matches(selected) ? String(selected.line) : undefined,
      );
      if (
        change.kind !== "move" &&
        change.kind !== "triage" &&
        change.kind !== "status"
      )
        await showToast({ style: Toast.Style.Success, title: "保存しました" });
      return true;
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "保存できませんでした",
        message: message(error),
      });
      refresh();
      return false;
    }
  }
  function actions(task?: Task) {
    // Each form keeps the snapshot it was opened with, so external edits cannot be overwritten.
    const snapshot = text;
    const statusIndex = task ? statuses.indexOf(task.status) : 0;
    const index = task
      ? tasks.findIndex((item) => item.line === task.line)
      : -1;
    const save = (change: Change) =>
      snapshot === undefined
        ? Promise.resolve(false)
        : mutate(change, snapshot);
    return (
      <ActionPanel>
        {task && (
          <ActionPanel.Submenu
            autoFocus
            title="状態を変更"
            icon={statusIcons[task.status]}
          >
            {statuses.map((status) => (
              <Action
                key={status}
                title={status}
                icon={statusIcons[status]}
                onAction={() => save({ kind: "status", task, status })}
              />
            ))}
          </ActionPanel.Submenu>
        )}
        {task && (
          <Action
            title={task.status === "done" ? "未着手に戻す" : "完了にする"}
            icon={Icon.CheckCircle}
            shortcut={{ modifiers: [], key: "return" }}
            onAction={() => save({ kind: "toggle", task })}
          />
        )}
        {task && (
          <ActionPanel.Section>
            <Action
              title="前の状態に変更"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["cmd"], key: "arrowLeft" }}
              onAction={() =>
                save({
                  kind: "status",
                  task,
                  status: statuses[Math.max(0, statusIndex - 1)],
                })
              }
            />
            <Action
              title="次の状態に変更"
              icon={Icon.ArrowRight}
              shortcut={{ modifiers: ["cmd"], key: "arrowRight" }}
              onAction={() =>
                save({
                  kind: "status",
                  task,
                  status:
                    statuses[Math.min(statuses.length - 1, statusIndex + 1)],
                })
              }
            />
            <Action
              title="上に移動"
              icon={Icon.ArrowUp}
              shortcut={{ modifiers: ["shift"], key: "arrowUp" }}
              onAction={() =>
                tasks[index - 1] &&
                save({ kind: "move", task, target: tasks[index - 1] })
              }
            />
            <Action
              title="下に移動"
              icon={Icon.ArrowDown}
              shortcut={{ modifiers: ["shift"], key: "arrowDown" }}
              onAction={() =>
                tasks[index + 1] &&
                save({ kind: "move", task, target: tasks[index + 1] })
              }
            />
            <Action
              title="優先度を下げる"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["shift"], key: "arrowLeft" }}
              onAction={() => save({ kind: "triage", task, direction: -1 })}
            />
            <Action
              title="優先度を上げる"
              icon={Icon.ArrowRight}
              shortcut={{ modifiers: ["shift"], key: "arrowRight" }}
              onAction={() => save({ kind: "triage", task, direction: 1 })}
            />
          </ActionPanel.Section>
        )}
        {snapshot !== undefined && (
          <Action.Push
            title="タスクを追加"
            icon={Icon.Plus}
            shortcut={Keyboard.Shortcut.Common.New}
            target={<TaskForm initialTitle={search} onSave={save} />}
          />
        )}
        {task && (
          <Action.Push
            title="タスクを編集"
            icon={Icon.Pencil}
            shortcut={Keyboard.Shortcut.Common.Edit}
            target={<TaskForm task={task} onSave={save} />}
          />
        )}
        <Action
          title="再読み込み"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={refresh}
        />
        <SwitchCommandAction target="horizon" />
        <Action.Open
          title="Markdownファイルを開く"
          target={path}
          shortcut={Keyboard.Shortcut.Common.Open}
        />
        {task && (
          <Action
            title="タスクを削除"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            shortcut={{ modifiers: ["ctrl"], key: "x" }}
            onAction={async () => {
              if (
                await confirmAlert({
                  title: "このタスクを削除しますか？",
                  message: task.note
                    ? `${task.title}\nメモも削除されます。`
                    : task.title,
                  primaryAction: {
                    title: "削除",
                    style: Alert.ActionStyle.Destructive,
                  },
                })
              )
                await save({ kind: "delete", task });
            }}
          />
        )}
        {doneCount > 0 && (
          <Action
            title="Doneのタスクを一括削除"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            onAction={async () => {
              if (
                await confirmAlert({
                  title: `Doneのタスク${doneCount}件を削除しますか？`,
                  message:
                    "検索・statusの絞り込みに関係なく、すべてのDoneタスクとそのメモを削除します。",
                  primaryAction: {
                    title: "一括削除",
                    style: Alert.ActionStyle.Destructive,
                  },
                })
              )
                await save({ kind: "delete-done" });
            }}
          />
        )}
      </ActionPanel>
    );
  }
  return (
    <List
      isLoading={text === undefined && !failure}
      navigationTitle="raytodo"
      searchBarPlaceholder="タスクを検索…（⌘Nで追加）"
      searchText={search}
      onSearchTextChange={setSearch}
      filtering={false}
      selectedItemId={selectedId}
      onSelectionChange={(id: string | null) => setSelectedId(id ?? undefined)}
      actions={actions()}
      searchBarAccessory={
        <List.Dropdown
          tooltip="表示するタスク（⌘P）"
          value={filter}
          onChange={setFilter}
        >
          <List.Dropdown.Item title="すべて" value="all" />
          {statuses.map((status) => (
            <List.Dropdown.Item key={status} title={status} value={status} />
          ))}
        </List.Dropdown>
      }
    >
      <List.EmptyView
        title={failure ? "ファイルを読み込めません" : "タスクがありません"}
        description={failure ?? "⌘Nで追加 · ⌘Rで再読み込み"}
        icon={Icon.CheckList}
        actions={actions()}
      />
      {tasks.map((task) => (
        <List.Item
          key={task.line}
          id={String(task.line)}
          title={task.title || "（空のタスク）"}
          subtitle={task.note.split("\n").find((line) => line.trim())}
          icon={{
            source: statusIcons[task.status],
            tintColor: statusColors[task.status],
          }}
          accessories={[
            { tag: { value: task.triage, color: triageColors[task.triage] } },
          ]}
          actions={actions(task)}
        />
      ))}
    </List>
  );
}
