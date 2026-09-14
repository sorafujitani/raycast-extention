import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { promisify } from "node:util";

export const kinds = ["Mine", "Review requested", "Assigned"] as const;
export const scopes = ["all", "repo", "title", "author"] as const;
export const modes = ["fuzzy", "substring", "exact"] as const;
export type Scope = (typeof scopes)[number];
export type MatchMode = (typeof modes)[number];

const checks = ["Success", "Failure", "Pending", "None"] as const;
const reviews = ["Approved", "ChangesRequested", "Pending", "None"] as const;

export interface PullRequest {
  repo: string;
  number: number;
  title: string;
  url: string;
  author: string;
  is_draft: boolean;
  base_ref: string;
  head_ref: string;
  checks: (typeof checks)[number];
  review: (typeof reviews)[number];
}

export interface Snapshot {
  lists: [PullRequest[], PullRequest[], PullRequest[]];
}

export interface Row {
  pr: PullRequest;
  depth: number;
  prefix: string;
  parent?: PullRequest;
}

function isPullRequest(value: unknown): value is PullRequest {
  if (!value || typeof value !== "object") return false;
  const pr = value as Record<string, unknown>;
  const strings = ["repo", "title", "url", "author", "base_ref", "head_ref"];
  if (!strings.every((field) => typeof pr[field] === "string")) return false;
  if (!Number.isSafeInteger(pr.number) || (pr.number as number) <= 0)
    return false;
  if (typeof pr.is_draft !== "boolean") return false;
  if (!checks.some((state) => state === pr.checks)) return false;
  if (!reviews.some((state) => state === pr.review)) return false;
  try {
    const url = new URL(pr.url as string);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseSnapshot(output: string): Snapshot {
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    throw new Error(
      "Invalid JSON from gh-assigned. Upgrade gh-assigned and try again.",
    );
  }
  if (
    !value ||
    typeof value !== "object" ||
    !("lists" in value) ||
    !Array.isArray(value.lists) ||
    value.lists.length !== kinds.length ||
    !value.lists.every(
      (list: unknown) => Array.isArray(list) && list.every(isPullRequest),
    )
  ) {
    throw new Error(
      "Unexpected gh-assigned output. Upgrade gh-assigned and try again.",
    );
  }
  return value as Snapshot;
}

// Raycast does not load the user's interactive shell profile.
export function cliEnvironment(
  ghPath: string,
  env = process.env,
): NodeJS.ProcessEnv {
  const paths = [
    ...(isAbsolute(ghPath) ? [dirname(ghPath)] : []),
    env.PATH ?? "",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(homedir(), ".nix-profile/bin"),
    "/usr/bin",
    "/bin",
  ];
  return {
    ...env,
    PATH: paths.filter(Boolean).join(delimiter),
    GH_PROMPT_DISABLED: "1",
  };
}

const execFileAsync = promisify(execFile);

export async function fetchSnapshot(ghPath: string): Promise<Snapshot> {
  const file = ghPath.trim() || "gh";
  const { stdout } = await execFileAsync(file, ["assigned", "--json"], {
    env: cliEnvironment(file),
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return parseSnapshot(stdout);
}

export function shortRepo(pr: PullRequest): string {
  return pr.repo.split("/").at(-1) ?? pr.repo;
}

// Keep the ordering and cycle handling aligned with src/stack.rs.
export function arrange(prs: PullRequest[]): Row[] {
  const byHead = new Map(
    prs.map((pr, i) => [JSON.stringify([pr.repo, pr.head_ref]), i]),
  );
  const children = new Map<number, number[]>();
  const roots: number[] = [];
  prs.forEach((pr, i) => {
    const parent = byHead.get(JSON.stringify([pr.repo, pr.base_ref]));
    if (parent === undefined || parent === i) {
      roots.push(i);
    } else {
      const siblings = children.get(parent) ?? [];
      siblings.push(i);
      children.set(parent, siblings);
    }
  });
  const rows: Row[] = [];
  const seen = new Set<number>();
  const stack: (Row & { i: number; indent: string })[] = roots
    .reverse()
    .map((i) => ({
      i,
      pr: prs[i],
      depth: 0,
      prefix: "",
      indent: "",
    }));
  while (stack.length) {
    const { i, indent, ...row } = stack.pop()!;
    if (seen.has(i)) continue;
    seen.add(i);
    rows.push(row);
    const kids = children.get(i) ?? [];
    for (let index = kids.length - 1; index >= 0; index--) {
      const child = kids[index];
      const last = index === kids.length - 1;
      stack.push({
        i: child,
        pr: prs[child],
        depth: row.depth + 1,
        parent: row.pr,
        prefix: `${indent}${last ? "└─ " : "├─ "}`,
        indent: `${indent}${last ? "　 " : "│  "}`,
      });
    }
  }
  prs.forEach((pr, i) => {
    if (!seen.has(i)) rows.push({ pr, depth: 0, prefix: "" });
  });
  return rows;
}

// Group before filtering so a hidden parent does not turn its child into a root.
export function groupStacks(
  rows: Row[],
): { root?: PullRequest; rows: Row[] }[] {
  const groups: { root?: PullRequest; rows: Row[] }[] = [];
  rows.forEach((row, index) => {
    if (row.depth === 0) {
      if ((rows[index + 1]?.depth ?? 0) > 0) {
        groups.push({ root: row.pr, rows: [] });
      } else if (!groups.length || groups.at(-1)!.root) {
        groups.push({ rows: [] });
      }
    }
    groups.at(-1)!.rows.push(row);
  });
  return groups;
}

export function matches(
  pr: PullRequest,
  query: string,
  scope: Scope,
  mode: MatchMode,
): boolean {
  if (!query) return true;
  const fields = { repo: shortRepo(pr), title: pr.title, author: pr.author };
  const text = (
    scope === "all" ? Object.values(fields).join(" ") : fields[scope]
  ).toLowerCase();
  const needle = query.toLowerCase();
  if (mode === "exact") return text === needle;
  if (mode === "substring") return text.includes(needle);
  // Subsequence matching keeps stacks in order, rather than sorting parents away from children.
  let position = 0;
  for (const char of needle) {
    position = text.indexOf(char, position);
    if (position === -1) return false;
    position += char.length;
  }
  return true;
}
