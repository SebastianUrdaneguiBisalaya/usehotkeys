import type { HotkeyHandler, HotkeyOptions, Hotkeys } from "@usehotkeys/core";
import { type RefObject, useEffect, useRef } from "react";
import { useHotkeysInstance } from "./context.js";

/** Options for the binding hooks: the core options, where `element` may also be a React ref. */
export type BindingHookOptions = Omit<HotkeyOptions, "element"> & {
  /** Only fire inside this element. Pass a ref to target a rendered element. */
  element?: Element | RefObject<Element | null> | null | undefined;
};

/** What to register: key combos, or a named action from the keymap. */
export type Target =
  | {
      kind: "combo";
      combos: string;
    }
  | {
      kind: "action";
      action: string;
    };

export const COMBO_SEPARATOR = "\u0000";

const isRef = (value: unknown): value is RefObject<Element | null> =>
  typeof value === "object" && value !== null && "current" in value;

/**
 * Shared implementation of `useHotkeys` and `useHotkeyAction`: binds on mount, unbinds on unmount,
 * and keeps the latest handler and `enabled` without re-registering.
 */
export function useRegister(
  target: Target,
  handler: HotkeyHandler,
  options: BindingHookOptions,
) {
  const hotkeys: Hotkeys = useHotkeysInstance();
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

  const targetKey =
    target.kind === "combo" ? target.combos : `action:${target.action}`;
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
  const enabledDep =
    typeof options.enabled === "function" ? "function" : options.enabled;

  // `enabled` is read through the ref, so the engine cannot see it change. Tell subscribers
  // (e.g. a shortcuts help dialog) to refresh when a plain boolean flips.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `enabledDep` is the trigger; the value is not used inside.
  useEffect(() => {
    hotkeys.notify();
  }, [
    hotkeys,
    enabledDep,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `latest` is a ref; the listed options are the ones that must re-register.
  useEffect(() => {
    const resolved = isRef(element) ? element.current : element;
    if (isRef(element) && resolved === null) {
      return;
    }
    const bindOptions: HotkeyOptions = {
      description,
      element: resolved,
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
    };
    const run: HotkeyHandler = (event, context) =>
      latest.current.handler(event, context);
    return target.kind === "combo"
      ? hotkeys.bind(target.combos.split(COMBO_SEPARATOR), run, bindOptions)
      : hotkeys.bindAction(target.action, run, bindOptions);
  }, [
    hotkeys,
    targetKey,
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
