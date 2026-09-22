import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "vite-plus/test";
import {
  arrange,
  cliEnvironment,
  fetchSnapshot,
  groupStacks,
  matches,
  parseSnapshot,
  type PullRequest,
} from "../src/pulls.ts";

function pr(
  number: number,
  base_ref = "main",
  head_ref = `branch-${number}`,
  repo = "owner/gh-assigned",
): PullRequest {
  return {
    repo,
    number,
    title: "Add fuzzy search modes",
    url: `https://github.com/${repo}/pull/${number}`,
    author: "octocat",
    is_draft: false,
    base_ref,
    head_ref,
    checks: "Success",
    review: "Approved",
  };
}

test("accepts all three lists and all CLI status values; rejects malformed output and unsafe URLs", () => {
  const snapshot = {
    lists: [
      [pr(1)],
      [{ ...pr(2), checks: "Failure", review: "ChangesRequested" }],
      [
        { ...pr(3), checks: "Pending", review: "Pending" },
        {
          ...pr(4),
          checks: "None",
          review: "None",
          author: "",
          is_draft: true,
        },
      ],
    ],
  };
  assert.deepEqual(parseSnapshot(JSON.stringify(snapshot)), snapshot);
  assert.deepEqual(parseSnapshot('{"lists":[[],[],[]]}').lists, [[], [], []]);
  for (const value of [null, {}, { lists: [] }, { lists: [[], [], [null]] }]) {
    assert.throws(() => parseSnapshot(JSON.stringify(value)), /Unexpected/);
  }
  for (const override of [
    { url: "javascript:alert(1)" },
    { url: "https://user:secret@github.com" },
    { number: -1 },
    { author: null },
    { checks: "Unknown" },
  ]) {
    assert.throws(() =>
      parseSnapshot(
        JSON.stringify({ lists: [[{ ...pr(1), ...override }], [], []] }),
      ),
    );
  }
  assert.throws(() => parseSnapshot("not json"), /Invalid JSON/);
});

test("stacks preserve sibling order and repository boundaries; cycles and self-links are listed once", () => {
  const prs = [
    pr(3, "b", "c"),
    pr(1, "main", "a"),
    pr(2, "a", "b"),
    pr(4),
    pr(5, "a", "b", "other/repo"),
  ];
  const shape = (values: PullRequest[]) =>
    arrange(values).map(({ pr, depth }) => [pr.number, depth]);
  assert.deepEqual(shape(prs), [
    [1, 0],
    [2, 1],
    [3, 2],
    [4, 0],
    [5, 0],
  ]);
  assert.deepEqual(shape([pr(1, "b", "a"), pr(2, "a", "b"), pr(3, "c", "c")]), [
    [3, 0],
    [1, 0],
    [2, 0],
  ]);
  assert.deepEqual(shape([]), []);
  assert.equal(prs[0].number, 3);
});

test("stack sections and connectors distinguish siblings, descendants, and hidden parents", () => {
  const groups = groupStacks(
    arrange([
      pr(10),
      pr(1, "main", "a"),
      pr(2, "a", "b"),
      { ...pr(3, "b", "c"), title: "nested match" },
      pr(4, "a", "d"),
      pr(5, "d", "e"),
      pr(11),
      pr(12, "a", "f", "other/repo"),
    ]),
  );
  assert.deepEqual(
    groups.map(({ root, rows }) => [
      root?.number,
      rows.map(({ pr }) => pr.number),
    ]),
    [
      [undefined, [10]],
      [1, [1, 2, 3, 4, 5]],
      [undefined, [11, 12]],
    ],
  );
  assert.deepEqual(
    groups[1].rows.map(({ pr, prefix, parent }) => [
      pr.number,
      prefix,
      parent?.number,
    ]),
    [
      [1, "", undefined],
      [2, "├─ ", 1],
      [3, "│  └─ ", 2],
      [4, "└─ ", 1],
      [5, "　 └─ ", 4],
    ],
  );
  const filtered = groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter(({ pr }) =>
        matches(pr, "nested match", "title", "exact"),
      ),
    }))
    .filter(({ rows }) => rows.length);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].root?.number, 1);
  assert.equal(filtered[0].rows[0].parent?.number, 2);
  assert.equal(filtered[0].rows[0].prefix, "│  └─ ");
  assert.deepEqual(groupStacks([]), []);
  assert.equal(
    groupStacks(arrange([pr(1, "b", "a"), pr(2, "a", "b")]))[0].root,
    undefined,
  );
});

test("search supports case-insensitive fuzzy, substring, and whole-field matches", () => {
  const value = pr(1);
  assert.equal(matches(value, "GHAS", "repo", "fuzzy"), true);
  assert.equal(matches(value, "fuzzy search", "title", "substring"), true);
  assert.equal(matches(value, "FUZZY SEARCH", "title", "exact"), false);
  assert.equal(matches(value, "gh-assigned", "repo", "exact"), true);
  assert.equal(matches(value, "owner/gh-assigned", "repo", "exact"), false);
  assert.equal(matches(value, "octocat", "all", "substring"), true);
  assert.equal(matches(value, "octocat", "title", "substring"), false);
  assert.equal(matches(value, "OCTOCAT", "author", "exact"), true);
  assert.equal(matches(value, "zzzz", "all", "fuzzy"), false);
  assert.equal(matches(value, "", "title", "exact"), true);
  assert.equal(
    matches({ ...value, title: "修正🔧テスト" }, "修🔧ト", "title", "fuzzy"),
    true,
  );
});

test("GUI environment preserves authentication and makes custom gh available to nested CLI calls", () => {
  const env = cliEnvironment("/custom tools/gh", {
    PATH: "/existing",
    GH_HOST: "github.example.com",
  });
  assert.equal(env.PATH?.split(delimiter)[0], "/custom tools");
  assert.ok(env.PATH?.split(delimiter).includes("/existing"));
  assert.ok(env.PATH?.split(delimiter).includes("/opt/homebrew/bin"));
  assert.equal(env.GH_HOST, "github.example.com");
  assert.equal(env.GH_PROMPT_DISABLED, "1");
});

test("executes gh without a shell and surfaces command failures rather than empty results", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gh assigned "));
  const file = join(dir, "gh");
  const snapshot = { lists: [[pr(1)], [], []] };
  try {
    await writeFile(
      file,
      `#!/bin/sh\n[ "$1" = assigned ] && [ "$2" = --json ] && [ "$#" = 2 ] && [ "$GH_PROMPT_DISABLED" = 1 ] || exit 7\nprintf '%s' '${JSON.stringify(snapshot)}'\n`,
      { mode: 0o755 },
    );
    assert.deepEqual(await fetchSnapshot(file), snapshot);
    await writeFile(
      file,
      "#!/bin/sh\nprintf 'authentication required' >&2\nexit 1\n",
    );
    await assert.rejects(fetchSnapshot(file), /authentication required/);
    await writeFile(file, "#!/bin/sh\nprintf 'broken JSON'\n");
    await assert.rejects(fetchSnapshot(file), /Invalid JSON/);
    await assert.rejects(fetchSnapshot(join(dir, "missing")), /ENOENT/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
