# GH Assigned

Find your PRs, review requests, and assigned PRs in Raycast.

## Install locally

Requires macOS, Raycast, Node.js **22.22.2+**, and GitHub CLI. Set up `gh-assigned` if you have not already:

```sh
gh auth login
gh extension install sorafujitani/gh-assigned
gh assigned --json
```

From the [repository root](../README.md#ローカルに登録), use either package manager.

### npm

```sh
npm install --workspace=gh-assigned --include-workspace-root
npm run dev --workspace=gh-assigned
```

### pnpm 11.18.0

```sh
pnpm --filter gh-assigned install --frozen-lockfile
pnpm --filter gh-assigned dev
```

Only this extension and shared development tools are installed. Once built, press Ctrl+C and open **Search Pull Requests** in Raycast. Authentication uses `gh`; no separate GitHub token is needed.

## Controls

| Key          | Action                                    |
| ------------ | ----------------------------------------- |
| Type         | Filter the list                           |
| ⌘1 / ⌘2 / ⌘3 | Mine / Review requested / Assigned        |
| ⌘F           | Search field: all / repo / title / author |
| ⌘T           | Match type: fuzzy / substring / exact     |
| Enter        | Open PR                                   |
| ⌘⇧C          | Copy PR URL                               |
| ⌘⇧N          | Copy PR number                            |
| ⌘R           | Refresh                                   |
| ⌘K           | Actions and setup help                    |

PR stacks show dependencies, drafts, CI checks, and review decisions. Cached results stay visible if a refresh fails.

If fetching fails, run `gh assigned --json` in Terminal. For search rules, executable paths, and other fixes, see the [usage guide](docs/usage.md).
