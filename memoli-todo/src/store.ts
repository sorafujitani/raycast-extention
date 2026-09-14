import {
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  openSync,
  closeSync,
  statSync,
} from "node:fs";

export type Task = { line: number; title: string; done: boolean; note: string };
const checkbox = /^(\s*(?:[-+*]|\d+[.)])\s+\[)([ xX])(\]\s+)(.*)$/;

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
        title: match[4],
        done: match[2] !== " ",
        note: noteAt(lines, index).note,
      });
  });
  return tasks;
}

export type Change =
  | { kind: "add"; title: string; note?: string }
  | { kind: "edit"; task: Task; title: string; note?: string }
  | { kind: "toggle" | "delete"; task: Task };

export function applyChange(text: string, change: Change): string {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  let title = "";
  let note = "";
  if (change.kind === "add" || change.kind === "edit") {
    note = (
      change.note ?? (change.kind === "edit" ? change.task.note : "")
    ).replace(/\r\n?/g, "\n");
    if (note.includes("\u0000"))
      throw new Error("メモに使用できない文字が含まれています");
    title = change.title.trim();
    if (!title || /[\r\n\u0000]/.test(title))
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
    match[4] !== change.task.title ||
    (match[2] !== " ") !== change.task.done
  )
    throw new Error("タスクが変更されています。一覧を更新してください");
  const existingNote = noteAt(lines, change.task.line);
  if (existingNote.note !== change.task.note)
    throw new Error("メモが変更されています。一覧を更新してください");
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
    lines[change.task.line] =
      match[1] +
      (change.kind === "toggle" ? (change.task.done ? " " : "x") : match[2]) +
      match[3] +
      (change.kind === "edit" ? title : match[4]);
  }
  return lines.join(newline);
}

export function saveChange(
  path: string,
  snapshot: string,
  change: Change,
): void {
  const lock = path + ".raycast.lock";
  const fd = openSync(lock, "wx", 0o600);
  const temp = path + `.raycast-${process.pid}.tmp`;
  try {
    const current = readFileSync(path, "utf8");
    if (current !== snapshot)
      throw new Error(
        "ファイルが外部で変更されています。一覧を更新してやり直してください",
      );
    const next = applyChange(current, change);
    writeFileSync(path + ".raycast.bak", current, { mode: 0o600 });
    writeFileSync(temp, next, {
      mode: statSync(path).mode & 0o777,
      flag: "wx",
    });
    if (readFileSync(path, "utf8") !== current)
      throw new Error(
        "保存中にファイルが変更されました。再読み込みしてください",
      );
    renameSync(temp, path);
  } finally {
    try {
      unlinkSync(temp);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    closeSync(fd);
    unlinkSync(lock);
  }
}
