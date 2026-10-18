import type { BindingInfo, ShortcutInfo } from "@usehotkeys/core";
import { useMemo, useSyncExternalStore } from "react";
import { useHotkeysInstance } from "./context.js";

const NO_BINDINGS: readonly BindingInfo[] = Object.freeze([]);
const NO_SHORTCUTS: readonly ShortcutInfo[] = Object.freeze([]);

/** Filters for {@link useBindings}. */
export type UseBindingsOptions = {
  /** Only bindings that can fire right now: enabled and in an active scope. */
  activeOnly?: boolean | undefined;
  /** Only bindings with a `label`. Handy for help screens, which should skip unnamed ones. */
  labeledOnly?: boolean | undefined;
  /** Only bindings of this `group`. */
  group?: string | undefined;
  /** Only bindings of this `scope`. */
  scope?: string | undefined;
};

/**
 * Every shortcut registered in the app, kept up to date: it re-renders when a component mounts or
 * unmounts a hotkey, a scope opens or closes, or a shortcut is customised.
 * Build a "keyboard shortcuts" help dialog with it.
 *
 * @example
 * const bindings = useBindings({ activeOnly: true, labeledOnly: true });
 * bindings.map((b) => <li key={b.id}>{b.label}: {formatHotkey(b.combos[0]!)}</li>);
 */
export function useBindings(
  options: UseBindingsOptions = {},
): readonly BindingInfo[] {
  const hotkeys = useHotkeysInstance();
  const all = useSyncExternalStore(
    hotkeys.subscribe,
    hotkeys.getBindings,
    () => NO_BINDINGS,
  );
  const { activeOnly, group, labeledOnly, scope } = options;

  return useMemo(
    () =>
      all.filter(
        (binding) =>
          (!activeOnly || binding.active) &&
          (!labeledOnly || binding.label !== undefined) &&
          (group === undefined || binding.group === group) &&
          (scope === undefined || binding.scope === scope),
      ),
    [
      all,
      activeOnly,
      labeledOnly,
      group,
      scope,
    ],
  );
}

/** Filters for {@link useShortcuts}. */
export type UseShortcutsOptions = {
  /** Only actions of this `group`. */
  group?: string | undefined;
};

/**
 * Every action of the keymap with its current keys, kept up to date. Use it for a settings
 * screen where users customise shortcuts (together with `useRecordHotkey` and `setShortcut`).
 *
 * @example
 * const shortcuts = useShortcuts();
 * shortcuts.map((s) => <Row key={s.action} label={s.label ?? s.action} keys={s.keys} customized={s.customized} />);
 */
export function useShortcuts(
  options: UseShortcutsOptions = {},
): readonly ShortcutInfo[] {
  const hotkeys = useHotkeysInstance();
  const all = useSyncExternalStore(
    hotkeys.subscribe,
    hotkeys.getShortcuts,
    () => NO_SHORTCUTS,
  );
  const { group } = options;
  return useMemo(
    () =>
      group === undefined
        ? all
        : all.filter((shortcut) => shortcut.group === group),
    [
      all,
      group,
    ],
  );
}
