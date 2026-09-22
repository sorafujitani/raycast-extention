import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
const pathsFrom = (output) => output.split("\0").filter(Boolean);

// --no-index also checks files added with git add -f.
export function blockedPaths(paths) {
  if (!paths.length) return [];
  const result = spawnSync(
    "git",
    ["check-ignore", "--no-index", "--stdin", "-z"],
    {
      cwd: root,
      input: [...new Set(paths)].join("\0") + "\0",
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1)
    throw new Error(result.stderr || "git check-ignore failed");
  return pathsFrom(result.stdout);
}

// Check every outgoing commit, not just HEAD: deleting a secret later is not enough.
export function outgoingPaths(input) {
  const paths = [];
  for (const line of input.trim().split("\n").filter(Boolean)) {
    const fields = line.trim().split(/\s+/);
    const [, local, , remote] = fields;
    if (
      fields.length !== 4 ||
      ![local, remote].every((sha) =>
        /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha),
      )
    )
      throw new Error("Invalid pre-push input");
    if (/^0+$/.test(local)) continue; // Remote branch deletion publishes no files.
    const range = /^0+$/.test(remote) ? [local] : [local, `^${remote}`];
    const commits = git("rev-list", ...range)
      .trim()
      .split("\n")
      .filter(Boolean);
    for (const commit of commits) {
      paths.push(
        ...pathsFrom(
          git(
            "diff-tree",
            "--root",
            "-m",
            "--no-commit-id",
            "--name-only",
            "--diff-filter=ACMRT",
            "-r",
            "-z",
            commit,
          ),
        ),
      );
    }
  }
  return paths;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const paths = pathsFrom(git("ls-files", "--cached", "-z"));
    if (process.argv.includes("--pre-push"))
      paths.push(...outgoingPaths(readFileSync(0, "utf8")));
    const blocked = blockedPaths(paths);
    if (blocked.length)
      throw new Error(
        `公開対象外のファイルを検出しました:\n${blocked.join("\n")}\n公開対象は.gitignoreの許可リストを確認してください。`,
      );
    console.log("Public-file allowlist check passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
