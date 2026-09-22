import { saveSnapshot } from "./data-files";

export const statuses = ["todo", "inprogress", "pend", "done"] as const;
export type Status = (typeof statuses)[number];
export const triages = ["low", "mid", "high"] as const;
export type Triage = (typeof triages)[number];
export type Task = {
  line: number;
  title: string;
  status: Status;
  triage: Triage;
  note: string;
};
// Keep legacy term comments hidden and intact when editing existing tasks.
const metadataTags =
  /(?:[\t ]+<!-- (?:triage:(?:low|mid|high)|term:(?:daily|week|month|future)) -->)+$/;
function titleFrom(raw: string) {
  const tag = raw.match(metadataTags);
  const suffix = tag?.[0] ?? "";
  return {
    title: tag ? raw.slice(0, tag.index) : raw,
    triage: (suffix.match(/<!-- triage:(low|mid|high) -->/)?.[1] ??
      "mid") as Triage,
    suffix,
  };
}
const markers: Record<Status, string> = {
  todo: " ",
  inprogress: "/",
  pend: "-",
  done: "x",
};
const checkbox = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX/-])(\]\s+)(.*)$/;
const statusFrom = (marker: string): Status =>
  marker === "/"
    ? "inprogress"
    : marker === "-"
      ? "pend"
      : marker.toLowerCase() === "x"
        ? "done"
        : "todo";

function noteAt(lines: string[], line: number) {
  const prefix = (lines[line].match(/^[\t ]*/)?.[0] ?? "") + "  >";
  const content: string[] = [];
  for (let i = line + 1; i < lines.length; i++) {
    if (lines[i] !== prefix && !lines[i].startsWith(prefix + " ")) break;
    content.push(lines[i].slice(prefix.length + 1));
  }
  return { note: content.join("\n"), count: content.length, prefix };
}

export function tasksFrom(text: string): Task[] {
  const tasks: Task[] = [];
  let fence: string | undefined;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        line.slice(marker[0].length).trim() === ""
      )
        fence = undefined;
      return;
    }
    if (fence) return;
    const match = line.match(checkbox);
    if (match)
      tasks.push({
        line: index,
        title: titleFrom(match[4]).title,
        triage: titleFrom(match[4]).triage,
        status: statusFrom(match[2]),
        note: noteAt(lines, index).note,
      });
  });
  return tasks;
}

export type Change =
  | { kind: "add"; title: string; note?: string }
  | { kind: "edit"; task: Task; title: string; note?: string }
  | { kind: "delete-done" }
  | { kind: "toggle" | "delete"; task: Task }
  | { kind: "status"; task: Task; status: Status }
  | { kind: "triage"; task: Task; direction: -1 | 1 }
  | { kind: "move"; task: Task; target: Task };

function swapTasks(text: string, task: Task, target: Task): string {
  const lines = text.split(/\r?\n/);
  const tasks = tasksFrom(text);
  const currentTarget = tasks.find((item) => item.line === target.line);
  if (
    !currentTarget ||
    currentTarget.title !== target.title ||
    currentTarget.status !== target.status ||
    currentTarget.triage !== target.triage ||
    currentTarget.note !== target.note
  )
    throw new Error("移動先が変更されています。一覧を更新してください");
  if (task.line === target.line) return text;
  const [first, last] =
    task.line < target.line ? [task, target] : [target, task];
  const indent = (line: string) => line.match(/^[\t ]*/)?.[0] ?? "";
  const prefix = indent(lines[first.line]);
  const between = tasks.filter(
    (item) => item.line >= first.line && item.line <= last.line,
  );
  const firstEnd = first.line + 1 + noteAt(lines, first.line).count;
  const lastEnd = last.line + 1 + noteAt(lines, last.line).count;
  // Do not detach children or move tasks across headings / unrelated Markdown.
  for (let i = 0; i < between.length; i++) {
    const item = between[i];
    const end = item.line + 1 + noteAt(lines, item.line).count;
    const next = between[i + 1]?.line ?? lastEnd;
    if (
      indent(lines[item.line]) !== prefix ||
      lines.slice(end, next).some((line) => line.trim())
    )
      throw new Error("並べ替えは同じ階層の連続したTODO内で行ってください");
  }
  let following = lastEnd;
  while (following < lines.length && !lines[following].trim()) following++;
  if (
    following < lines.length &&
    indent(lines[following]).length > prefix.length
  )
    throw new Error("子項目があるTODOは並べ替えできません");
  return [
    ...lines.slice(0, first.line),
    ...lines.slice(last.line, lastEnd),
    ...lines.slice(firstEnd, last.line),
    ...lines.slice(first.line, firstEnd),
    ...lines.slice(lastEnd),
  ].join(text.includes("\r\n") ? "\r\n" : "\n");
}

export function applyChange(text: string, change: Change): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (change.kind === "delete-done") {
    const done = tasksFrom(text).filter((task) => task.status === "done");
    if (!done.length) return text;
    for (const task of done.reverse()) {
      lines.splice(task.line, 1 + noteAt(lines, task.line).count);
    }
    return lines.join(newline);
  }
  let title = "";
  let note = "";
  if (change.kind === "add" || change.kind === "edit") {
    note = (
      change.note ?? (change.kind === "edit" ? change.task.note : "")
    ).replace(/\r\n?/g, "\n");
    if (note.includes("\u0000"))
      throw new Error("メモに使用できない文字が含まれています");
    title = change.title.trim();
    if (metadataTags.test(title))
      throw new Error("タスク名の末尾に管理用のコメントは使えません");
    if (!title || /[\r\n]/.test(title) || title.includes("\u0000"))
      throw new Error("タスクは空でない1行で入力してください");
  }
  if (change.kind === "add") {
    // Refuse an append that would turn the new task into fenced code.
    const next =
      text +
      (text && !text.endsWith("\n") ? newline : "") +
      `- [ ] ${title}${newline}` +
      (note
        ? note
            .split("\n")
            .map((line) => `  > ${line}${newline}`)
            .join("")
        : "");
    if (tasksFrom(next).length !== tasksFrom(text).length + 1)
      throw new Error("Markdownのコードブロックを閉じてから追加してください");
    return next;
  }
  const match = lines[change.task.line]?.match(checkbox);
  if (
    !match ||
    titleFrom(match[4]).title !== change.task.title ||
    titleFrom(match[4]).triage !== change.task.triage ||
    statusFrom(match[2]) !== change.task.status
  )
    throw new Error("タスクが変更されています。一覧を更新してください");
  const existingNote = noteAt(lines, change.task.line);
  if (existingNote.note !== change.task.note)
    throw new Error("メモが変更されています。一覧を更新してください");
  if (change.kind === "move")
    return swapTasks(text, change.task, change.target);
  if (change.kind === "delete")
    lines.splice(change.task.line, 1 + existingNote.count);
  else {
    if (change.kind === "edit" && note !== existingNote.note) {
      lines.splice(
        change.task.line + 1,
        existingNote.count,
        ...(note
          ? note.split("\n").map((line) => `${existingNote.prefix} ${line}`)
          : []),
      );
    }
    let marker = match[2];
    if (change.kind === "toggle")
      marker = change.task.status === "done" ? " " : "x";
    if (change.kind === "status") {
      if (!statuses.includes(change.status))
        throw new Error("不明なstatusです");
      if (change.status === change.task.status) return text;
      marker = markers[change.status];
    }
    let rawTitle =
      change.kind === "edit" ? title + titleFrom(match[4]).suffix : match[4];
    if (change.kind === "triage") {
      const index = Math.max(
        0,
        Math.min(
          triages.length - 1,
          triages.indexOf(change.task.triage) + change.direction,
        ),
      );
      const next = triages[index];
      if (next === change.task.triage) return text;
      const suffix = titleFrom(match[4]).suffix.replace(
        /[\t ]+<!-- triage:(low|mid|high) -->/g,
        "",
      );
      rawTitle = `${change.task.title}${suffix} <!-- triage:${next} -->`;
    }
    lines[change.task.line] = match[1] + marker + match[3] + rawTitle;
  }
  return lines.join(newline);
}

export function saveChange(
  path: string,
  snapshot: string,
  change: Change,
): string {
  return saveSnapshot(path, snapshot, applyChange(snapshot, change));
}
