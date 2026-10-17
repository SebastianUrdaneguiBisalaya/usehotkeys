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
  /** Event to listen to. Defaults to `"keydown"`. */
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
  /** Combos exactly as written in `bind`. */
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

/** Options for {@link createHotkeys}. */
export type HotkeysOptions = {
  /** Where to listen for keyboard events. Defaults to `document` (nothing happens on the server). */
  target?: EventTarget | undefined;
  /** Force the platform instead of detecting it. */
  platform?: Platform | undefined;
  /** Listen in the capture phase. Defaults to `false`. */
  capture?: boolean | undefined;
  /** Defaults applied to every binding of this instance. */
  defaults?: HotkeyOptions | undefined;
  /** Called when a new binding conflicts with an existing one. */
  onConflict?: ((conflict: HotkeyConflict) => void) | undefined;
  /** When `true` and no `onConflict` is given, conflicts are logged with `console.warn`. */
  debug?: boolean | undefined;
};

/** A keyboard-shortcut engine. Create one with {@link createHotkeys}. */
export type Hotkeys = {
  /**
   * Registers `handler` for one or more combos (`"mod+k"`, `["ctrl+s", "meta+s"]`).
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
  /** Every registered binding, e.g. to render a shortcut cheat sheet. */
  getBindings: () => BindingInfo[];
  /** Groups of bindings that compete for the same keys. */
  getConflicts: () => HotkeyConflict[];
  /** `true` while the key (`"shift"`, `"a"`, `"escape"`…) is held down. */
  isPressed: (key: string) => boolean;
  /** Platform used for `mod` and formatting. */
  platform: Platform;
  /** Removes every binding and listener. */
  destroy: () => void;
};
