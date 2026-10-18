import type { HotkeyHandler } from "@usehotkeys/core";
import {
  type BindingHookOptions,
  COMBO_SEPARATOR,
  useRegister,
} from "./use-register.js";

/** Options for {@link useHotkeys}: the core options, where `element` may also be a React ref. */
export type UseHotkeysOptions = BindingHookOptions;

/**
 * Runs `handler` when the user presses `combo` while the component is mounted.
 *
 * - The latest `handler` and `enabled` are always used, so you never get a stale closure and
 *   inline arrow functions do not re-register anything.
 * - The binding is removed on unmount.
 *
 * @example
 * useHotkeys("mod+k", () => setOpen(true), { label: "Open command palette" });
 * useHotkeys(["j", "arrowdown"], next, { enabled: items.length > 0 });
 * useHotkeys("g i", goToInbox); // a sequence
 */
export function useHotkeys(
  combo: string | readonly string[],
  handler: HotkeyHandler,
  options: UseHotkeysOptions = {},
): void {
  const combos =
    typeof combo === "string" ? combo : combo.join(COMBO_SEPARATOR);
  useRegister(
    {
      combos,
      kind: "combo",
    },
    handler,
    options,
  );
}
