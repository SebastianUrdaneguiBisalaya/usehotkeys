/** Operating-system family used to resolve `mod` and to format shortcuts. */
export type Platform = "mac" | "other";

/**
 * How the key part of a combo is compared with the keyboard event.
 *
 * - `"logical"` (default): the character the user's layout produces (`event.key`).
 *   `"z"` is whatever key types a `z` on Dvorak, AZERTY, Cyrillic, etc.
 * - `"physical"`: the key's position on the keyboard (`event.code`).
 *   `"z"` is always the key that sits where `Z` is on a QWERTY keyboard.
 */
export type KeyLayout = "logical" | "physical";

/** Event a binding listens to. */
export type HotkeyEventType = "keydown" | "keyup";

/**
 * Controls whether a binding is skipped while the user is typing.
 *
 * - `"auto"` (default): skip inside text inputs, textareas, selects and `contenteditable`
 *   elements, unless the combo contains `ctrl` or `meta` (so `mod+s` still works while typing).
 * - `true`: always skip inside editable elements.
 * - `false`: never skip.
 * - a CSS selector: skip when the event target matches (or is inside) that selector.
 * - a function: return `true` to skip the event.
 */
export type IgnoreInputs =
  | boolean
  | "auto"
  | string
  | ((event: KeyboardEvent) => boolean);

/** Options for a single {@link Hotkeys.bind} call. */
export type HotkeyOptions = {
  /** Scope the binding belongs to. Defaults to `"global"`. Use `"*"` to be active in every scope. */
  scope?: string | undefined;
  /** Higher priority wins when several bindings match the same keys. Defaults to `0`. */
  priority?: number | undefined;
  /** Event to listen to. Defaults to `"keydown"`. Sequences only work with `"keydown"`. */
  on?: HotkeyEventType | undefined;
  /**
   * Whether the binding is enabled. Pass a function to decide at event time.
   * Defaults to `true`.
   */
  enabled?: boolean | (() => boolean) | undefined;
  /** Remove the binding automatically after it fires once. Defaults to `false`. */
  once?: boolean | undefined;
  /** Fire again while the key is held down (auto-repeat). Defaults to `false`. */
  repeat?: boolean | undefined;
  /** Call `event.preventDefault()` when the binding fires. Defaults to `true`. */
  preventDefault?: boolean | undefined;
  /** Call `event.stopPropagation()` when the binding fires. Defaults to `false`. */
  stopPropagation?: boolean | undefined;
  /** See {@link IgnoreInputs}. Defaults to `"auto"`. */
  ignoreInputs?: IgnoreInputs | undefined;
  /** Only fire when the event happens inside this element. */
  element?: Element | null | undefined;
  /** See {@link KeyLayout}. Defaults to `"logical"`. */
  layout?: KeyLayout | undefined;
  /**
   * `true` (default): modifiers must match exactly, so `ctrl+k` does not fire for `ctrl+shift+k`.
   * `false`: extra modifiers are allowed.
   */
  exact?: boolean | undefined;
  /**
   * By default only the highest-ranked matching binding fires.
   * With `passthrough: true` the binding fires and lower-ranked matches still run afterwards.
   */
  passthrough?: boolean | undefined;
  /** Human-readable name, shown by {@link Hotkeys.getBindings}. */
  label?: string | undefined;
  /** Longer description, shown by {@link Hotkeys.getBindings}. */
  description?: string | undefined;
  /** Group name used to organise a shortcut cheat sheet. */
  group?: string | undefined;
};

/** Information about the binding that fired, passed to handlers. */
export type HotkeyContext = {
  /** The combo that matched, exactly as it was written in `bind`. */
  combo: string;
  /** The binding that owns the handler. */
  binding: BindingInfo;
};

/** Function called when a hotkey fires. */
export type HotkeyHandler = (
  event: KeyboardEvent,
  context: HotkeyContext,
) => void;

/** Removes whatever created it. Safe to call more than once. */
export type Unbind = () => void;

/** Read-only description of a registered binding. */
export type BindingInfo = {
  id: number;
  /** The action id when the binding was created with `bindAction`. */
  action?: string;
  /** Combos exactly as written in `bind` (or as currently assigned to the action). */
  combos: string[];
  scope: string;
  priority: number;
  on: HotkeyEventType;
  label?: string;
  description?: string;
  group?: string;
  /** `false` when `enabled` is off. */
  enabled: boolean;
  /** `true` when the binding's scope is currently active and it is enabled. */
  active: boolean;
};

/** A group of bindings that compete for the same keys with no way to pick a winner. */
export type HotkeyConflict = {
  /** Normalised combo, e.g. `"ctrl+k"`. */
  combo: string;
  scope: string;
  bindings: BindingInfo[];
};

/** Options for {@link Hotkeys.pushScope}. */
export type ScopeOptions = {
  /**
   * `true` (default): scopes below this one stay active.
   * `false`: only this scope (plus `"*"` bindings) is active — ideal for modals.
   */
  inherit?: boolean | undefined;
};

/** A named action in the keymap, with its default keys and optional help-screen metadata. */
export type KeymapDefinition = {
  /** Default combo(s), e.g. `"mod+k"` or `["j", "arrowdown"]`. An empty array means "no shortcut". */
  keys: string | readonly string[];
  /** Human-readable name, inherited by bindings of this action. */
  label?: string | undefined;
  /** Longer description, inherited by bindings of this action. */
  description?: string | undefined;
  /** Category, inherited by bindings of this action. */
  group?: string | undefined;
};

/** One keymap entry: just the keys, or keys plus metadata. */
export type KeymapEntry = string | readonly string[] | KeymapDefinition;

/** Action ids mapped to their default shortcuts: `{ openPalette: "mod+k" }`. */
export type Keymap = Record<string, KeymapEntry>;

/** An action's current shortcut, for settings screens. */
export type ShortcutInfo = {
  action: string;
  /** The keys in effect: the user's override, or the defaults. */
  keys: string[];
  defaultKeys: string[];
  /** `true` when the user changed the shortcut from its default. */
  customized: boolean;
  label?: string;
  description?: string;
  group?: string;
};

/** Options for {@link createHotkeys}. */
export type HotkeysOptions = {
  /** Where to listen for keyboard events. Defaults to `document` (nothing happens on the server). */
  target?: EventTarget | undefined;
  /** Force the platform instead of detecting it. */
  platform?: Platform | undefined;
  /** Listen in the capture phase. Defaults to `false`. */
  capture?: boolean | undefined;
  /** Milliseconds allowed between the steps of a sequence such as `"g i"`. Defaults to `1000`. */
  sequenceTimeout?: number | undefined;
  /** Named actions with default shortcuts, for `bindAction`. Lets users customise shortcuts. */
  keymap?: Keymap | undefined;
  /** The user's saved customisations, `{ action: keys }`, applied on top of the keymap. */
  overrides?: Record<string, string | readonly string[]> | undefined;
  /** Defaults applied to every binding of this instance. */
  defaults?: HotkeyOptions | undefined;
  /** Called when a new binding conflicts with an existing one. */
  onConflict?: ((conflict: HotkeyConflict) => void) | undefined;
  /** When `true` and no `onConflict` is given, conflicts are logged with `console.warn`. */
  debug?: boolean | undefined;
};

/** Options for {@link Hotkeys.record}. */
export type RecordOptions = {
  /** Called as the user presses keys, e.g. `"ctrl"`, then `"ctrl+shift"`, then `"ctrl+shift+k"`. */
  onChange?: ((combo: string) => void) | undefined;
  /**
   * Key (pressed alone) that cancels the recording and resolves with `null`.
   * Defaults to `"escape"`. Use `null` if `escape` itself must be recordable.
   */
  cancelKey?: string | null | undefined;
  /** Write the platform's main modifier as `mod` (`Cmd` on macOS, `Ctrl` elsewhere). Defaults to `true`. */
  mod?: boolean | undefined;
  /** Also accept a combo made only of modifiers (e.g. `"shift"`), recorded when they are released. Defaults to `false`. */
  modifierOnly?: boolean | undefined;
  /** Abort the recording; it resolves with `null`. */
  signal?: AbortSignal | undefined;
};

/** A keyboard-shortcut engine. Create one with {@link createHotkeys}. */
export type Hotkeys = {
  /**
   * Registers `handler` for one or more combos (`"mod+k"`, `["ctrl+s", "meta+s"]`) or sequences
   * (`"g i"`: press `g`, then `i`).
   * Returns a function that removes the binding.
   *
   * @throws {HotkeyParseError} when a combo is invalid.
   */
  bind: (
    combo: string | readonly string[],
    handler: HotkeyHandler,
    options?: HotkeyOptions,
  ) => Unbind;
  /**
   * Runs the winning active binding for `combo` as if the user pressed it.
   * Returns `true` when a handler ran.
   */
  trigger: (combo: string) => boolean;
  /** Activates a scope on top of the stack. Returns a function that removes it. */
  pushScope: (name: string, options?: ScopeOptions) => Unbind;
  /** Names of the scopes that are currently active, top of the stack first. */
  getActiveScopes: () => string[];
  /**
   * Registers `handler` for a named action of the keymap. The keys come from the keymap (or the
   * user's override) and follow `setShortcut` changes automatically.
   *
   * @throws {UnknownActionError} when the action is not in the keymap.
   */
  bindAction: (
    action: string,
    handler: HotkeyHandler,
    options?: HotkeyOptions,
  ) => Unbind;
  /**
   * Changes the shortcut of an action. Pass `null` to go back to the default and `[]` to remove
   * the shortcut. Bindings of the action pick up the change immediately.
   *
   * @throws {UnknownActionError} when the action is not in the keymap.
   * @throws {HotkeyParseError} when a combo is invalid.
   */
  setShortcut: (
    action: string,
    keys: string | readonly string[] | null,
  ) => void;
  /** Every action of the keymap with its current keys, e.g. for a settings screen. */
  getShortcuts: () => readonly ShortcutInfo[];
  /** The user's customisations, ready to save (e.g. to `localStorage`) and pass back as `overrides`. */
  getOverrides: () => Record<string, string[]>;
  /**
   * Calls `listener` whenever the bindings, scopes or shortcuts change. Returns a function that
   * stops listening. Use it with `getBindings()`/`getShortcuts()`, which return the same array
   * until something changes.
   */
  subscribe: (listener: () => void) => Unbind;
  /**
   * Tells subscribers to re-read the state. Call it when something an `enabled` function depends
   * on has changed, since the engine cannot see that by itself.
   */
  notify: () => void;
  /**
   * Every registered binding, e.g. to render a shortcut cheat sheet. The same array is returned
   * until something changes (see {@link Hotkeys.subscribe}).
   */
  getBindings: () => readonly BindingInfo[];
  /** Groups of bindings that compete for the same keys. */
  getConflicts: () => HotkeyConflict[];
  /** `true` while the key (`"shift"`, `"a"`, `"escape"`…) is held down. */
  isPressed: (key: string) => boolean;
  /**
   * Listens for the next key combination the user presses and resolves with it as a string you can
   * pass to `bind` (e.g. `"mod+shift+k"`), or `null` if it is cancelled. While recording, no
   * binding fires and the keys do not reach the page. Starting a new recording cancels the previous one.
   *
   * @throws {HotkeysEnvironmentError} (as a rejection) when there is no DOM to listen on.
   */
  record: (options?: RecordOptions) => Promise<string | null>;
  /** Platform used for `mod` and formatting. */
  platform: Platform;
  /** Removes every binding and listener. */
  destroy: () => void;
};
