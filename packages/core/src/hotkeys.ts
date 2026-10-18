import { detectPlatform } from "./environment.js";
import {
  HotkeyParseError,
  HotkeysEnvironmentError,
  UnknownActionError,
} from "./errors.js";
import { getEventTarget, isEditable } from "./filter.js";
import {
  codeToName,
  nameToCode,
  nameToEventKey,
  normalizeEventKey,
} from "./keys.js";
import { matchesEvent } from "./matcher.js";
import {
  type ParsedCombo,
  type ParsedSequence,
  parseCombo,
  parseSequence,
} from "./parser.js";
import { type Recording, startRecording } from "./record.js";
import type {
  BindingInfo,
  HotkeyConflict,
  HotkeyHandler,
  HotkeyOptions,
  Hotkeys,
  HotkeysOptions,
  IgnoreInputs,
  KeyLayout,
  KeymapDefinition,
  KeymapEntry,
  ScopeOptions,
  ShortcutInfo,
  Unbind,
} from "./types.js";

const GLOBAL_SCOPE = "global";
const ALL_SCOPES = "*";
const DEFAULT_SEQUENCE_TIMEOUT = 1000;
const DEFAULT_TAP_TIMEOUT = 300;
const MAX_HISTORY = 8;

type Entry = {
  id: number;
  action: string | undefined;
  sequences: ParsedSequence[];
  handler: HotkeyHandler;
  scope: string;
  priority: number;
  on: "keydown" | "keyup";
  hold: number | undefined;
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
  sequence: ParsedSequence;
  depth: number;
};

/** A key press kept for sequence matching. `tap` is set when a modifier was pressed and released alone. */
type HistoryItem = {
  event: KeyboardEvent;
  time: number;
  tap?: string;
};

/** A match that is waiting to see whether a longer sequence continues (like Vim's `timeoutlen`). */
type Pending = {
  candidates: Candidate[];
  event: KeyboardEvent;
  length: number;
  timer: ReturnType<typeof setTimeout>;
};

/** A long-press binding whose key is currently down and whose timer is running. */
type Hold = {
  keyId: string;
  modifiers: string[];
  timer: ReturnType<typeof setTimeout>;
};

type ActionDefinition = Omit<KeymapDefinition, "keys"> & {
  keys: string[];
};

const MODIFIER_KEYS = new Set([
  "alt",
  "control",
  "meta",
  "shift",
]);

const isModifierEvent = (event: KeyboardEvent) =>
  MODIFIER_KEYS.has(normalizeEventKey(event.key ?? ""));

const keyIdOf = (event: KeyboardEvent) => event.code || event.key;

const toList = (keys: string | readonly string[]): string[] =>
  typeof keys === "string"
    ? [
        keys,
      ]
    : [
        ...keys,
      ];

const isDefinition = (entry: KeymapEntry): entry is KeymapDefinition =>
  typeof entry === "object" && !Array.isArray(entry);

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
  const sequenceTimeout = options.sequenceTimeout ?? DEFAULT_SEQUENCE_TIMEOUT;
  const tapTimeout = options.tapTimeout ?? DEFAULT_TAP_TIMEOUT;

  const entries = new Map<number, Entry>();
  const scopeStack: ScopeFrame[] = [
    {
      id: 0,
      inherit: true,
      name: GLOBAL_SCOPE,
    },
  ];
  const pressed = new Map<string, string>();
  /** Modifiers currently down: when they went down, and whether another key was pressed meanwhile. */
  const heldModifiers = new Map<
    string,
    {
      time: number;
      used: boolean;
    }
  >();
  const holds = new Map<number, Hold>();
  /** Recent key presses (and modifier taps), used to match sequences such as "g i" or "shift shift". */
  let history: HistoryItem[] = [];
  let pending: Pending | undefined;
  let nextEntryId = 1;
  let nextScopeId = 1;
  let listening = false;
  let listenTarget: EventTarget | undefined;
  let activeRecording: Recording | undefined;

  // Change tracking: `version` goes up on every change so cached snapshots can be reused.
  const listeners = new Set<() => void>();
  let version = 0;
  const changed = () => {
    version++;
    for (const listener of [
      ...listeners,
    ]) {
      listener();
    }
  };

  // Pressed keys change on every key event, so they notify separately from `changed`.
  const pressedListeners = new Set<() => void>();
  const notifyPressed = () => {
    for (const listener of [
      ...pressedListeners,
    ]) {
      listener();
    }
  };

  const resolveTarget = (): EventTarget | undefined =>
    options.target ?? (typeof document === "undefined" ? undefined : document);

  // ---- Keymap -------------------------------------------------------------------------------

  const validate = (keys: readonly string[]) =>
    keys.map((raw) => parseSequence(raw, platform));

  const actions = new Map<string, ActionDefinition>();
  for (const [action, entry] of Object.entries(options.keymap ?? {})) {
    const definition: KeymapDefinition = isDefinition(entry)
      ? entry
      : {
          keys: entry,
        };
    const keys = toList(definition.keys);
    validate(keys);
    actions.set(action, {
      ...definition,
      keys,
    });
  }

  const overrides = new Map<string, string[]>();
  for (const [action, keys] of Object.entries(options.overrides ?? {})) {
    if (!actions.has(action)) {
      throw new UnknownActionError(action);
    }
    const list = toList(keys);
    validate(list);
    overrides.set(action, list);
  }

  const effectiveKeys = (action: string): string[] =>
    overrides.get(action) ?? (actions.get(action) as ActionDefinition).keys;

  const resolveSequences = (action: string): ParsedSequence[] =>
    validate(effectiveKeys(action));

  // ---- Scopes -------------------------------------------------------------------------------

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
    const definition =
      entry.action === undefined ? undefined : actions.get(entry.action);
    const label = entry.label ?? definition?.label;
    const description = entry.description ?? definition?.description;
    const group = entry.group ?? definition?.group;
    return {
      active: enabled && depthOf(entry, depths) !== undefined,
      combos: entry.sequences.map((sequence) => sequence.raw),
      enabled,
      id: entry.id,
      on: entry.on,
      priority: entry.priority,
      scope: entry.scope,
      ...(entry.action !== undefined && {
        action: entry.action,
      }),
      ...(entry.hold !== undefined && {
        hold: entry.hold,
      }),
      ...(label !== undefined && {
        label,
      }),
      ...(description !== undefined && {
        description,
      }),
      ...(group !== undefined && {
        group,
      }),
    };
  };

  // ---- Matching and dispatch ----------------------------------------------------------------

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

  /**
   * Records a key press (or a modifier tap) for sequence matching. Modifier key presses, other
   * than taps, and auto-repeat do not count.
   */
  const pushHistory = (event: KeyboardEvent, tap?: string) => {
    if (event.repeat || (tap === undefined && isModifierEvent(event))) {
      return;
    }
    const now = Date.now();
    const last = history[history.length - 1];
    if (last !== undefined && now - last.time > sequenceTimeout) {
      history = [];
    }
    history.push({
      event,
      time: now,
      ...(tap !== undefined && {
        tap,
      }),
    });
    if (history.length > MAX_HISTORY) {
      history.shift();
    }
  };

  /** The key presses a binding is matched against: the recent history, or just this event. */
  const eventWindow = (
    event: KeyboardEvent,
    type: "keydown" | "keyup",
  ): HistoryItem[] => {
    const last = history[history.length - 1];
    if (type === "keydown" && last?.event === event) {
      return history;
    }
    return [
      {
        event,
        time: Date.now(),
      },
    ];
  };

  const stepMatches = (
    entry: Entry,
    sequence: ParsedSequence,
    step: ParsedCombo,
    item: HistoryItem,
  ): boolean => {
    const inSequence = sequence.steps.length > 1;
    if (item.tap !== undefined) {
      // A tap only satisfies a modifier-only step of a multi-step sequence, e.g. "shift shift".
      return inSequence && step.modifierOnly && step.key === item.tap;
    }
    if (inSequence && step.modifierOnly) {
      return false;
    }
    return matchesEvent(step, item.event, entry.layout, entry.exact);
  };

  /** Do the first `length` steps of `sequence` match the last `length` presses? */
  const prefixMatches = (
    entry: Entry,
    sequence: ParsedSequence,
    length: number,
    window: HistoryItem[],
  ): boolean => {
    const offset = window.length - length;
    return (
      offset >= 0 &&
      sequence.steps
        .slice(0, length)
        .every((step, index) =>
          stepMatches(
            entry,
            sequence,
            step,
            window[offset + index] as HistoryItem,
          ),
        )
    );
  };

  /** Is a longer sequence than `length` steps in progress, so the next key could complete it? */
  const hasLongerInProgress = (
    window: HistoryItem[],
    depths: Map<string, number>,
    length: number,
  ): boolean => {
    for (const entry of entries.values()) {
      if (
        entry.on !== "keydown" ||
        depthOf(entry, depths) === undefined ||
        !isEnabled(entry)
      ) {
        continue;
      }
      for (const sequence of entry.sequences) {
        for (let matched = length; matched < sequence.steps.length; matched++) {
          if (prefixMatches(entry, sequence, matched, window)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const applyEventEffects = (candidates: Candidate[], event: KeyboardEvent) => {
    for (const { entry } of candidates) {
      if (entry.preventDefault) {
        event.preventDefault();
      }
      if (entry.stopPropagation) {
        event.stopPropagation();
      }
      if (!entry.passthrough) {
        break;
      }
    }
  };

  const run = (
    candidates: Candidate[],
    event: KeyboardEvent,
    depths: Map<string, number>,
    withEventEffects: boolean,
  ): boolean => {
    let handled = false;
    let completedSequence = false;
    for (const { entry, sequence } of candidates) {
      if (!entries.has(entry.id)) {
        continue;
      }
      if (entry.once) {
        entries.delete(entry.id);
        changed();
      }
      if (withEventEffects) {
        if (entry.preventDefault) {
          event.preventDefault();
        }
        if (entry.stopPropagation) {
          event.stopPropagation();
        }
      }
      completedSequence ||= sequence.steps.length > 1;
      entry.handler(event, {
        binding: toInfo(entry, depths),
        combo: sequence.raw,
      });
      handled = true;
      if (!entry.passthrough) {
        break;
      }
    }
    if (completedSequence) {
      history = [];
    }
    sync();
    return handled;
  };

  const clearPending = () => {
    if (pending !== undefined) {
      clearTimeout(pending.timer);
      pending = undefined;
    }
  };

  const flushPending = () => {
    const waiting = pending;
    if (waiting === undefined) {
      return;
    }
    clearPending();
    run(waiting.candidates, waiting.event, activeScopeDepths(), false);
  };

  // ---- Long press (hold) --------------------------------------------------------------------

  const clearHolds = () => {
    for (const hold of holds.values()) {
      clearTimeout(hold.timer);
    }
    holds.clear();
  };

  /** Cancels the holds that depended on the key that was just released. */
  const cancelHolds = (event: KeyboardEvent) => {
    const keyId = keyIdOf(event);
    const name = normalizeEventKey(event.key ?? "");
    for (const [entryId, hold] of holds) {
      if (hold.keyId === keyId || hold.modifiers.includes(name)) {
        clearTimeout(hold.timer);
        holds.delete(entryId);
      }
    }
  };

  const startHold = (candidate: Candidate, event: KeyboardEvent) => {
    const { entry, sequence } = candidate;
    if (holds.has(entry.id) || entry.hold === undefined) {
      return;
    }
    const step = sequence.steps[0] as ParsedCombo;
    const modifiers = [
      ...(step.ctrl
        ? [
            "control",
          ]
        : []),
      ...(step.alt
        ? [
            "alt",
          ]
        : []),
      ...(step.shift
        ? [
            "shift",
          ]
        : []),
      ...(step.meta
        ? [
            "meta",
          ]
        : []),
    ];
    const timer = setTimeout(() => {
      holds.delete(entry.id);
      run(
        [
          candidate,
        ],
        event,
        activeScopeDepths(),
        false,
      );
    }, entry.hold);
    holds.set(entry.id, {
      keyId: keyIdOf(event),
      modifiers,
      timer,
    });
  };

  // ---- Dispatch -----------------------------------------------------------------------------

  const dispatch = (
    event: KeyboardEvent,
    type: "keydown" | "keyup",
    allowDeferral = true,
  ): boolean => {
    // 229 is what browsers report while an input method (IME) is composing text.
    if (event.isComposing || event.keyCode === 229) {
      return false;
    }

    const depths = activeScopeDepths();
    const window = eventWindow(event, type);
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
      const sequence = entry.sequences.find((candidate) =>
        prefixMatches(entry, candidate, candidate.steps.length, window),
      );
      if (sequence === undefined) {
        continue;
      }
      const lastStep = sequence.steps[sequence.steps.length - 1] as ParsedCombo;
      if (shouldIgnore(entry, lastStep, event)) {
        continue;
      }
      candidates.push({
        depth,
        entry,
        sequence,
      });
    }

    // Highest priority first, then the scope closest to the top of the stack, then the longest
    // sequence, then the most recent binding.
    candidates.sort(
      (a, b) =>
        b.entry.priority - a.entry.priority ||
        b.depth - a.depth ||
        b.sequence.steps.length - a.sequence.steps.length ||
        b.entry.id - a.entry.id,
    );

    // Long-press bindings start a timer instead of firing. They are independent of the plain
    // bindings of the same keys, which fire as usual. `trigger()` skips the wait and fires them.
    let immediate = candidates;
    let scheduled = false;
    if (allowDeferral) {
      immediate = candidates.filter(
        (candidate) => candidate.entry.hold === undefined,
      );
      if (type === "keydown" && !event.repeat) {
        for (const candidate of candidates) {
          if (candidate.entry.hold === undefined) {
            continue;
          }
          applyEventEffects(
            [
              candidate,
            ],
            event,
          );
          startHold(candidate, event);
          scheduled = true;
          if (!candidate.entry.passthrough) {
            break;
          }
        }
      }
    }

    if (
      allowDeferral &&
      type === "keydown" &&
      !event.repeat &&
      !isModifierEvent(event)
    ) {
      const waiting = pending;
      if (waiting !== undefined) {
        // A longer match means the user is completing the sequence we were waiting on; otherwise
        // the shorter binding that was waiting fires now, before this key does anything.
        if (
          immediate.some(
            (candidate) => candidate.sequence.steps.length > waiting.length,
          )
        ) {
          clearPending();
        } else {
          flushPending();
        }
      }
      const winner = immediate[0];
      if (winner !== undefined) {
        const length = winner.sequence.steps.length;
        if (hasLongerInProgress(window, depths, length)) {
          // Like Vim: hold the shorter match back until we know whether a longer one follows.
          applyEventEffects(immediate, event);
          pending = {
            candidates: immediate,
            event,
            length,
            timer: setTimeout(flushPending, sequenceTimeout),
          };
          return true;
        }
      }
    }
    return run(immediate, event, depths, true) || scheduled;
  };

  // ---- Keyboard events ----------------------------------------------------------------------

  const onKeyDown = (event: Event) => {
    if (activeRecording !== undefined) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    const id = keyIdOf(keyboardEvent);
    const name = normalizeEventKey(keyboardEvent.key);
    if (pressed.get(id) !== name) {
      pressed.set(id, name);
      notifyPressed();
    }
    if (isModifierEvent(keyboardEvent)) {
      if (!heldModifiers.has(id)) {
        heldModifiers.set(id, {
          time: Date.now(),
          used: false,
        });
      }
    } else {
      for (const state of heldModifiers.values()) {
        state.used = true;
      }
    }
    pushHistory(keyboardEvent);
    dispatch(keyboardEvent, "keydown");
  };

  const onKeyUp = (event: Event) => {
    if (activeRecording !== undefined) {
      return;
    }
    const keyboardEvent = event as KeyboardEvent;
    const id = keyIdOf(keyboardEvent);
    let pressedChanged = pressed.delete(id);
    // macOS never sends keyup for keys released while Cmd is held, so they would stay "pressed".
    if (normalizeEventKey(keyboardEvent.key) === "meta") {
      for (const [otherId, key] of pressed) {
        if (!MODIFIER_KEYS.has(key)) {
          pressed.delete(otherId);
          pressedChanged = true;
        }
      }
    }
    if (pressedChanged) {
      notifyPressed();
    }
    cancelHolds(keyboardEvent);

    if (isModifierEvent(keyboardEvent)) {
      const state = heldModifiers.get(id);
      heldModifiers.delete(id);
      // A modifier pressed and released quickly, with no other key in between, is a "tap".
      if (
        state !== undefined &&
        !state.used &&
        Date.now() - state.time <= tapTimeout
      ) {
        pushHistory(keyboardEvent, normalizeEventKey(keyboardEvent.key));
        dispatch(keyboardEvent, "keydown");
      }
    }
    dispatch(keyboardEvent, "keyup");
  };

  const resetState = () => {
    const hadPressed = pressed.size > 0;
    pressed.clear();
    heldModifiers.clear();
    history = [];
    clearPending();
    clearHolds();
    if (hadPressed) {
      notifyPressed();
    }
  };
  const onVisibilityChange = () => {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      resetState();
    }
  };

  const attach = () => {
    listenTarget = resolveTarget();
    if (listenTarget === undefined) {
      return;
    }
    listenTarget.addEventListener("keydown", onKeyDown, capture);
    listenTarget.addEventListener("keyup", onKeyUp, capture);
    if (typeof window !== "undefined") {
      window.addEventListener("blur", resetState);
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
      window.removeEventListener("blur", resetState);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
    listenTarget = undefined;
    listening = false;
    resetState();
  };

  /** Listen to the keyboard while there is a binding or someone watching the pressed keys. */
  function sync() {
    const needed = entries.size > 0 || pressedListeners.size > 0;
    if (needed && !listening) {
      attach();
    } else if (!needed && listening) {
      detach();
    }
  }

  // ---- Conflicts ----------------------------------------------------------------------------

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
      entry.hold ?? 0,
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
      for (const sequence of entry.sequences) {
        const key = conflictKey(entry, sequence.signature);
        const group = groups.get(key) ?? {
          combo: sequence.signature,
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

  // ---- Public API ---------------------------------------------------------------------------

  const assertOptionsAllowed = (
    on: "keydown" | "keyup",
    hold: number | undefined,
    sequences: ParsedSequence[],
  ) => {
    const raw = sequences[0]?.raw ?? "";
    const sequence = sequences.find((candidate) => candidate.steps.length > 1);
    if (sequence !== undefined) {
      if (on === "keyup") {
        throw new HotkeyParseError(
          sequence.raw,
          'sequences only work with on: "keydown".',
        );
      }
      if (hold !== undefined) {
        throw new HotkeyParseError(
          sequence.raw,
          "hold only works with single combos, not sequences.",
        );
      }
    }
    if (hold !== undefined) {
      if (!(Number.isFinite(hold) && hold > 0)) {
        throw new HotkeyParseError(
          raw,
          "hold must be a number of milliseconds greater than 0.",
        );
      }
      if (on === "keyup") {
        throw new HotkeyParseError(raw, 'hold only works with on: "keydown".');
      }
    }
  };

  const register = (
    sequences: ParsedSequence[],
    action: string | undefined,
    handler: HotkeyHandler,
    bindOptions: HotkeyOptions,
  ): Unbind => {
    const merged: HotkeyOptions = {
      ...defaults,
      ...stripUndefined(bindOptions),
    };
    const on = merged.on ?? "keydown";
    assertOptionsAllowed(on, merged.hold, sequences);
    const entry: Entry = {
      action,
      description: merged.description,
      element: merged.element ?? null,
      enabled: merged.enabled ?? true,
      exact: merged.exact ?? true,
      group: merged.group,
      handler,
      hold: merged.hold,
      id: nextEntryId++,
      ignoreInputs: merged.ignoreInputs ?? "auto",
      label: merged.label,
      layout: merged.layout ?? "logical",
      on,
      once: merged.once ?? false,
      passthrough: merged.passthrough ?? false,
      preventDefault: merged.preventDefault ?? true,
      priority: merged.priority ?? 0,
      repeat: merged.repeat ?? false,
      scope: merged.scope ?? GLOBAL_SCOPE,
      sequences,
      stopPropagation: merged.stopPropagation ?? false,
    };
    entries.set(entry.id, entry);
    sync();
    changed();
    reportConflicts(entry);

    return () => {
      if (entries.delete(entry.id)) {
        const hold = holds.get(entry.id);
        if (hold !== undefined) {
          clearTimeout(hold.timer);
          holds.delete(entry.id);
        }
        sync();
        changed();
      }
    };
  };

  const bind: Hotkeys["bind"] = (combo, handler, bindOptions = {}) =>
    register(validate(toList(combo)), undefined, handler, bindOptions);

  const bindAction: Hotkeys["bindAction"] = (
    action,
    handler,
    bindOptions = {},
  ) => {
    if (!actions.has(action)) {
      throw new UnknownActionError(action);
    }
    return register(resolveSequences(action), action, handler, bindOptions);
  };

  const setShortcut: Hotkeys["setShortcut"] = (action, keys) => {
    const definition = actions.get(action);
    if (definition === undefined) {
      throw new UnknownActionError(action);
    }
    const next = keys === null ? definition.keys : toList(keys);
    const sequences = validate(next);
    const affected = [
      ...entries.values(),
    ].filter((entry) => entry.action === action);
    for (const entry of affected) {
      assertOptionsAllowed(entry.on, entry.hold, sequences);
    }
    if (keys === null) {
      overrides.delete(action);
    } else {
      overrides.set(action, next);
    }
    for (const entry of affected) {
      entry.sequences = resolveSequences(action);
    }
    changed();
    for (const entry of affected) {
      reportConflicts(entry);
    }
  };

  const pushScope = (name: string, scopeOptions: ScopeOptions = {}): Unbind => {
    const frame: ScopeFrame = {
      id: nextScopeId++,
      inherit: scopeOptions.inherit ?? true,
      name,
    };
    scopeStack.push(frame);
    changed();
    return () => {
      const index = scopeStack.findIndex(
        (candidate) => candidate.id === frame.id,
      );
      if (index > 0) {
        scopeStack.splice(index, 1);
        changed();
      }
    };
  };

  const simulate = (step: ParsedCombo): KeyboardEvent =>
    new KeyboardEvent("keydown", {
      altKey: step.alt,
      bubbles: true,
      cancelable: true,
      code: step.modifierOnly ? "" : nameToCode(step.key),
      ctrlKey: step.ctrl,
      key: nameToEventKey(step.key),
      metaKey: step.meta,
      shiftKey: step.shift,
    });

  const trigger = (combo: string): boolean => {
    if (typeof KeyboardEvent === "undefined") {
      throw new HotkeysEnvironmentError(
        "trigger() needs KeyboardEvent, which is not available in this environment.",
      );
    }
    const sequence = parseSequence(combo, platform);
    const savedHistory = history;
    history = [];
    try {
      const events = sequence.steps.map(simulate);
      events.forEach((event, index) => {
        const step = sequence.steps[index] as ParsedCombo;
        // In a sequence, a modifier-only step stands for a tap of that modifier.
        pushHistory(
          event,
          sequence.steps.length > 1 && step.modifierOnly ? step.key : undefined,
        );
      });
      // Earlier steps only fill the history; just the final step is dispatched, without waiting.
      return dispatch(
        events[events.length - 1] as KeyboardEvent,
        "keydown",
        false,
      );
    } finally {
      history = savedHistory;
    }
  };

  const keyPressed = (name: string): boolean => {
    for (const [code, pressedKey] of pressed) {
      if (pressedKey === name || codeToName(code) === name) {
        return true;
      }
    }
    return false;
  };

  const isPressed = (combo: string): boolean => {
    const parsed = parseCombo(combo, platform);
    const needed = [
      ...(parsed.ctrl
        ? [
            "control",
          ]
        : []),
      ...(parsed.alt
        ? [
            "alt",
          ]
        : []),
      ...(parsed.shift
        ? [
            "shift",
          ]
        : []),
      ...(parsed.meta
        ? [
            "meta",
          ]
        : []),
      ...(parsed.modifierOnly
        ? []
        : [
            parsed.key,
          ]),
    ];
    return needed.every(keyPressed);
  };

  const subscribePressed: Hotkeys["subscribePressed"] = (listener) => {
    pressedListeners.add(listener);
    sync();
    return () => {
      pressedListeners.delete(listener);
      sync();
    };
  };

  const record: Hotkeys["record"] = (recordOptions = {}) => {
    activeRecording?.cancel();
    const recording = startRecording(resolveTarget(), platform, recordOptions);
    activeRecording = recording;
    const done = () => {
      if (activeRecording === recording) {
        activeRecording = undefined;
      }
    };
    recording.promise.then(done, done);
    return recording.promise;
  };

  // Snapshots are cached per version so `getBindings()`/`getShortcuts()` can feed React's
  // useSyncExternalStore: the same array comes back until something changes.
  let bindingsCache:
    | {
        version: number;
        value: readonly BindingInfo[];
      }
    | undefined;
  const getBindings = (): readonly BindingInfo[] => {
    if (bindingsCache?.version !== version) {
      const depths = activeScopeDepths();
      const value = Object.freeze(
        [
          ...entries.values(),
        ].map((entry) => toInfo(entry, depths)),
      );
      bindingsCache = {
        value,
        version,
      };
    }
    return bindingsCache.value;
  };

  let shortcutsCache:
    | {
        version: number;
        value: readonly ShortcutInfo[];
      }
    | undefined;
  const getShortcuts = (): readonly ShortcutInfo[] => {
    if (shortcutsCache?.version !== version) {
      const value = Object.freeze(
        [
          ...actions,
        ].map(([action, definition]): ShortcutInfo => {
          const override = overrides.get(action);
          return {
            action,
            customized: override !== undefined,
            defaultKeys: [
              ...definition.keys,
            ],
            keys: [
              ...(override ?? definition.keys),
            ],
            ...(definition.label !== undefined && {
              label: definition.label,
            }),
            ...(definition.description !== undefined && {
              description: definition.description,
            }),
            ...(definition.group !== undefined && {
              group: definition.group,
            }),
          };
        }),
      );
      shortcutsCache = {
        value,
        version,
      };
    }
    return shortcutsCache.value;
  };

  return {
    bind,
    bindAction,
    destroy: () => {
      activeRecording?.cancel();
      entries.clear();
      scopeStack.splice(1);
      detach();
      changed();
    },
    getActiveScopes: () =>
      [
        ...activeScopeDepths().entries(),
      ]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name),
    getBindings,
    getConflicts: () => findConflicts(),
    getOverrides: () =>
      Object.fromEntries(
        [
          ...overrides,
        ].map(([action, keys]) => [
          action,
          [
            ...keys,
          ],
        ]),
      ),
    getShortcuts,
    isPressed,
    notify: changed,
    platform,
    pushScope,
    record,
    setShortcut,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribePressed,
    trigger,
  };
}

/** Drops `undefined` values so they do not override instance defaults. */
function stripUndefined(options: HotkeyOptions): HotkeyOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
}
