import { describe, expect, it } from "vitest";
import { formatHotkey, HotkeyParseError } from "../src/index.js";
import { parseCombo } from "../src/parser.js";

describe("parseCombo", () => {
  it("parses modifiers and a key regardless of case and order", () => {
    const combo = parseCombo("Shift+Ctrl+K", "other");
    expect(combo).toMatchObject({
      ctrl: true,
      key: "k",
      shift: true,
      signature: "ctrl+shift+k",
    });
  });

  it("resolves mod per platform", () => {
    expect(parseCombo("mod+k", "mac").signature).toBe("meta+k");
    expect(parseCombo("mod+k", "other").signature).toBe("ctrl+k");
  });

  it("understands aliases", () => {
    expect(parseCombo("cmd+esc", "other").signature).toBe("meta+escape");
    expect(parseCombo("option+up", "other").signature).toBe("alt+arrowup");
  });

  it("parses the plus key", () => {
    expect(parseCombo("ctrl++", "other")).toMatchObject({
      ctrl: true,
      key: "+",
    });
    expect(parseCombo("+", "other").key).toBe("+");
    expect(parseCombo("ctrl+plus", "other").key).toBe("+");
  });

  it("supports modifier-only combos", () => {
    expect(parseCombo("shift", "other")).toMatchObject({
      key: "shift",
      modifierOnly: true,
      shift: true,
    });
    expect(parseCombo("ctrl+shift", "other").signature).toBe("ctrl+shift");
  });

  it.each([
    "",
    "ctrl+",
    "k+ctrl",
    "ctrl+ctrl+k",
    "ctrl+a+b",
    "g g",
    "ctrl+ +k",
  ])("rejects %j", (raw) => {
    expect(() => parseCombo(raw, "other")).toThrow(HotkeyParseError);
  });
});

describe("formatHotkey", () => {
  it("uses symbols on macOS", () => {
    expect(
      formatHotkey("mod+shift+k", {
        platform: "mac",
      }),
    ).toBe("⇧⌘K");
  });

  it("uses names elsewhere", () => {
    expect(
      formatHotkey("mod+shift+k", {
        platform: "other",
      }),
    ).toBe("Ctrl+Shift+K");
    expect(
      formatHotkey("esc", {
        platform: "other",
      }),
    ).toBe("Esc");
    expect(
      formatHotkey("up", {
        platform: "mac",
      }),
    ).toBe("↑");
  });
});
