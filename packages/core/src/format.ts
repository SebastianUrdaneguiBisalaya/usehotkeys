import { detectPlatform } from "./environment.js";
import { parseSequence } from "./parser.js";
import type { Platform } from "./types.js";

const MAC_KEYS: Record<string, string> = {
  alt: "⌥",
  backspace: "⌫",
  control: "⌃",
  delete: "⌦",
  enter: "↵",
  escape: "⎋",
  meta: "⌘",
  shift: "⇧",
  tab: "⇥",
};

const COMMON_KEYS: Record<string, string> = {
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  arrowup: "↑",
  space: "Space",
};

const OTHER_KEYS: Record<string, string> = {
  alt: "Alt",
  backspace: "Backspace",
  control: "Ctrl",
  delete: "Del",
  enter: "Enter",
  escape: "Esc",
  meta: "Win",
  shift: "Shift",
  tab: "Tab",
};

/** Options for {@link formatHotkey}. */
export type FormatOptions = {
  /** Defaults to the detected platform. */
  platform?: Platform | undefined;
};

function displayKey(key: string, table: Record<string, string>): string {
  const named = COMMON_KEYS[key] ?? table[key];
  if (named !== undefined) {
    return named;
  }
  return key.length === 1
    ? key.toUpperCase()
    : key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Turns a combo or sequence into text for the user's platform: `"mod+shift+k"` → `"⇧⌘K"` on macOS and
 * `"Ctrl+Shift+K"` elsewhere.
 * Sequences keep their steps apart: `"g i"` → `"G I"`.
 *
 * @throws {HotkeyParseError} when the combo is invalid.
 */
export function formatHotkey(
  combo: string,
  options: FormatOptions = {},
): string {
  const platform = options.platform ?? detectPlatform();
  const table = platform === "mac" ? MAC_KEYS : OTHER_KEYS;

  return parseSequence(combo, platform)
    .steps.map((parsed) => {
      const parts: string[] = [];
      if (parsed.ctrl) parts.push(displayKey("control", table));
      if (parsed.alt) parts.push(displayKey("alt", table));
      if (parsed.shift) parts.push(displayKey("shift", table));
      if (parsed.meta) parts.push(displayKey("meta", table));
      if (!parsed.modifierOnly) parts.push(displayKey(parsed.key, table));
      return platform === "mac" ? parts.join("") : parts.join("+");
    })
    .join(" ");
}
