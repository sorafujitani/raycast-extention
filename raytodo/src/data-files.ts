import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export function dataPaths(home = homedir()) {
  return {
    todo: join(home, ".raytodo", "todo.md"),
    plans: join(home, ".rayteam", "plans.json"),
  };
}

export function ensureDataFile(path: string, initial: () => string) {
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const content = initial();
  try {
    writeFileSync(path, content, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export function initializeTodo(home = homedir()) {
  const path = dataPaths(home).todo;
  ensureDataFile(path, () => "# raytodo\n");
  return path;
}

export function initializePlans(home = homedir()) {
  const path = dataPaths(home).plans;
  ensureDataFile(path, () => "[]\n");
  return path;
}

export function saveSnapshot(
  path: string,
  snapshot: string,
  next: string,
): string {
  const lock = path + ".raycast.lock";
  const fd = openSync(lock, "wx", 0o600);
  const temp = path + `.raycast-${process.pid}.tmp`;
  try {
    const current = readFileSync(path, "utf8");
    if (current !== snapshot)
      throw new Error(
        "ファイルが外部で変更されています。一覧を更新してやり直してください",
      );
    if (next === current) return current;
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
    return next;
  } finally {
    try {
      rmSync(temp, { force: true });
    } finally {
      closeSync(fd);
      unlinkSync(lock);
    }
  }
}
