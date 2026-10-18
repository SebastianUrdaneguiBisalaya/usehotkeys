import { codeToName, normalizeEventKey, SYMBOL_CODES } from "./keys.js";
import type { ParsedCombo } from "./parser.js";
import type { KeyLayout } from "./types.js";

export const isAlphanumeric = (value: string) => /^[a-z0-9]$/.test(value);

/** A single printable character that is not a letter or digit, such as `?` or `+`. */
export const isSymbol = (value: string) =>
  value.length === 1 && !isAlphanumeric(value);

function matchesKey(
  combo: ParsedCombo,
  event: KeyboardEvent,
  layout: KeyLayout,
): boolean {
  const code = codeToName(event.code ?? "");

  if (layout === "physical") {
    return (SYMBOL_CODES[combo.key] ?? combo.key) === code;
  }

  const key = normalizeEventKey(event.key ?? "");
  if (key === combo.key) {
    return true;
  }

  // Numpad keys can be addressed by position even though they type digits: "numpad1".
  if (combo.key.startsWith("numpad") && combo.key === code) {
    return true;
  }

  // The layout did not give us the Latin letter/digit the combo asks for. That happens with
  // Option on macOS ("å"), non-Latin layouts ("ф") and Shift+digit ("!"). Fall back to the
  // physical key, but only for letters and digits.
  if (isAlphanumeric(code) && isAlphanumeric(combo.key) && code === combo.key) {
    const nonLatin = key.length === 1 && key.charCodeAt(0) > 127;
    const digitWithShift = event.shiftKey && /^[0-9]$/.test(code);
    return event.altKey || nonLatin || digitWithShift;
  }
  return false;
}

/** Returns `true` when `event` is the key press described by `combo`. */
export function matchesEvent(
  combo: ParsedCombo,
  event: KeyboardEvent,
  layout: KeyLayout,
  exact: boolean,
): boolean {
  // AltGr is reported as ctrl+alt on Windows; it only types a character, so ignore both.
  const altGraph = event.getModifierState?.("AltGraph") === true;
  const ctrl = event.ctrlKey && !altGraph;
  const alt = event.altKey && !altGraph;

  if (exact) {
    // `?` already implies Shift on most layouts, so Shift is not compared for symbols.
    const shiftImplied = layout === "logical" && isSymbol(combo.key);
    if (
      ctrl !== combo.ctrl ||
      alt !== combo.alt ||
      event.metaKey !== combo.meta
    ) {
      return false;
    }
    if (!shiftImplied && event.shiftKey !== combo.shift) {
      return false;
    }
  } else if (
    (combo.ctrl && !ctrl) ||
    (combo.alt && !alt) ||
    (combo.meta && !event.metaKey) ||
    (combo.shift && !event.shiftKey)
  ) {
    return false;
  }

  return matchesKey(combo, event, layout);
}
