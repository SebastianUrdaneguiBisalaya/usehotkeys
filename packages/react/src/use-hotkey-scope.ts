import type { ScopeOptions } from "@usehotkeys/core";
import { useEffect } from "react";
import { useHotkeysInstance } from "./context.js";

/** Options for {@link useHotkeyScope}. */
export type UseHotkeyScopeOptions = ScopeOptions & {
  /** Activate the scope only while this is `true`. Defaults to `true`. */
  enabled?: boolean | undefined;
};

/**
 * Activates a scope while the component is mounted (and `enabled`).
 *
 * Bindings created with `{ scope: name }` only fire while their scope is active.
 * Use `inherit: false` for modals so shortcuts behind them stop firing.
 *
 * @example
 * function Modal({ onClose }) {
 *   useHotkeyScope("modal", { inherit: false });
 *   useHotkeys("escape", onClose, { scope: "modal" });
 *   return <dialog open>…</dialog>;
 * }
 */
export function useHotkeyScope(
  name: string,
  options: UseHotkeyScopeOptions = {},
): void {
  const hotkeys = useHotkeysInstance();
  const { enabled = true, inherit = true } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return hotkeys.pushScope(name, {
      inherit,
    });
  }, [
    hotkeys,
    name,
    enabled,
    inherit,
  ]);
}
