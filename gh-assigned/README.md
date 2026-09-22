# GH Assigned for Raycast

Search **Mine**, **Review requested**, and **Assigned** pull requests from Raycast. See dependent PRs, drafts, CI checks, and review decisions; open a PR or copy its URL/number.

## Install locally

Requires macOS, Raycast, Node.js **22.22.2+**, and an authenticated GitHub CLI with gh-assigned installed. This extension uses `gh assigned --json`; it does not need a separate GitHub token.

In Terminal:

```sh
gh auth login
gh extension install sorafujitani/gh-assigned
gh assigned --json
```

Skip login or extension installation if already configured. From this repository:

```sh
pnpm install --frozen-lockfile
pnpm --filter gh-assigned dev
```

Once the build is ready, launch **Search Pull Requests** under **GH Assigned** in Raycast. You can stop the development watcher with `ctrl-c`; the locally installed command remains available. Run `pnpm install --frozen-lockfile` and `pnpm --filter gh-assigned dev` from the workspace root again after updating the source.

Alternatively, use Raycast's **Import Extension** command and select this `gh-assigned/` directory after `pnpm install --frozen-lockfile`.

## Controls

| Key                | Action                                          |
| ------------------ | ----------------------------------------------- |
| Type               | Filter the current list                         |
| `⌘1` / `⌘2` / `⌘3` | Mine / Review requested / Assigned              |
| `⌘F`               | Cycle search field: all / repo / title / author |
| `⌘T`               | Cycle match type: fuzzy / substring / exact     |
| `Enter`            | Open the selected PR in your default browser    |
| `⌘⇧C`              | Copy PR URL                                     |
| `⌘⇧N`              | Copy PR number                                  |
| `⌘R`               | Fetch fresh data                                |
| `⌘K`               | Open actions, search options, and setup help    |

The dropdown also switches lists. Searches ignore case. Fuzzy search matches characters in order (`ghas` matches `gh-assigned`) and preserves stack order rather than ranking results. Exact search compares the whole selected field and is unavailable for `all`. Repository search uses the short name, without the owner.

Each stack has its own section labeled with the repository and root PR number. Tree connectors distinguish siblings from deeper dependencies; `on #123` identifies the immediate parent. Stack rows put their PR number first and omit the repeated repository name. Search keeps the original section and parent labels even when those PRs do not match.

Cached results appear while all three lists and CI statuses refresh together. Each list contains up to 100 open PRs, excluding archived repositories, as in the CLI. On refresh failure, cached results stay visible with a warning. GitHub authentication and the active account come from `gh`.

## Troubleshooting

- **GitHub CLI not found:** set **GitHub CLI Path** in the extension preferences to the absolute path printed by `command -v gh`. Homebrew and the user Nix profile are checked automatically; Raycast does not load shell aliases or interactive shell configuration.
- **Authentication, missing extension, or fetch error:** run `gh assigned --json` in Terminal and resolve its error first. Setup commands can also be copied from the action menu.
- **Unexpected output:** upgrade with `gh extension upgrade gh-assigned`, or rebuild your locally linked CLI.

Browser opening uses Raycast's default browser action, not the CLI's `GH_BROWSER` preference. Fetches time out after 60 seconds. PR data is cached locally by Raycast in addition to the CLI's own cache.

## Check changes

```sh
# From the workspace root
pnpm --filter gh-assigned test
pnpm --filter gh-assigned lint:raycast
pnpm --filter gh-assigned build
```

The build writes to `dist/`; `pnpm --filter gh-assigned dev` installs the command into Raycast. Tests cover the JSON contract, stack ordering, search modes, executable paths, and command failures without contacting GitHub.
