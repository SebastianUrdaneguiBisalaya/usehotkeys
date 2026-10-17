export type Modifier = "ctrl" | "alt" | "shift" | "meta";

/** Modifier names accepted in combos. `mod` is resolved separately because it depends on the platform. */
export const MODIFIER_ALIASES: Record<string, Modifier | "mod"> = {
  alt: "alt",
  cmd: "meta",
  command: "meta",
  control: "ctrl",
  ctrl: "ctrl",
  meta: "meta",
  mod: "mod",
  opt: "alt",
  option: "alt",
  shift: "shift",
  super: "meta",
  win: "meta",
};

/** The `event.key` value each modifier produces. */
export const MODIFIER_KEY_NAMES: Record<Modifier, string> = {
  alt: "alt",
  ctrl: "control",
  meta: "meta",
  shift: "shift",
};

const KEY_ALIASES: Record<string, string> = {
  del: "delete",
  down: "arrowdown",
  esc: "escape",
  ins: "insert",
  left: "arrowleft",
  pgdn: "pagedown",
  pgup: "pageup",
  plus: "+",
  return: "enter",
  right: "arrowright",
  spacebar: "space",
  up: "arrowup",
};

/** Punctuation keys and the `event.code` (lowercased) of the physical key that types them on QWERTY. */
export const SYMBOL_CODES: Record<string, string> = {
  "-": "minus",
  ",": "comma",
  ";": "semicolon",
  ".": "period",
  "'": "quote",
  "[": "bracketleft",
  "]": "bracketright",
  "/": "slash",
  "\\": "backslash",
  "`": "backquote",
  "+": "equal",
  "=": "equal",
};

/** Normalises the key part of a combo (`"Esc"` → `"escape"`). */
export function normalizeComboKey(token: string): string {
  const lower = token.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

/** Normalises `event.key` (`" "` → `"space"`, `"A"` → `"a"`). */
export function normalizeEventKey(key: string): string {
  if (key === " ") {
    return "space";
  }
  return key.toLowerCase();
}

/** Converts `event.code` into a lowercase name: `"KeyA"` → `"a"`, `"Digit1"` → `"1"`, `"ArrowUp"` → `"arrowup"`. */
export function codeToName(code: string): string {
  if (code.startsWith("Key") && code.length === 4) {
    return code.slice(3).toLowerCase();
  }
  if (code.startsWith("Digit") && code.length === 6) {
    return code.slice(5);
  }
  return code.toLowerCase();
}

/** Builds an `event.code` for a combo key; used when simulating key presses. */
export function nameToCode(name: string): string {
  if (/^[a-z]$/.test(name)) {
    return `Key${name.toUpperCase()}`;
  }
  if (/^[0-9]$/.test(name)) {
    return `Digit${name}`;
  }
  const symbol = SYMBOL_CODES[name] ?? name;
  return symbol.charAt(0).toUpperCase() + symbol.slice(1);
}

/** The `event.key` to use when simulating a key press for a combo key. */
export function nameToEventKey(name: string): string {
  return name === "space" ? " " : name;
}
