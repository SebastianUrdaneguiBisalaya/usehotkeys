import { afterEach, describe, expect, it, vi } from "vitest";
import { createHotkeys, type Hotkeys } from "../src/index.js";
import { key, press } from "./helpers.js";

let hotkeys: Hotkeys;
const make = (options = {}) => {
  hotkeys = createHotkeys({
    platform: "other",
    ...options,
  });
  return hotkeys;
};

afterEach(() => {
  hotkeys?.destroy();
  document.body.innerHTML = "";
});

describe("bind", () => {
  it("fires the handler and prevents the default action", () => {
    const handler = vi.fn();
    make().bind("ctrl+k", handler);
    const event = key("k", {
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[1]).toMatchObject({
      combo: "ctrl+k",
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not prevent the default action when asked not to", () => {
    make().bind("k", () => {}, {
      preventDefault: false,
    });
    expect(key("k").defaultPrevented).toBe(false);
  });

  it("requires exact modifiers by default", () => {
    const handler = vi.fn();
    make().bind("ctrl+4", handler);
    key("4", {
      altKey: true,
      code: "Digit4",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(handler).not.toHaveBeenCalled();
    key("4", {
      code: "Digit4",
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("allows extra modifiers with exact: false", () => {
    const handler = vi.fn();
    make().bind("ctrl+k", handler, {
      exact: false,
    });
    key("k", {
      ctrlKey: true,
      shiftKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("matches symbols such as ? and + without spelling out shift", () => {
    const question = vi.fn();
    const plus = vi.fn();
    make().bind("?", question);
    hotkeys.bind("ctrl++", plus);
    press({
      code: "Slash",
      key: "?",
      shiftKey: true,
    });
    press({
      code: "Equal",
      ctrlKey: true,
      key: "+",
      shiftKey: true,
    });
    expect(question).toHaveBeenCalledTimes(1);
    expect(plus).toHaveBeenCalledTimes(1);
  });

  it("does not confuse arrow keys with letters", () => {
    const handler = vi.fn();
    make().bind("a", handler);
    press({
      code: "ArrowUp",
      key: "ArrowUp",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("uses the character for logical layouts and the position for physical ones", () => {
    const logical = vi.fn();
    const physical = vi.fn();
    make().bind("q", logical);
    hotkeys.bind("w", physical, {
      layout: "physical",
    });
    // Dvorak: the key at the QWERTY "W" position types ",".
    press({
      code: "KeyW",
      key: ",",
    });
    // Dvorak: the key at the QWERTY "X" position types "q".
    press({
      code: "KeyX",
      key: "q",
    });
    expect(logical).toHaveBeenCalledTimes(1);
    expect(physical).toHaveBeenCalledTimes(1);
  });

  it("falls back to the physical key for Option on macOS and non-Latin layouts", () => {
    const handler = vi.fn();
    make().bind("alt+a", handler);
    hotkeys.bind("ctrl+s", handler);
    press({
      altKey: true,
      code: "KeyA",
      key: "å",
    });
    press({
      code: "KeyS",
      ctrlKey: true,
      key: "ы",
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("ignores auto-repeat unless repeat is set", () => {
    const handler = vi.fn();
    make().bind("k", handler);
    key("k", {
      repeat: true,
    });
    expect(handler).not.toHaveBeenCalled();
    hotkeys.bind("j", handler, {
      repeat: true,
    });
    key("j", {
      repeat: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports keyup, once and enabled", () => {
    const up = vi.fn();
    const once = vi.fn();
    const off = vi.fn();
    make().bind("k", up, {
      on: "keyup",
    });
    hotkeys.bind("o", once, {
      once: true,
    });
    hotkeys.bind("d", off, {
      enabled: () => false,
    });
    key("k");
    key("k", {}, "keyup");
    key("o");
    key("o");
    key("d");
    expect(up).toHaveBeenCalledTimes(1);
    expect(once).toHaveBeenCalledTimes(1);
    expect(off).not.toHaveBeenCalled();
  });

  it("returns an idempotent unbind and removes listeners when empty", () => {
    const remove = vi.spyOn(document, "removeEventListener");
    const handler = vi.fn();
    const unbind = make().bind("k", handler);
    unbind();
    unbind();
    key("k");
    expect(handler).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function), false);
    remove.mockRestore();
  });

  it("binds several combos to one handler", () => {
    const handler = vi.fn();
    make().bind(
      [
        "ctrl+s",
        "meta+s",
      ],
      handler,
    );
    key("s", {
      ctrlKey: true,
    });
    key("s", {
      metaKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("restricts a binding to an element", () => {
    const panel = document.createElement("div");
    const outside = document.createElement("div");
    document.body.append(panel, outside);
    const handler = vi.fn();
    make().bind("k", handler, {
      element: panel,
    });
    key("k", {
      target: outside,
    });
    expect(handler).not.toHaveBeenCalled();
    key("k", {
      target: panel,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("applies instance defaults", () => {
    const handler = vi.fn();
    make({
      defaults: {
        preventDefault: false,
      },
    }).bind("k", handler);
    expect(key("k").defaultPrevented).toBe(false);
  });
});

describe("ignoreInputs", () => {
  const typeInto = (element: Element, init: KeyboardEventInit) =>
    key(init.key ?? "", {
      ...init,
      target: element,
    });

  it("skips plain keys inside inputs but keeps ctrl/meta combos", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const plain = vi.fn();
    const withCtrl = vi.fn();
    make().bind("k", plain);
    hotkeys.bind("mod+s", withCtrl);
    typeInto(input, {
      key: "k",
    });
    typeInto(input, {
      code: "KeyS",
      ctrlKey: true,
      key: "s",
    });
    expect(plain).not.toHaveBeenCalled();
    expect(withCtrl).toHaveBeenCalledTimes(1);
  });

  it("does not skip checkboxes and buttons", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    document.body.append(checkbox);
    const handler = vi.fn();
    make().bind("k", handler);
    typeInto(checkbox, {
      key: "k",
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("can be disabled, forced, or customised", () => {
    const textarea = document.createElement("textarea");
    document.body.append(textarea);
    const never = vi.fn();
    const always = vi.fn();
    const custom = vi.fn();
    make().bind("a", never, {
      ignoreInputs: false,
    });
    hotkeys.bind("ctrl+b", always, {
      ignoreInputs: true,
    });
    hotkeys.bind("c", custom, {
      ignoreInputs: () => true,
    });
    typeInto(textarea, {
      key: "a",
    });
    typeInto(textarea, {
      code: "KeyB",
      ctrlKey: true,
      key: "b",
    });
    typeInto(document.body, {
      key: "c",
    });
    expect(never).toHaveBeenCalledTimes(1);
    expect(always).not.toHaveBeenCalled();
    expect(custom).not.toHaveBeenCalled();
  });

  it("accepts a selector", () => {
    const div = document.createElement("div");
    div.className = "no-hotkeys";
    document.body.append(div);
    const handler = vi.fn();
    make().bind("k", handler, {
      ignoreInputs: ".no-hotkeys",
    });
    typeInto(div, {
      key: "k",
    });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("priority and conflicts", () => {
  it("lets only the most recent binding win by default", () => {
    const first = vi.fn();
    const second = vi.fn();
    make().bind("k", first);
    hotkeys.bind("k", second);
    key("k");
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("lets a higher priority win even if it was registered first", () => {
    const high = vi.fn();
    const low = vi.fn();
    make().bind("k", high, {
      priority: 10,
    });
    hotkeys.bind("k", low);
    key("k");
    expect(high).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
  });

  it("runs lower-ranked bindings after a passthrough binding", () => {
    const calls: string[] = [];
    make().bind("k", () => calls.push("base"));
    hotkeys.bind("k", () => calls.push("top"), {
      passthrough: true,
    });
    key("k");
    expect(calls).toEqual([
      "top",
      "base",
    ]);
  });

  it("does not let an ignored binding block a lower one", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const low = vi.fn();
    make().bind("k", low, {
      ignoreInputs: false,
    });
    hotkeys.bind("k", vi.fn(), {
      priority: 5,
    });
    key("k", {
      target: input,
    });
    expect(low).toHaveBeenCalledTimes(1);
  });

  it("reports conflicts through onConflict and getConflicts", () => {
    const onConflict = vi.fn();
    make({
      onConflict,
    });
    hotkeys.bind("mod+k", () => {}, {
      label: "A",
    });
    expect(onConflict).not.toHaveBeenCalled();
    hotkeys.bind("ctrl+k", () => {}, {
      label: "B",
    });
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onConflict.mock.calls[0]?.[0]).toMatchObject({
      combo: "ctrl+k",
      scope: "global",
    });
    expect(hotkeys.getConflicts()).toHaveLength(1);
  });

  it("does not report a conflict when priority differs or passthrough is set", () => {
    make();
    hotkeys.bind("k", () => {});
    hotkeys.bind("k", () => {}, {
      priority: 1,
    });
    hotkeys.bind("k", () => {}, {
      passthrough: true,
    });
    expect(hotkeys.getConflicts()).toEqual([]);
  });

  it("warns with console.warn in debug mode", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    make({
      debug: true,
    });
    hotkeys.bind("k", () => {});
    hotkeys.bind("k", () => {});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("scopes", () => {
  it("only fires bindings from active scopes", () => {
    const handler = vi.fn();
    make().bind("k", handler, {
      scope: "editor",
    });
    key("k");
    expect(handler).not.toHaveBeenCalled();
    const pop = hotkeys.pushScope("editor");
    key("k");
    expect(handler).toHaveBeenCalledTimes(1);
    pop();
    key("k");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("inherits lower scopes by default and prefers the top scope", () => {
    const global = vi.fn();
    const panel = vi.fn();
    make().bind("a", global);
    hotkeys.bind("k", global);
    hotkeys.bind("k", panel, {
      scope: "panel",
    });
    hotkeys.pushScope("panel");
    key("a");
    key("k");
    expect(global).toHaveBeenCalledTimes(1);
    expect(panel).toHaveBeenCalledTimes(1);
  });

  it("traps shortcuts with inherit: false, except for '*' bindings", () => {
    const global = vi.fn();
    const modal = vi.fn();
    const always = vi.fn();
    make().bind("a", global);
    hotkeys.bind("escape", modal, {
      scope: "modal",
    });
    hotkeys.bind("?", always, {
      scope: "*",
    });
    const pop = hotkeys.pushScope("modal", {
      inherit: false,
    });
    expect(hotkeys.getActiveScopes()).toEqual([
      "modal",
    ]);
    key("a");
    key("Escape");
    press({
      code: "Slash",
      key: "?",
      shiftKey: true,
    });
    expect(global).not.toHaveBeenCalled();
    expect(modal).toHaveBeenCalledTimes(1);
    expect(always).toHaveBeenCalledTimes(1);
    pop();
    key("a");
    expect(global).toHaveBeenCalledTimes(1);
  });

  it("removes the right frame when scopes are popped out of order", () => {
    make();
    const a = hotkeys.pushScope("a");
    hotkeys.pushScope("b");
    a();
    expect(hotkeys.getActiveScopes()).toEqual([
      "b",
      "global",
    ]);
  });
});

describe("introspection and helpers", () => {
  it("lists bindings with their metadata and active state", () => {
    make().bind("mod+k", () => {}, {
      group: "Navigation",
      label: "Open palette",
      scope: "later",
    });
    expect(hotkeys.getBindings()).toEqual([
      expect.objectContaining({
        active: false,
        combos: [
          "mod+k",
        ],
        group: "Navigation",
        label: "Open palette",
        scope: "later",
      }),
    ]);
  });

  it("trigger runs the winning binding", () => {
    const handler = vi.fn();
    make().bind("mod+k", handler);
    expect(hotkeys.trigger("ctrl+k")).toBe(true);
    expect(hotkeys.trigger("ctrl+j")).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("tracks pressed keys and clears them on keyup and blur", () => {
    make().bind("k", () => {});
    press({
      code: "ShiftLeft",
      key: "Shift",
      shiftKey: true,
    });
    key("k");
    expect(hotkeys.isPressed("shift")).toBe(true);
    expect(hotkeys.isPressed("k")).toBe(true);
    key("k", {}, "keyup");
    expect(hotkeys.isPressed("k")).toBe(false);
    window.dispatchEvent(new Event("blur"));
    expect(hotkeys.isPressed("shift")).toBe(false);
  });

  it("clears keys stuck behind Meta on macOS", () => {
    make().bind("k", () => {});
    press({
      code: "MetaLeft",
      key: "Meta",
      metaKey: true,
    });
    key("k", {
      metaKey: true,
    });
    press(
      {
        code: "MetaLeft",
        key: "Meta",
      },
      "keyup",
    );
    expect(hotkeys.isPressed("k")).toBe(false);
  });

  it("ignores events while an IME is composing", () => {
    const handler = vi.fn();
    make().bind("k", handler);
    key("k", {
      isComposing: true,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("throws a typed error for invalid combos", () => {
    make();
    expect(() => hotkeys.bind("ctrl+", () => {})).toThrow(/Invalid hotkey/);
  });

  it("attaches nothing until the first binding exists", () => {
    const add = vi.spyOn(document, "addEventListener");
    make();
    expect(add).not.toHaveBeenCalled();
    hotkeys.bind("k", () => {});
    expect(add).toHaveBeenCalledWith("keydown", expect.any(Function), false);
    add.mockRestore();
  });
});

describe("sequences", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires after the steps are pressed in order", () => {
    const handler = vi.fn();
    make().bind("g i", handler);
    key("g");
    expect(handler).not.toHaveBeenCalled();
    key("i");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[1]).toMatchObject({
      combo: "g i",
    });
  });

  it("does not fire when another key is pressed in between", () => {
    const handler = vi.fn();
    make().bind("g i", handler);
    key("g");
    key("x");
    key("i");
    expect(handler).not.toHaveBeenCalled();
  });

  it("resets when the steps are too far apart", () => {
    vi.useFakeTimers();
    const handler = vi.fn();
    make({
      sequenceTimeout: 500,
    }).bind("g i", handler);
    key("g");
    vi.advanceTimersByTime(501);
    key("i");
    expect(handler).not.toHaveBeenCalled();
    key("g");
    vi.advanceTimersByTime(100);
    key("i");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("supports the same key twice and starts over after firing", () => {
    const handler = vi.fn();
    make().bind("g g", handler);
    key("g");
    key("g");
    key("g");
    expect(handler).toHaveBeenCalledTimes(1);
    key("g");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("supports steps with modifiers and ignores modifier presses between them", () => {
    const handler = vi.fn();
    make().bind("ctrl+k ctrl+s", handler);
    press({
      code: "ControlLeft",
      ctrlKey: true,
      key: "Control",
    });
    key("k", {
      ctrlKey: true,
    });
    key("s", {
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("ignores held-down auto-repeat", () => {
    const handler = vi.fn();
    make().bind("g g", handler);
    key("g");
    key("g", {
      repeat: true,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("prefers the longer sequence when a single key also matches", () => {
    const single = vi.fn();
    const double = vi.fn();
    make().bind("g", single);
    hotkeys.bind("g g", double);
    key("g");
    expect(single).toHaveBeenCalledTimes(1);
    key("g");
    expect(double).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledTimes(1);
  });

  it("skips sequences typed inside inputs", () => {
    const input = document.createElement("input");
    document.body.append(input);
    const handler = vi.fn();
    make().bind("g i", handler);
    key("g", {
      target: input,
    });
    key("i", {
      target: input,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects sequences on keyup", () => {
    make();
    expect(() =>
      hotkeys.bind("g i", () => {}, {
        on: "keyup",
      }),
    ).toThrow(/keydown/);
  });

  it("trigger runs a sequence without disturbing real key history", () => {
    const handler = vi.fn();
    make().bind("g i", handler);
    expect(hotkeys.trigger("g i")).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    key("i");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("record", () => {
  const recordWith = (options = {}) => make().record(options);

  it("resolves with the combo the user presses and normalises the main modifier to mod", async () => {
    const promise = recordWith();
    key("k", {
      ctrlKey: true,
      shiftKey: true,
    });
    await expect(promise).resolves.toBe("mod+shift+k");
  });

  it("keeps explicit modifiers with mod: false", async () => {
    const promise = recordWith({
      mod: false,
    });
    key("k", {
      ctrlKey: true,
    });
    await expect(promise).resolves.toBe("ctrl+k");
  });

  it("reports progress through onChange", async () => {
    const onChange = vi.fn();
    const promise = recordWith({
      onChange,
    });
    press({
      code: "ControlLeft",
      ctrlKey: true,
      key: "Control",
    });
    press({
      code: "ShiftLeft",
      ctrlKey: true,
      key: "Shift",
      shiftKey: true,
    });
    key("k", {
      ctrlKey: true,
      shiftKey: true,
    });
    await promise;
    expect(onChange.mock.calls.map(([combo]) => combo)).toEqual([
      "mod",
      "mod+shift",
      "mod+shift+k",
    ]);
  });

  it("cancels with escape, unless cancelKey is null", async () => {
    const cancelled = recordWith();
    key("Escape", {
      code: "Escape",
    });
    await expect(cancelled).resolves.toBeNull();
    const recorded = hotkeys.record({
      cancelKey: null,
    });
    key("Escape", {
      code: "Escape",
    });
    await expect(recorded).resolves.toBe("escape");
  });

  it("cancels through an AbortSignal and when a newer recording starts", async () => {
    const controller = new AbortController();
    const first = recordWith({
      signal: controller.signal,
    });
    controller.abort();
    await expect(first).resolves.toBeNull();
    const second = hotkeys.record();
    const third = hotkeys.record();
    await expect(second).resolves.toBeNull();
    key("a");
    await expect(third).resolves.toBe("a");
  });

  it("writes symbols without shift and falls back to the physical key", async () => {
    const question = recordWith();
    press({
      code: "Slash",
      key: "?",
      shiftKey: true,
    });
    await expect(question).resolves.toBe("?");
    const option = hotkeys.record();
    press({
      altKey: true,
      code: "KeyA",
      key: "å",
    });
    await expect(option).resolves.toBe("alt+a");
  });

  it("supports modifier-only combos when asked", async () => {
    const promise = recordWith({
      modifierOnly: true,
    });
    press({
      code: "ShiftLeft",
      key: "Shift",
      shiftKey: true,
    });
    press(
      {
        code: "ShiftLeft",
        key: "Shift",
      },
      "keyup",
    );
    await expect(promise).resolves.toBe("shift");
  });

  it("blocks bindings and the page while recording, and the result can be bound back", async () => {
    const handler = vi.fn();
    make().bind("mod+k", handler);
    const promise = hotkeys.record();
    const event = key("k", {
      ctrlKey: true,
    });
    const combo = await promise;
    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    hotkeys.bind(combo ?? "", handler);
    key("k", {
      ctrlKey: true,
    });
    expect(handler).toHaveBeenCalled();
  });

  it("rejects without a DOM target", async () => {
    const detached = createHotkeys({
      platform: "other",
      target: undefined,
    });
    const original = globalThis.document;
    // biome-ignore lint/suspicious/noExplicitAny: simulating a server environment
    (globalThis as any).document = undefined;
    try {
      await expect(detached.record()).rejects.toThrow(/DOM/);
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: restoring the environment
      (globalThis as any).document = original;
    }
  });
});
