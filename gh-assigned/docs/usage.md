# GH Assigned usage guide

[Installation and controls](../README.md)

## Search and stacks

The dropdown also switches between Mine, Review requested, and Assigned. Searches ignore case. Fuzzy search matches characters in order (`ghas` matches `gh-assigned`) and preserves stack order rather than ranking results. Exact search compares the whole selected field and is unavailable for `all`. Repository search uses the short name, without the owner.

Each stack has its own section labeled with the repository and root PR number. Tree connectors distinguish siblings from deeper dependencies; `on #123` identifies the immediate parent. Stack rows put their PR number first and omit the repeated repository name. Search keeps the original section and parent labels even when those PRs do not match.

Cached results appear while all three lists and CI statuses refresh together. Each list contains up to 100 open PRs, excluding archived repositories, as in the CLI. On refresh failure, cached results stay visible with a warning. GitHub authentication and the active account come from `gh`.

Browser opening uses Raycast's default browser action, not the CLI's `GH_BROWSER` preference. Fetches time out after 60 seconds. PR data is cached locally by Raycast in addition to the CLI's own cache.

## Troubleshooting

- **GitHub CLI not found:** set **GitHub CLI Path** in the extension preferences to the absolute path printed by `command -v gh`. Homebrew and the user Nix profile are checked automatically; Raycast does not load shell aliases or interactive shell configuration.
- **Authentication, missing extension, or fetch error:** run `gh assigned --json` in Terminal and resolve its error first. Setup commands can also be copied from the action menu.
- **Unexpected output:** upgrade with `gh extension upgrade gh-assigned`, or rebuild your locally linked CLI.

## Updating and checking changes

After source updates, repeat the selected install and dev commands in the README. Alternatively, after installing dependencies, use Raycast's **Import Extension** command and select `gh-assigned/`.

Run these from the repository root:

```sh
pnpm --filter gh-assigned test
pnpm --filter gh-assigned lint:raycast
pnpm --filter gh-assigned build
```

The build writes to `dist/`; `pnpm --filter gh-assigned dev` registers the command in Raycast. Tests cover the JSON contract, stack ordering, search modes, executable paths, and command failures without contacting GitHub.
