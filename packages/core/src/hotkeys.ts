import { detectPlatform } from "./environment.js";
import { HotkeysEnvironmentError } from "./errors.js";
import { getEventTarget, isEditable } from "./filter.js";
import {
  codeToName,
  nameToCode,
  nameToEventKey,
  normalizeComboKey,
  normalizeEventKey,
} from "./keys.js";
import { matchesEvent } from "./matcher.js";
import { type ParsedCombo, parseCombo } from "./parser.js";
import type {
  BindingInfo,
  HotkeyConflict,
  HotkeyHandler,
  HotkeyOptions,
  Hotkeys,
  HotkeysOptions,
  IgnoreInputs,
  KeyLayout,
  ScopeOptions,
  Unbind,
} from "./types.js";

const GLOBAL_SCOPE = "global";
const ALL_SCOPES = "*";

type Entry = {
  id: number;
  combos: ParsedCombo[];
  handler: HotkeyHandler;
  scope: string;
  priority: number;
  on: "keydown" | "keyup";
  enabled: boolean | (() => boolean);
  once: boolean;
  repeat: boolean;
  preventDefault: boolean;
  stopPropagation: boolean;
  ignoreInputs: IgnoreInputs;
  element: Element | null;
  layout: KeyLayout;
  exact: boolean;
  passthrough: boolean;
  label: string | undefined;
  description: string | undefined;
  group: string | undefined;
};

type ScopeFrame = {
  id: number;
  name: string;
  inherit: boolean;
};

type Candidate = {
  entry: Entry;
  combo: ParsedCombo;
  depth: number;
};

const MODIFIER_KEYS = new Set([
  "alt",
  "control",
  "meta",
  "shift",
]);

/**
 * Creates a keyboard-shortcut engine.
 *
 * Listeners are attached lazily when the first binding is added and removed when the last one
 * goes away, so creating an instance (or importing the package on the server) has no side effects.
 *
 * @example
 * const hotkeys = createHotkeys();
 * const unbind = hotkeys.bind("mod+k", () => openPalette());
 * unbind();
 */
export function createHotkeys(options: HotkeysOptions = {}): Hotkeys {
  const platform = options.platform ?? detectPlatform();
  const capture = options.capture ?? false;
  const defaults = options.defaults ?? {};

  const entries = new Map<number, Entry>();
  const scopeStack: ScopeFrame[] = [
    {
      id: 0,
      inherit: true,
      name: GLOBAL_SCOPE,
    },
  ];
  const pressed = new Map<string, string>();
  let nextEntryId = 1;
  let nextScopeId = 1;
  let listening = false;
  let listenTarget: EventTarget | undefined;

  /** Active scope names mapped to their depth in the stack (deeper = closer to the top). */
  const activeScopeDepths = (): Map<string, number> => {
    const depths = new Map<string, number>();
    for (let index = scopeStack.length - 1; index >= 0; index--) {
      const frame = scopeStack[index] as ScopeFrame;
      if (!depths.has(frame.name)) {
        depths.set(frame.name, index);
      }
      if (!frame.inherit) {
        break;
      }
    }
    return depths;
  };

  const isEnabled = (entry: Entry) =>
    typeof entry.enabled === "function" ? entry.enabled() : entry.enabled;

  const depthOf = (
    entry: Entry,
    depths: Map<string, number>,
  ): number | undefined =>
    entry.scope === ALL_SCOPES ? -1 : depths.get(entry.scope);

  const toInfo = (entry: Entry, depths: Map<string, number>): BindingInfo => {
    const enabled = isEnabled(entry);
    return {
      active: enabled && depthOf(entry, depths) !== undefined,
      combos: entry.combos.map((combo) => combo.raw),
      enabled,
      id: entry.id,
      on: entry.on,
      priority: entry.priority,
      scope: entry.scope,
      ...(entry.label !== undefined && {
        label: entry.label,
      }),
      ...(entry.description !== undefined && {
        description: entry.description,
      }),
      ...(entry.group !== undefined && {
        group: entry.group,
      }),
    };
  };

  const shouldIgnore = (
    entry: Entry,
    combo: ParsedCombo,
    event: KeyboardEvent,
  ): boolean => {
    const mode = entry.ignoreInputs;
    if (mode === false) {
      return false;
    }
    if (typeof mode === "function") {
      return mode(event);
    }
    const target = getEventTarget(event);
    if (mode === true) {
      return isEditable(target);
    }
    if (mode === "auto") {
      return isEditable(target) && !(combo.ctrl || combo.meta);
    }
    return target?.closest?.(mode) != null;
  };

  const dispatch = (
    event: KeyboardEvent,
    type: "keydown" | "keyup",
  ): boolean => {
    // 229 is what browsers report while an input method (IME) is composing text.
    if (event.isComposing || event.keyCode === 229) {
      return false;
    }

    const depths = activeScopeDepths();
    const candidates: Candidate[] = [];
    for (const entry of entries.values()) {
      if (entry.on !== type || (event.repeat && !entry.repeat)) {
        continue;
      }
      const depth = depthOf(entry, depths);
      if (depth === undefined || !isEnabled(entry)) {
        continue;
      }
      if (entry.element !== null) {
        const target = event.target;
        if (!(target instanceof Node) || !entry.element.contains(target)) {
          continue;
        }
      }
      const combo = entry.combos.find((candidate) =>
        matchesEvent(candidate, event, entry.layout, entry.exact),
      );
      if (combo === undefined || shouldIgnore(entry, combo, event)) {
        continue;
      }
      candidates.push({
        combo,
        depth,
        entry,
      });
    }

    // Highest priority first, then the scope closest to the top of the stack, then the most recent binding.
    candidates.sort(
      (a, b) =>
        b.entry.priority - a.entry.priority ||
        b.depth - a.depth ||
        b.entry.id - a.entry.id,
    );

    let handled = false;
    for (const { combo, entry } of candidates) {
      if (entry.once) {
        entries.delete(entry.id);
      }
      if (entry.preventDefault) {
        event.preventDefault();
      }
      if (entry.stopPropagation) {
        event.stopPropagation();
      }
      entry.handler(event, {
        binding: toInfo(entry, depths),
        combo: combo.raw,
      });
      handled = true;
      if (!entry.passthrough) {
        break;
      }
    }
    if (entries.size === 0) {
      sync();
    }
    return handled;
  };

  const onKeyDown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    pressed.set(
      keyboardEvent.code || keyboardEvent.key,
      normalizeEventKey(keyboardEvent.key),
    );
    dispatch(keyboardEvent, "keydown");
  };

  const onKeyUp = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    pressed.delete(keyboardEvent.code || keyboardEvent.key);
    // macOS never sends keyup for keys released while Cmd is held, so they would stay "pressed".
    if (normalizeEventKey(keyboardEvent.key) === "meta") {
      for (const [id, key] of pressed) {
        if (!MODIFIER_KEYS.has(key)) {
          pressed.delete(id);
        }
      }
    }
    dispatch(keyboardEvent, "keyup");
  };

  const resetPressed = () => pressed.clear();
  const onVisibilityChange = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      pressed.clear();
    }
  };

  const attach = () => {
    listenTarget =
      options.target ??
      (typeof document === "undefined" ? undefined : document);
    if (listenTarget === undefined) {
      return;
    }
    listenTarget.addEventListener("keydown", onKeyDown, capture);
    listenTarget.addEventListener("keyup", onKeyUp, capture);
    if (typeof window !== "undefined") {
      window.addEventListener("blur", resetPressed);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    listening = true;
  };

  const detach = () => {
    listenTarget?.removeEventListener("keydown", onKeyDown, capture);
    listenTarget?.removeEventListener("keyup", onKeyUp, capture);
    if (typeof window !== "undefined") {
      window.removeEventListener("blur", resetPressed);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    listenTarget = undefined;
    listening = false;
    pressed.clear();
  };

  function sync() {
    if (entries.size > 0 && !listening) {
      attach();
    } else if (entries.size === 0 && listening) {
      detach();
    }
  }

  const elementIds = new WeakMap<Element, number>();
  let nextElementId = 1;
  const elementId = (element: Element | null): number => {
    if (element === null) {
      return 0;
    }
    let id = elementIds.get(element);
    if (id === undefined) {
      id = nextElementId++;
      elementIds.set(element, id);
    }
    return id;
  };

  const conflictKey = (entry: Entry, signature: string) =>
    [
      entry.scope,
      entry.on,
      entry.priority,
      elementId(entry.element),
      signature,
    ].join("|");

  const findConflicts = (only?: Entry): HotkeyConflict[] => {
    const groups = new Map<
      string,
      {
        combo: string;
        scope: string;
        members: Entry[];
      }
    >();
    for (const entry of entries.values()) {
      if (entry.passthrough) {
        continue;
      }
      for (const combo of entry.combos) {
        const key = conflictKey(entry, combo.signature);
        const group = groups.get(key) ?? {
          combo: combo.signature,
          members: [],
          scope: entry.scope,
        };
        if (!group.members.includes(entry)) {
          group.members.push(entry);
        }
        groups.set(key, group);
      }
    }
    const depths = activeScopeDepths();
    return [
      ...groups.values(),
    ]
      .filter(
        (group) =>
          group.members.length > 1 &&
          (only === undefined || group.members.includes(only)),
      )
      .map((group) => ({
        bindings: group.members.map((member) => toInfo(member, depths)),
        combo: group.combo,
        scope: group.scope,
      }));
  };

  const reportConflicts = (entry: Entry) => {
    if (options.onConflict === undefined && options.debug !== true) {
      return;
    }
    for (const conflict of findConflicts(entry)) {
      if (options.onConflict !== undefined) {
        options.onConflict(conflict);
      } else {
        console.warn(
          `[usehotkeys] "${conflict.combo}" is bound ${conflict.bindings.length} times in scope "${conflict.scope}" with the same priority. The most recent binding wins. Set "priority" or "passthrough" to resolve it.`,
        );
      }
    }
  };

  const bind: Hotkeys["bind"] = (combo, handler, bindOptions = {}) => {
    const merged: HotkeyOptions = {
      ...defaults,
      ...stripUndefined(bindOptions),
    };
    const combos = (
      typeof combo === "string"
        ? [
            combo,
          ]
        : [
            ...combo,
          ]
    ).map((raw) => parseCombo(raw, platform));
    const entry: Entry = {
      combos,
      description: merged.description,
      element: merged.element ?? null,
      enabled: merged.enabled ?? true,
      exact: merged.exact ?? true,
      group: merged.group,
      handler,
      id: nextEntryId++,
      ignoreInputs: merged.ignoreInputs ?? "auto",
      label: merged.label,
      layout: merged.layout ?? "logical",
      on: merged.on ?? "keydown",
      once: merged.once ?? false,
      passthrough: merged.passthrough ?? false,
      preventDefault: merged.preventDefault ?? true,
      priority: merged.priority ?? 0,
      repeat: merged.repeat ?? false,
      scope: merged.scope ?? GLOBAL_SCOPE,
      stopPropagation: merged.stopPropagation ?? false,
    };
    entries.set(entry.id, entry);
    sync();
    reportConflicts(entry);

    return () => {
      if (entries.delete(entry.id)) {
        sync();
      }
    };
  };

  const pushScope = (name: string, scopeOptions: ScopeOptions = {}): Unbind => {
    const frame: ScopeFrame = {
      id: nextScopeId++,
      inherit: scopeOptions.inherit ?? true,
      name,
    };
    scopeStack.push(frame);
    return () => {
      const index = scopeStack.findIndex(
        (candidate) => candidate.id === frame.id,
      );
      if (index > 0) {
        scopeStack.splice(index, 1);
      }
    };
  };

  const trigger = (combo: string): boolean => {
    if (typeof KeyboardEvent === "undefined") {
      throw new HotkeysEnvironmentError(
        "trigger() needs KeyboardEvent, which is not available in this environment.",
      );
    }
    const parsed = parseCombo(combo, platform);
    const event = new KeyboardEvent("keydown", {
      altKey: parsed.alt,
      bubbles: true,
      cancelable: true,
      code: parsed.modifierOnly ? "" : nameToCode(parsed.key),
      ctrlKey: parsed.ctrl,
      key: nameToEventKey(parsed.key),
      metaKey: parsed.meta,
      shiftKey: parsed.shift,
    });
    return dispatch(event, "keydown");
  };

  const isPressed = (key: string): boolean => {
    const name = normalizeComboKey(key);
    for (const [code, pressedKey] of pressed) {
      if (pressedKey === name || codeToName(code) === name) {
        return true;
      }
    }
    return false;
  };

  return {
    bind,
    destroy: () => {
      entries.clear();
      scopeStack.splice(1);
      detach();
    },
    getActiveScopes: () =>
      [
        ...activeScopeDepths().entries(),
      ]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
    getBindings: () => {
      const depths = activeScopeDepths();
      return [
        ...entries.values(),
      ].map((entry) => toInfo(entry, depths));
    },
    getConflicts: () => findConflicts(),
    isPressed,
    platform,
    pushScope,
    trigger,
  };
}

/** Drops `undefined` values so they do not override instance defaults. */
function stripUndefined(options: HotkeyOptions): HotkeyOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
}
