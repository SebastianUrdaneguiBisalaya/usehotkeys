import { useSyncExternalStore } from "react";
import { useHotkeysInstance } from "./context.js";

/**
 * `true` while the user is holding `combo` down, and re-renders when that changes.
 *
 * `combo` can be a single key (`"shift"`, `"a"`), a combination (`"ctrl+shift"`, `"mod+k"`), and
 * `mod` is `Cmd` on macOS and `Ctrl` elsewhere. It is `false` on the server and while hydrating.
 *
 * @throws {HotkeyParseError} when `combo` is invalid.
 *
 * @example
 * const shiftHeld = useIsPressed("shift");
 * return <Row selectMode={shiftHeld} />;
 */
export function useIsPressed(combo: string): boolean {
  const hotkeys = useHotkeysInstance();
  return useSyncExternalStore(
    hotkeys.subscribePressed,
    () => hotkeys.isPressed(combo),
    () => false,
  );
}
