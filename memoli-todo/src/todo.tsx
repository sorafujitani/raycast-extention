import {
  Action,
  ActionPanel,
  Alert,
  Color,
  Form,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useRef, useState } from "react";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { saveChange, tasksFrom, type Change, type Task } from "./store";

const path = join(homedir(), ".memoli/memo/todo.md");
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
          {titleFocused && <Action title="メモに移動" shortcut={{ modifiers: [], key: "return" }} onAction={() => noteRef.current?.focus()} />}
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
  function refresh() {
    try {
      setText(readFileSync(path, "utf8"));
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
      saveChange(path, snapshot, change);
      refresh();
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
    const save = (change: Change) =>
      snapshot === undefined
        ? Promise.resolve(false)
        : mutate(change, snapshot);
    return (
      <ActionPanel>
        {task && (
          <Action
            title={task.done ? "未完了に戻す" : "完了にする"}
            icon={Icon.CheckCircle}
            onAction={() => save({ kind: "toggle", task })}
          />
        )}
        {snapshot !== undefined && (
          <Action.Push
            title="タスクを追加"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            target={<TaskForm initialTitle={search} onSave={save} />}
          />
        )}
        {task && (
          <Action.Push
            title="タスクを編集"
            icon={Icon.Pencil}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            target={<TaskForm task={task} onSave={save} />}
          />
        )}
        <Action
          title="再読み込み"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={refresh}
        />
        <Action.Open
          title="Markdownファイルを開く"
          target={path}
          shortcut={{ modifiers: ["cmd"], key: "o" }}
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
      </ActionPanel>
    );
  }
  const tasks = tasksFrom(text ?? "").filter(
    (task) => filter === "all" || task.done === (filter === "done"),
  );
  return (
    <List
      isLoading={text === undefined && !failure}
      searchBarPlaceholder="タスクを検索…（⌘Nで追加）"
      onSearchTextChange={setSearch}
      actions={actions()}
      searchBarAccessory={
        <List.Dropdown
          tooltip="表示するタスク"
          value={filter}
          onChange={setFilter}
        >
          <List.Dropdown.Item title="未完了" value="todo" />
          <List.Dropdown.Item title="完了" value="done" />
          <List.Dropdown.Item title="すべて" value="all" />
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
          title={task.title || "（空のタスク）"}
          subtitle={task.note.split("\n").find((line) => line.trim())}
          keywords={task.note ? [task.note] : []}
          icon={
            task.done
              ? { source: Icon.CheckCircle, tintColor: Color.Green }
              : Icon.Circle
          }
          accessories={[{ text: task.done ? "完了" : "未完了" }]}
          actions={actions(task)}
        />
      ))}
    </List>
  );
}
