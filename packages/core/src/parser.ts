import { HotkeyParseError } from "./errors.js";
import {
  MODIFIER_ALIASES,
  MODIFIER_KEY_NAMES,
  type Modifier,
  normalizeComboKey,
} from "./keys.js";
import type { Platform } from "./types.js";

/** A combo string broken into modifiers and a key. */
export type ParsedCombo = {
  /** The combo exactly as the caller wrote it. */
  raw: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Normalised key (`"k"`, `"escape"`, `"/"`). For modifier-only combos it is the modifier's key name. */
  key: string;
  /** `true` for combos such as `"shift"` or `"ctrl+shift"`, which have no key besides the modifiers. */
  modifierOnly: boolean;
  /** Stable identity, e.g. `"ctrl+shift+k"`. Equal signatures mean the same keys. */
  signature: string;
};

const MODIFIER_ORDER: readonly Modifier[] = [
  "ctrl",
  "alt",
  "shift",
  "meta",
];

function resolveModifier(
  token: string,
  platform: Platform,
): Modifier | undefined {
  const alias = MODIFIER_ALIASES[token];
  if (alias === undefined) {
    return undefined;
  }
  if (alias === "mod") {
    return platform === "mac" ? "meta" : "ctrl";
  }
  return alias;
}

function splitTokens(raw: string): string[] {
  if (raw === "+") {
    return [
      "+",
    ];
  }
  if (raw.endsWith("++")) {
    return [
      ...raw.slice(0, -2).split("+"),
      "+",
    ];
  }
  return raw.split("+");
}

/**
 * Parses a combo such as `"mod+shift+k"`.
 *
 * The key `+` is written `"ctrl++"` or `"ctrl+plus"`.
 *
 * @throws {HotkeyParseError} when the combo is empty, has a dangling `+`, repeats a modifier,
 * or has more than one non-modifier key.
 */
export function parseCombo(raw: string, platform: Platform): ParsedCombo {
  const combo = raw.trim();
  if (combo === "") {
    throw new HotkeyParseError(raw, "the combo is empty.");
  }
  if (/\s/.test(combo)) {
    throw new HotkeyParseError(
      raw,
      'spaces are not allowed inside a single step. Write the space key as "space".',
    );
  }

  const tokens = splitTokens(combo);
  if (tokens.some((token) => token === "")) {
    throw new HotkeyParseError(
      raw,
      'there is an empty part. To bind the "+" key write "ctrl++" or "ctrl+plus".',
    );
  }

  const modifiers = new Set<Modifier>();
  const addModifier = (modifier: Modifier) => {
    if (modifiers.has(modifier)) {
      throw new HotkeyParseError(
        raw,
        `the modifier "${modifier}" is repeated.`,
      );
    }
    modifiers.add(modifier);
  };

  const last = tokens[tokens.length - 1] as string;
  for (const token of tokens.slice(0, -1)) {
    const modifier = resolveModifier(token.toLowerCase(), platform);
    if (modifier === undefined) {
      throw new HotkeyParseError(
        raw,
        `"${token}" is not a modifier, so it cannot come before the last key.`,
      );
    }
    addModifier(modifier);
  }

  const lastModifier = resolveModifier(last.toLowerCase(), platform);
  let key: string;
  let modifierOnly = false;
  if (lastModifier === undefined) {
    key = normalizeComboKey(last);
  } else {
    addModifier(lastModifier);
    key = MODIFIER_KEY_NAMES[lastModifier];
    modifierOnly = true;
  }

  const parts: string[] = MODIFIER_ORDER.filter((modifier) =>
    modifiers.has(modifier),
  );
  if (!modifierOnly) {
    parts.push(key);
  }

  return {
    alt: modifiers.has("alt"),
    ctrl: modifiers.has("ctrl"),
    key,
    meta: modifiers.has("meta"),
    modifierOnly,
    raw,
    shift: modifiers.has("shift"),
    signature: parts.join("+"),
  };
}

/** A hotkey made of one or more steps, e.g. `"g i"` is two steps. A plain combo has one step. */
export type ParsedSequence = {
  /** The hotkey exactly as the caller wrote it. */
  raw: string;
  steps: ParsedCombo[];
  /** Stable identity, e.g. `"ctrl+k ctrl+s"`. */
  signature: string;
};

/**
 * Parses a hotkey that may be a sequence: steps separated by spaces, e.g. `"g i"` or
 * `"mod+k mod+s"`. A hotkey without spaces is a sequence with one step.
 *
 * @throws {HotkeyParseError} when a step is invalid or a multi-step sequence has a step with several modifiers and no key.
 */
export function parseSequence(raw: string, platform: Platform): ParsedSequence {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new HotkeyParseError(raw, "the combo is empty.");
  }
  const steps = trimmed.split(/\s+/).map((step) => parseCombo(step, platform));
  const modifierCount = (step: ParsedCombo) =>
    [
      step.ctrl,
      step.alt,
      step.shift,
      step.meta,
    ].filter(Boolean).length;
  if (
    steps.length > 1 &&
    steps.some((step) => step.modifierOnly && modifierCount(step) > 1)
  ) {
    throw new HotkeyParseError(
      raw,
      'a step that is only modifiers must be a single modifier (a tap), like "shift shift".',
    );
  }
  return {
    raw,
    signature: steps.map((step) => step.signature).join(" "),
    steps,
  };
}
