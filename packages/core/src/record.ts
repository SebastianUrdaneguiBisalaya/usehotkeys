import { HotkeysEnvironmentError } from "./errors.js";
import { codeToName, normalizeComboKey, normalizeEventKey } from "./keys.js";
import { isAlphanumeric, isSymbol } from "./matcher.js";
import type { Platform, RecordOptions } from "./types.js";

/** A recording in progress. */
export type Recording = {
  /** Resolves with the recorded combo, or `null` when cancelled. */
  promise: Promise<string | null>;
  cancel: () => void;
};

const MODIFIER_KEYS = new Set([
  "alt",
  "control",
  "meta",
  "shift",
]);
const IGNORED_KEYS = new Set([
  "dead",
  "process",
  "unidentified",
]);

/** The key name to write for a recorded event, falling back to the physical key like the matcher does. */
function recordedKey(event: KeyboardEvent): string {
  const key = normalizeEventKey(event.key ?? "");
  const code = codeToName(event.code ?? "");
  const nonLatin = key.length === 1 && key.charCodeAt(0) > 127;
  const digitWithShift = event.shiftKey && /^[0-9]$/.test(code);
  if (
    isAlphanumeric(code) &&
    key !== code &&
    (event.altKey || nonLatin || digitWithShift)
  ) {
    return code;
  }
  return key;
}

function modifiersOf(
  event: KeyboardEvent,
  platform: Platform,
  useMod: boolean,
): string[] {
  const altGraph = event.getModifierState?.("AltGraph") === true;
  const primary = platform === "mac" ? "meta" : "ctrl";
  const flags = {
    alt: event.altKey && !altGraph,
    ctrl: event.ctrlKey && !altGraph,
    meta: event.metaKey,
    shift: event.shiftKey,
  };
  const parts: string[] = [];
  for (const name of [
    "ctrl",
    "alt",
    "shift",
    "meta",
  ] as const) {
    if (flags[name]) {
      parts.push(useMod && name === primary ? "mod" : name);
    }
  }
  return parts;
}

/** Listens for the next combo on `target`. Used by `Hotkeys.record`. */
export function startRecording(
  target: EventTarget | undefined,
  platform: Platform,
  options: RecordOptions,
): Recording {
  let cancel = () => {};

  const promise = new Promise<string | null>((resolve, reject) => {
    if (target === undefined) {
      reject(
        new HotkeysEnvironmentError(
          "record() needs a DOM to listen for key presses.",
        ),
      );
      return;
    }
    if (options.signal?.aborted) {
      resolve(null);
      return;
    }

    const useMod = options.mod ?? true;
    const cancelKey =
      options.cancelKey === undefined ? "escape" : options.cancelKey;
    const normalizedCancelKey =
      cancelKey === null ? null : normalizeComboKey(cancelKey);
    let peakModifiers: string | undefined;

    const finish = (value: string | null) => {
      target.removeEventListener("keydown", onKeyDown, true);
      target.removeEventListener("keyup", onKeyUp, true);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);

    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onKeyDown = (raw: Event) => {
      const event = raw as KeyboardEvent;
      swallow(event);
      if (event.isComposing || event.repeat) {
        return;
      }
      const key = recordedKey(event);
      if (IGNORED_KEYS.has(key)) {
        return;
      }
      const modifiers = modifiersOf(event, platform, useMod);
      if (MODIFIER_KEYS.has(key)) {
        if (modifiers.length > 0) {
          peakModifiers = modifiers.join("+");
          options.onChange?.(peakModifiers);
        }
        return;
      }
      // `?` already implies Shift, so the combo is written without it.
      const parts = isSymbol(key)
        ? modifiers.filter((part) => part !== "shift")
        : modifiers;
      const combo = [
        ...parts,
        key,
      ].join("+");
      if (
        normalizedCancelKey !== null &&
        parts.length === 0 &&
        key === normalizedCancelKey
      ) {
        finish(null);
        return;
      }
      options.onChange?.(combo);
      finish(combo);
    };

    const onKeyUp = (raw: Event) => {
      const event = raw as KeyboardEvent;
      swallow(event);
      const nothingHeld = !(
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey
      );
      if (options.modifierOnly && nothingHeld && peakModifiers !== undefined) {
        finish(peakModifiers);
      }
    };

    target.addEventListener("keydown", onKeyDown, true);
    target.addEventListener("keyup", onKeyUp, true);
    options.signal?.addEventListener("abort", onAbort);
    cancel = () => finish(null);
  });

  return {
    cancel: () => cancel(),
    promise,
  };
}
