import type { HotkeyHandler, HotkeyOptions } from "@usehotkeys/core";
import { type RefObject, useEffect, useRef } from "react";
import { useHotkeysInstance } from "./context.js";

/** Options for {@link useHotkeys}: the core options, where `element` may also be a React ref. */
export type UseHotkeysOptions = Omit<HotkeyOptions, "element"> & {
  /** Only fire inside this element. Pass a ref to target a rendered element. */
  element?: Element | RefObject<Element | null> | null | undefined;
};

const isRef = (value: unknown): value is RefObject<Element | null> =>
  typeof value === "object" && value !== null && "current" in value;

const SEPARATOR = "\u0000";

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
 */
export function useHotkeys(
  combo: string | readonly string[],
  handler: HotkeyHandler,
  options: UseHotkeysOptions = {},
): void {
  const hotkeys = useHotkeysInstance();
  const latest = useRef({
    handler,
    options,
  });
  useEffect(() => {
    latest.current = {
      handler,
      options,
    };
  });

  const comboKey = typeof combo === "string" ? combo : combo.join(SEPARATOR);
  const {
    description,
    element,
    exact,
    group,
    label,
    layout,
    on,
    once,
    passthrough,
  } = options;
  const { preventDefault, priority, repeat, scope, stopPropagation } = options;
  const ignoreInputs = options.ignoreInputs;
  const ignoreInputsDep =
    typeof ignoreInputs === "function" ? "function" : ignoreInputs;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `latest` is a ref; the listed options are the ones that must re-register.
  useEffect(() => {
    const target = isRef(element) ? element.current : element;
    if (isRef(element) && target === null) {
      return;
    }
    return hotkeys.bind(
      comboKey.split(SEPARATOR),
      (event, context) => latest.current.handler(event, context),
      {
        description,
        element: target,
        enabled: () => {
          const enabled = latest.current.options.enabled;
          return typeof enabled === "function" ? enabled() : enabled !== false;
        },
        exact,
        group,
        ignoreInputs:
          typeof ignoreInputs === "function"
            ? (event) => {
                const current = latest.current.options.ignoreInputs;
                return typeof current === "function" ? current(event) : false;
              }
            : ignoreInputs,
        label,
        layout,
        on,
        once,
        passthrough,
        preventDefault,
        priority,
        repeat,
        scope,
        stopPropagation,
      },
    );
  }, [
    hotkeys,
    comboKey,
    description,
    element,
    exact,
    group,
    ignoreInputsDep,
    label,
    layout,
    on,
    once,
    passthrough,
    preventDefault,
    priority,
    repeat,
    scope,
    stopPropagation,
  ]);
}
