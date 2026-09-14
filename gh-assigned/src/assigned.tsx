import {
  Action,
  ActionPanel,
  Color,
  getPreferenceValues,
  Icon,
  Keyboard,
  List,
  openExtensionPreferences,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import {
  arrange,
  fetchSnapshot,
  groupStacks,
  kinds,
  matches,
  modes,
  scopes,
  shortRepo,
  type MatchMode,
  type PullRequest,
  type Scope,
} from "./pulls";

const ci = {
  Success: { source: Icon.CheckCircle, tintColor: Color.Green },
  Failure: { source: Icon.XMarkCircle, tintColor: Color.Red },
  Pending: { source: Icon.Clock, tintColor: Color.Yellow },
  None: { source: Icon.Minus, tintColor: Color.SecondaryText },
};
const review = {
  Approved: { text: "Approved", color: Color.Green },
  ChangesRequested: { text: "Changes requested", color: Color.Red },
  Pending: { text: "Review needed", color: Color.Yellow },
  None: { text: "No review", color: Color.SecondaryText },
};
const setup =
  "gh auth login\ngh extension install sorafujitani/gh-assigned\ngh assigned --json";

export default function Command() {
  const { ghPath = "" } = getPreferenceValues<{ ghPath?: string }>();
  const [kind, setKind] = useState("0");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [mode, setMode] = useState<MatchMode>("fuzzy");
  const { data, error, isLoading, revalidate } = useCachedPromise(
    fetchSnapshot,
    [ghPath],
    {
      failureToastOptions: {
        title: "Could not load pull requests",
        primaryAction: {
          title: "Open Extension Preferences",
          onAction: openExtensionPreferences,
        },
      },
    },
  );
  const prs = data?.lists[Number(kind)] ?? [];
  const groups = groupStacks(arrange(prs))
    .map((group) => ({
      ...group,
      total: group.rows.length,
      rows: group.rows.filter(({ pr }) => matches(pr, query, scope, mode)),
    }))
    .filter((group) => group.rows.length > 0);
  const availableModes = modes.filter(
    (value) => value !== "exact" || scope !== "all",
  );

  function selectScope(value: Scope) {
    setScope(value);
    if (value === "all" && mode === "exact") setMode("fuzzy");
  }

  function actions(pr?: PullRequest) {
    return (
      <ActionPanel>
        {pr && (
          <ActionPanel.Section>
            <Action.OpenInBrowser url={pr.url} />
            <Action.CopyToClipboard
              title="Copy PR URL"
              content={pr.url}
              shortcut={Keyboard.Shortcut.Common.Copy}
            />
            <Action.CopyToClipboard
              title="Copy PR Number"
              content={String(pr.number)}
              shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
            />
          </ActionPanel.Section>
        )}
        <ActionPanel.Section>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={revalidate}
            shortcut={Keyboard.Shortcut.Common.Refresh}
          />
          {kinds.map((label, index) => (
            <Action
              key={label}
              title={`Show ${label}`}
              icon={Icon.List}
              onAction={() => setKind(String(index))}
              shortcut={{
                modifiers: ["cmd"],
                key: String(index + 1) as "1" | "2" | "3",
              }}
            />
          ))}
        </ActionPanel.Section>
        <ActionPanel.Section title="Search">
          <Action
            title="Cycle Search Field"
            icon={Icon.MagnifyingGlass}
            shortcut={{ modifiers: ["cmd"], key: "f" }}
            onAction={() =>
              selectScope(scopes[(scopes.indexOf(scope) + 1) % scopes.length])
            }
          />
          <Action
            title="Cycle Match Type"
            icon={Icon.Text}
            shortcut={{ modifiers: ["cmd"], key: "t" }}
            onAction={() =>
              setMode(
                availableModes[
                  (availableModes.indexOf(mode) + 1) % availableModes.length
                ],
              )
            }
          />
          <ActionPanel.Submenu title="Search Field" icon={Icon.MagnifyingGlass}>
            {scopes.map((value) => (
              <Action
                key={value}
                title={value}
                icon={scope === value ? Icon.Checkmark : undefined}
                onAction={() => selectScope(value)}
              />
            ))}
          </ActionPanel.Submenu>
          <ActionPanel.Submenu title="Match Type" icon={Icon.Text}>
            {availableModes.map((value) => (
              <Action
                key={value}
                title={value}
                icon={mode === value ? Icon.Checkmark : undefined}
                onAction={() => setMode(value)}
              />
            ))}
          </ActionPanel.Submenu>
        </ActionPanel.Section>
        <ActionPanel.Section title="Setup">
          <Action
            title="Open Extension Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
          <Action.CopyToClipboard title="Copy Setup Commands" content={setup} />
        </ActionPanel.Section>
      </ActionPanel>
    );
  }

  return (
    <List
      isLoading={isLoading}
      filtering={false}
      searchText={query}
      onSearchTextChange={setQuery}
      searchBarPlaceholder={`Search ${scope} · ${mode} (⌘F field, ⌘T match type)`}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Pull Request List"
          value={kind}
          onChange={setKind}
        >
          {kinds.map((label, index) => (
            <List.Dropdown.Item
              key={label}
              value={String(index)}
              title={`${label}${data ? ` (${data.lists[index].length})` : ""}`}
            />
          ))}
        </List.Dropdown>
      }
    >
      <List.EmptyView
        icon={error ? Icon.ExclamationMark : Icon.MagnifyingGlass}
        title={
          error
            ? "Could Not Refresh Pull Requests"
            : isLoading
              ? "Loading Pull Requests…"
              : "No Pull Requests"
        }
        description={
          error
            ? "Run gh assigned --json in Terminal. Check authentication, extension installation, and GitHub CLI Path in preferences."
            : query
              ? `No matches in ${kinds[Number(kind)]}. Change your search or switch lists.`
              : "Switch lists or refresh with ⌘R."
        }
        actions={actions()}
      />
      {groups.map((group) => (
        <List.Section
          key={`${group.rows[0].pr.repo}#${group.rows[0].pr.number}`}
          title={
            group.root
              ? `${group.root.repo} · Stack #${group.root.number}`
              : `${kinds[Number(kind)]} · Other PRs`
          }
          subtitle={`${group.rows.length}/${group.total} PRs${error ? " · Refresh failed — cached results" : isLoading && data ? " · Refreshing cached results…" : ""}`}
        >
          {group.rows.map(({ pr, prefix, parent }) => (
            <List.Item
              key={`${pr.repo}#${pr.number}`}
              id={`${pr.repo}#${pr.number}`}
              icon={{
                source: group.root && !parent ? Icon.Layers : Icon.Code,
                tintColor: pr.is_draft ? Color.SecondaryText : Color.Green,
              }}
              title={`${prefix}${group.root ? `#${pr.number} ` : ""}${pr.is_draft ? "[draft] " : ""}${pr.title}`}
              subtitle={`${group.root ? (parent ? `on #${parent.number}` : "Stack root") : `${shortRepo(pr)} #${pr.number}`}${kind !== "0" && pr.author ? ` · ${pr.author}` : ""}`}
              accessories={[
                { icon: ci[pr.checks], tooltip: `CI: ${pr.checks}` },
                {
                  tag: {
                    value: review[pr.review].text,
                    color: review[pr.review].color,
                  },
                  tooltip: `${pr.repo}: ${pr.head_ref} → ${pr.base_ref}`,
                },
              ]}
              actions={actions(pr)}
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
