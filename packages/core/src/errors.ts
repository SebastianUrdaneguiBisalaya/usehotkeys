/** Base class for every error thrown by `@usehotkeys/core`. Use it with `instanceof`. */
export class HotkeysError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HotkeysError";
  }
}

/** Thrown when a combo string such as `"ctrl+"` or `"foo+k"` cannot be parsed. */
export class HotkeyParseError extends HotkeysError {
  /** The combo string that failed to parse. */
  readonly combo: string;

  constructor(combo: string, reason: string) {
    super(`Invalid hotkey "${combo}": ${reason}`);
    this.name = "HotkeyParseError";
    this.combo = combo;
  }
}

/** Thrown when an API needs a browser feature (e.g. `KeyboardEvent`) that does not exist. */
export class HotkeysEnvironmentError extends HotkeysError {
  constructor(message: string) {
    super(message);
    this.name = "HotkeysEnvironmentError";
  }
}

/** Thrown when an action id is not in the keymap, e.g. `bindAction("sav")` when only `save` exists. */
export class UnknownActionError extends HotkeysError {
  /** The action id that was not found. */
  readonly action: string;

  constructor(action: string) {
    super(
      `Unknown action "${action}". Add it to the "keymap" option of createHotkeys().`,
    );
    this.name = "UnknownActionError";
    this.action = action;
  }
}
