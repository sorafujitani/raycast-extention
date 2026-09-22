import assert from "node:assert/strict";
import { test, vi } from "vite-plus/test";
import { launchCommand, showToast } from "@raycast/api";
import { SwitchCommandAction } from "../src/switch-command";

// Raycast supplies React at runtime; only action props are needed here.
vi.mock("react/jsx-dev-runtime", () => ({
  jsxDEV: (type: unknown, props: unknown) => ({ type, props }),
}));

vi.mock("@raycast/api", () => ({
  Action: () => null,
  Icon: { ArrowRight: "arrow-right" },
  LaunchType: { UserInitiated: "userInitiated" },
  Toast: { Style: { Failure: "failure" } },
  launchCommand: vi.fn(),
  showToast: vi.fn(),
}));

test("both commands switch with the same keyboard shortcut and report launch failures", async () => {
  for (const target of ["raytodo", "rayteam"] as const) {
    const action = SwitchCommandAction({ target });
    assert.deepEqual(action.props.shortcut, {
      modifiers: ["ctrl", "shift"],
      key: "t",
    });
    assert.equal(action.props.title, `${target}に切り替え`);
    await action.props.onAction();
    assert.deepEqual(vi.mocked(launchCommand).mock.lastCall, [
      { name: target, type: "userInitiated" },
    ]);
  }
  vi.mocked(launchCommand).mockRejectedValueOnce(new Error("unavailable"));
  await SwitchCommandAction({ target: "raytodo" }).props.onAction();
  assert.deepEqual(vi.mocked(showToast).mock.lastCall, [
    {
      style: "failure",
      title: "切り替えできませんでした",
      message: "unavailable",
    },
  ]);
});
