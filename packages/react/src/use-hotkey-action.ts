import type { HotkeyHandler } from "@usehotkeys/core";
import type { BindingHookOptions } from "./use-register.js";
import { useRegister } from "./use-register.js";

/** Options for {@link useHotkeyAction}: the same as {@link useHotkeys}. */
export type UseHotkeyActionOptions = BindingHookOptions;

/**
 * Runs `handler` when the user presses the shortcut assigned to a named action of the keymap.
 *
 * The keys come from the `keymap` given to `<HotkeysProvider options={{ keymap }}>`, or from the
 * user's customisation (`setShortcut`). When the shortcut changes the binding follows it; the
 * hook does not re-register.
 *
 * @throws {UnknownActionError} when the action is not in the keymap.
 *
 * @example
 * // <HotkeysProvider options={{ keymap: { openPalette: { keys: "mod+k", label: "Open palette" } } }}>
 * useHotkeyAction("openPalette", () => setOpen(true));
 */
export function useHotkeyAction(
  action: string,
  handler: HotkeyHandler,
  options: UseHotkeyActionOptions = {},
): void {
  useRegister(
    {
      action,
      kind: "action",
    },
    handler,
    options,
  );
}
