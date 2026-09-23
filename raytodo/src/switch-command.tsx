import {
  Action,
  Icon,
  LaunchType,
  launchCommand,
  showToast,
  Toast,
} from "@raycast/api";

export function SwitchCommandAction({
  target,
}: {
  target: "raytodo" | "rayteam";
}) {
  return (
    <Action
      title={`${target}に切り替え`}
      icon={Icon.ArrowRight}
      shortcut={{ modifiers: ["ctrl", "shift"], key: "s" }}
      onAction={async () => {
        try {
          await launchCommand({ name: target, type: LaunchType.UserInitiated });
        } catch (error) {
          await showToast({
            style: Toast.Style.Failure,
            title: "切り替えできませんでした",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }}
    />
  );
}
