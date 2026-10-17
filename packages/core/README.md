# @usehotkeys/core

A framework-agnostic keyboard shortcut engine for the browser. Zero dependencies.

> Using React? Install [`@usehotkeys/react`](../react/README.md) instead of calling this directly. This page still explains every concept it uses.

```bash
pnpm add -E @usehotkeys/core
```

## Contents

1. [Quick start](#quick-start)
2. [Writing combos](#writing-combos)
3. [Sequences](#sequences)
4. [Options](#options)
5. [Scopes](#scopes)
6. [Priorities and conflicts](#priorities-and-conflicts)
7. [Typing in inputs](#typing-in-inputs)
8. [Keyboard layouts](#keyboard-layouts)
9. [Reading state](#reading-state): `getBindings`, `isPressed`, `trigger`, `formatHotkey`
10. [Recording shortcuts](#recording-shortcuts)
11. [Errors](#errors)
12. [Recipes](#recipes)
13. [How it works](#how-it-works) (for maintainers and the curious)
14. [FAQ and known limits](#faq-and-known-limits)

## Quick start

```ts
import { createHotkeys } from "@usehotkeys/core";

const hotkeys = createHotkeys();

// 1. Bind. You get a function back that removes the binding.
const unbind = hotkeys.bind("mod+k", (event) => {
  openCommandPalette();
});

// 2. Later, when you no longer need it:
unbind();
```

- `createHotkeys()` makes an independent engine. Most apps create one and share it.
- `bind(combo, handler, options?)` registers a shortcut. The handler receives the `KeyboardEvent`.
- `mod` means `⌘` on macOS and `Ctrl` elsewhere, so one string works for everyone.
- By default the browser's own action for that key is cancelled (`preventDefault`), so `mod+s` will not open "Save page".

Nothing is attached to `document` until the first `bind`, and it is detached again when the last binding is removed. Importing or creating an engine on the server does nothing.

## Writing combos

A combo is modifiers and one key joined with `+`. Case and order do not matter.

| You write | Meaning |
| --- | --- |
| `"k"` | The `K` key, with no modifiers |
| `"mod+k"` | `⌘K` on Mac, `Ctrl+K` on Windows/Linux |
| `"ctrl+shift+p"` | Ctrl + Shift + P |
| `"esc"`, `"enter"`, `"space"`, `"tab"` | Named keys |
| `"up"`, `"down"`, `"left"`, `"right"` | Arrow keys (`"arrowup"` also works) |
| `"f5"`, `"pageup"`, `"home"`, `"delete"` | Function and navigation keys |
| `"?"`, `"/"`, `"["`, `","` | Punctuation, written as the character |
| `"ctrl++"` or `"ctrl+plus"` | Ctrl and the `+` key (a bare `+` is the separator) |
| `"numpad1"` | The numeric keypad `1` |
| `"shift"` | Pressing Shift on its own (modifier-only) |
| `["ctrl+s", "meta+s"]` | An array: several combos, one handler |
| `"g i"`, `"mod+k mod+s"` | A [sequence](#sequences): press `g`, then `i` |

Modifier names: `ctrl`/`control`, `alt`/`option`/`opt`, `shift`, `meta`/`cmd`/`command`/`win`/`super`, and `mod`.

**Modifiers are exact by default.** `"ctrl+k"` does not fire for `Ctrl+Shift+K`. Set `exact: false` to allow extra modifiers. For symbols such as `?`, Shift is implied by the character, so `"?"` works without writing `shift+/`.

Spaces separate the steps of a [sequence](#sequences). The space bar is `"space"`.

## Sequences

A **sequence** is several steps separated by spaces. The user presses them one after another, like `g` then `i` in Gmail or `Ctrl+K` then `Ctrl+S` in VS Code.

```ts
hotkeys.bind("g i", () => goToInbox());
hotkeys.bind("g g", () => scrollToTop());
hotkeys.bind("mod+k mod+s", () => openKeyboardShortcuts());
```

How they behave:

- **Timing:** the next step must come within `sequenceTimeout` (default `1000` ms, set it in `createHotkeys`). After that the sequence starts over.
- **Any other key breaks it.** `g`, `x`, `i` does not fire `"g i"`. Modifier presses between steps (holding `Ctrl` from step to step) are fine, and a held-down key (auto-repeat) counts once.
- **After it fires, it starts over**, so `"g g"` needs two new presses each time.
- **Every step is a full combo**, with its own modifiers. A step cannot be modifiers only (`"g shift"` is an error).
- **Priority works as usual.** If `"g"` and `"g g"` are both bound, the single `g` fires immediately on the first press (there is no waiting to see what comes next) and the longer sequence wins on the second. Avoid binding a key and a sequence that starts with it, or give them different `priority`.
- **Typing in inputs:** `ignoreInputs: "auto"` looks at the last step, so `"g i"` does not fire while typing, but `"mod+k mod+s"` does.
- **Only on `keydown`.** `{ on: "keyup" }` with a sequence throws `HotkeyParseError`.
- **`preventDefault` applies to the final step.** Earlier keys keep their normal behaviour.
- `hotkeys.trigger("g i")` runs it, and `formatHotkey("g i")` gives `"G I"`.

## Options

Pass them as the third argument: `hotkeys.bind("mod+k", handler, { scope: "editor", priority: 10 })`.

| Option | Default | What it does |
| --- | --- | --- |
| `scope` | `"global"` | Scope the binding belongs to. `"*"` means active in every scope. See [Scopes](#scopes). |
| `priority` | `0` | Higher wins when several bindings match. See [Priorities](#priorities-and-conflicts). |
| `on` | `"keydown"` | `"keydown"` or `"keyup"`. Sequences need `"keydown"`. |
| `enabled` | `true` | `false` turns it off. Pass a function `() => boolean` to decide at event time. |
| `once` | `false` | Remove the binding after it fires once. |
| `repeat` | `false` | Fire again while the key is held (OS auto-repeat). Ignored by default. |
| `preventDefault` | `true` | Cancel the browser's default action for the key. |
| `stopPropagation` | `false` | Stop the event from reaching other listeners. |
| `ignoreInputs` | `"auto"` | When to skip the binding because the user is typing. See [Typing in inputs](#typing-in-inputs). |
| `element` | none | Only fire when the event happens inside this element. |
| `layout` | `"logical"` | `"logical"` or `"physical"`. See [Keyboard layouts](#keyboard-layouts). |
| `exact` | `true` | Require the modifiers to match exactly. |
| `passthrough` | `false` | Let lower-ranked bindings also run. See [Conflicts](#priorities-and-conflicts). |
| `label` | none | Human name, for help screens (`getBindings()`). |
| `description` | none | Longer text, for help screens. |
| `group` | none | Category, for help screens. |

Options for `createHotkeys({ ... })`:

| Option | Default | What it does |
| --- | --- | --- |
| `target` | `document` | Where to listen. Pass an element or `window` to narrow or widen it. |
| `platform` | detected | `"mac"` or `"other"`. Changes what `mod` means. Handy in tests and SSR. |
| `capture` | `false` | Listen in the capture phase (runs before handlers deeper in the page). |
| `sequenceTimeout` | `1000` | Milliseconds allowed between the steps of a [sequence](#sequences). |
| `defaults` | `{}` | Options applied to every `bind` of this engine, e.g. `{ ignoreInputs: false }`. |
| `onConflict` | none | Called when a new binding conflicts with an existing one. |
| `debug` | `false` | Without `onConflict`, log conflicts with `console.warn`. |

## Scopes

A **scope** is a named group of shortcuts that is only live while the scope is active. There is always a base scope called `"global"`.

```ts
// These only work while the "editor" scope is active.
hotkeys.bind("mod+b", toggleBold, { scope: "editor" });
hotkeys.bind("mod+i", toggleItalic, { scope: "editor" });

// This one is always live (scope defaults to "global").
hotkeys.bind("mod+k", openPalette);

// The editor gets focus: turn its scope on.
const leaveEditor = hotkeys.pushScope("editor");
// ...editor loses focus:
leaveEditor();
```

`pushScope` puts a scope on top of a stack and returns the function that removes it. Scopes below stay active unless you say otherwise.

### Modals: block everything behind

```ts
hotkeys.bind("escape", closeModal, { scope: "modal" });

const closeScope = hotkeys.pushScope("modal", { inherit: false });
// Now ONLY "modal" (and "*") bindings fire. "global" shortcuts are paused.
closeScope(); // everything is back
```

`inherit: false` is the difference between "a modal where `j`/`k` still scroll the page behind it" and a proper modal.

Want a shortcut that works everywhere, even inside a modal (like `?` for help)? Use `scope: "*"`.

`hotkeys.getActiveScopes()` returns the active names, top first, e.g. `["modal"]`.

## Priorities and conflicts

A **conflict** is two bindings competing for the same keys. Instead of firing both in a random order, usehotkeys picks one:

1. Higher `priority` wins.
2. If equal, the scope closer to the top of the stack wins.
3. If equal, the **most recently registered** binding wins (the newest component is the one the user is looking at).

Only the winner runs. Bindings that are disabled, in an inactive scope, or skipped by `ignoreInputs` never compete, so they cannot block anyone.

```ts
hotkeys.bind("escape", closePopover, { priority: 20 });
hotkeys.bind("escape", closeSidebar, { priority: 10 });
// Esc closes the popover first; once it is unbound, Esc closes the sidebar.
```

To make *both* run, mark the higher one `passthrough: true`. It fires, then the next-ranked binding fires too.

### Finding accidental conflicts

Two bindings with the **same combo, scope, event type and priority** (and neither `passthrough`) are a real conflict: the winner is decided only by registration order, which is fragile. Surface them:

```ts
const hotkeys = createHotkeys({
  onConflict: (conflict) => {
    console.warn(`"${conflict.combo}" is bound ${conflict.bindings.length} times`, conflict.bindings);
  },
});
// or simply: createHotkeys({ debug: true })

hotkeys.getConflicts(); // the same information on demand, e.g. in a test
```

Fix a conflict by giving the bindings different priorities, different scopes, or `passthrough`.

## Typing in inputs

`ignoreInputs` decides whether a binding is skipped because the user is typing.

| Value | Behaviour |
| --- | --- |
| `"auto"` (default) | Skip inside `<input>` (text-like types), `<textarea>`, `<select>` and `contenteditable`, **unless the combo has `ctrl` or `meta`**. So `j` does not fire while typing, but `mod+s` does. Checkboxes, radios and buttons are not "typing" and are never skipped. |
| `true` | Always skip inside editable elements. |
| `false` | Never skip. Use it for shortcuts like `escape` that should work everywhere. |
| `".some-selector"` | Skip when the event target is inside an element matching the selector. |
| `(event) => boolean` | Return `true` to skip. Full control. |

The check looks through open Shadow DOM, so components that wrap an `<input>` are handled. Events while an IME (e.g. Chinese or Japanese input) is composing text are always ignored.

## Keyboard layouts

Every key press has two identities: the **character** it types (`event.key`) and the **position** on the board (`event.code`). They differ on Dvorak, Colemak, AZERTY, Cyrillic and Greek layouts.

- `layout: "logical"` (default): `"s"` is whichever key types an `s` for this user. Right for mnemonic shortcuts (`s` = save, `n` = new).
- `layout: "physical"`: `"w"` is the key where `W` sits on a QWERTY keyboard, whatever it types. Right for games and WASD-style navigation.

```ts
hotkeys.bind("w", moveUp, { layout: "physical" });
```

In logical mode, letters and digits fall back to the physical key when the layout cannot produce the Latin character the combo names: `Option+A` on macOS (which types `å`), a Russian layout pressing `Ctrl+S` (which types `ы`), and `Shift+1` (which types `!`). AltGr (reported as `Ctrl+Alt` on Windows) is ignored for character keys.

## Reading state

### `getBindings()`: build a shortcuts help dialog

```ts
hotkeys.bind("mod+k", openPalette, { label: "Command palette", group: "Navigation" });

hotkeys.getBindings();
// [{ id: 1, combos: ["mod+k"], label: "Command palette", group: "Navigation",
//    scope: "global", priority: 0, on: "keydown", enabled: true, active: true }]
```

`active` is `false` when the binding is disabled or its scope is not live right now.

### `formatHotkey(combo)`: show it to the user

```ts
import { formatHotkey } from "@usehotkeys/core";

formatHotkey("mod+shift+k", { platform: "mac" });   // "⇧⌘K"
formatHotkey("mod+shift+k", { platform: "other" }); // "Ctrl+Shift+K"
formatHotkey("esc");                                // "⎋" on Mac, "Esc" elsewhere
```

`platform` defaults to the user's.

### `isPressed(key)`

```ts
hotkeys.isPressed("shift"); // true while Shift is held
hotkeys.isPressed("a");
```

State resets when the window loses focus, the tab is hidden, or `Cmd` is released on macOS (browsers do not send `keyup` for other keys in that case), so keys never get "stuck". `isPressed` is already `false` inside a `keyup` handler.

### `trigger(combo)`

Runs the binding that would win for `combo`, as if the user had pressed it. Useful for a toolbar button that should do the same as the shortcut, and for tests. It returns `true` if a handler ran. It needs `KeyboardEvent`, so it throws `HotkeysEnvironmentError` on a server.

```ts
button.onclick = () => hotkeys.trigger("mod+k");
```

### `destroy()`

Removes every binding, scope and listener. Call it when you are done with an engine you created yourself.

## Recording shortcuts

For a "customize your shortcuts" screen, `record()` waits for the user to press a combo and gives it back as a string you can store and pass to `bind`.

```ts
const combo = await hotkeys.record();      // the user presses Cmd+Shift+K
// "mod+shift+k"  (or null if they pressed Escape)

if (combo) {
  settings.save("commandPalette", combo);
  hotkeys.bind(combo, openPalette);
}
```

| Option | Default | What it does |
| --- | --- | --- |
| `onChange` | none | Called while keys are pressed: `"mod"`, then `"mod+shift"`, then `"mod+shift+k"`. Use it for a live preview. |
| `cancelKey` | `"escape"` | Key that cancels (resolves `null`) when pressed alone. Pass `null` to be able to record `escape` itself. |
| `mod` | `true` | Write the platform's main modifier as `mod`, so a shortcut saved on a Mac also works on Windows. `false` keeps `meta`/`ctrl`. |
| `modifierOnly` | `false` | Also accept just modifiers (`"shift"`), recorded when the user lets go of them. |
| `signal` | none | An `AbortSignal`; aborting resolves `null`. |

- While recording, **no binding fires and the keys do not reach the page**, so the user can try any combo safely. Keys the browser reserves (`Ctrl+W`, `Cmd+Q`) still cannot be captured.
- Starting a new `record()` cancels the previous one (it resolves `null`).
- `Option+A` on macOS is recorded as `alt+a`, and `Shift+/` as `?`, using the same rules as matching, so what you record always matches when pressed again.
- Without a DOM (a server) the promise rejects with `HotkeysEnvironmentError`.

## Errors

All errors extend `HotkeysError`, so `instanceof` works.

| Error | When |
| --- | --- |
| `HotkeyParseError` | A combo is invalid: empty, `"ctrl+"`, `"k+ctrl"`, repeated modifier, two keys, a modifier-only step in a sequence, a sequence on `keyup`. It has a `combo` property and a message saying what is wrong. Thrown by `bind` and `formatHotkey`, so mistakes show up the first time you run the code. |
| `HotkeysEnvironmentError` | `trigger` or `record` was called where there is no DOM (`KeyboardEvent`, `document`). |

```ts
import { HotkeyParseError } from "@usehotkeys/core";

try {
  hotkeys.bind(userTypedCombo, handler);
} catch (error) {
  if (error instanceof HotkeyParseError) showMessage(error.message);
}
```

## Recipes

**A shortcut that works even in a text field**

```ts
hotkeys.bind("escape", blurEditor, { ignoreInputs: false });
```

**Different shortcuts per OS**

```ts
hotkeys.bind(["ctrl+shift+z", "meta+shift+z"], redo);
```

**Scope to one component's DOM**

```ts
hotkeys.bind("delete", removeCard, { element: cardElement });
```

**Fire on key release**

```ts
hotkeys.bind("space", stopRecording, { on: "keyup" });
```

**Make one-off shortcuts**

```ts
hotkeys.bind("enter", confirm, { once: true });
```

**Isolated engine for a widget or a test**

```ts
const hotkeys = createHotkeys({ target: widgetElement, platform: "other" });
// ...
hotkeys.destroy();
```

**Use it with Vue / Svelte / Angular**: create the engine once, `bind` when the component mounts, call the returned function when it unmounts. That is all the React package does.

## How it works

For people who want to contribute or debug.

- **Files** (`packages/core/src`): `parser.ts` turns `"mod+k"` into modifier flags plus a normalised key; `matcher.ts` compares that with a `KeyboardEvent`; `hotkeys.ts` owns the registry, the scope stack, the pressed-key set and dispatch; `filter.ts` implements `ignoreInputs`; `format.ts` renders combos; `keys.ts` holds aliases. `index.ts` is the only public surface.
- **No classes.** State lives in the closure that `createHotkeys` returns (the only classes are the error types).
- **One listener pair.** The engine registers a single `keydown` and `keyup` on the target and does its own matching, so adding bindings never adds DOM listeners.
- **Dispatch** (per event): drop IME events; collect candidates that match event type, repeat rule, enabled, active scope, element, keys and `ignoreInputs`; sort by priority, scope depth, then registration id; run the winner (and further ones only after `passthrough`). `once` bindings are removed before their handler runs.
- **Sequences.** The engine keeps the last few non-modifier key presses with timestamps. A binding with N steps matches when the last N presses match its steps in order; presses older than `sequenceTimeout` are dropped, and the history is cleared after a sequence fires. Single combos are just sequences of one step.
- **Recorder.** `record()` (in `record.ts`) adds capture-phase listeners that swallow the keys, pauses dispatch while active, and builds the combo string with the same key rules as the matcher.
- **Lazy lifecycle.** Listeners attach on the first binding and detach on the last unbind.

## FAQ and known limits

**Why did my shortcut not fire?** Check, in order: is the combo what you think (`formatHotkey` it)? Is its `scope` active (`getActiveScopes()`)? Is another binding outranking it (`getConflicts()`, or set `debug: true`)? Is the user typing in an input (`ignoreInputs`)? Did the browser or OS reserve the key (`Ctrl+W`, `Cmd+Q`, `Ctrl+T` cannot be intercepted by any web page)?

**`keyup` on macOS with `Cmd` held.** The browser does not send `keyup` for non-modifier keys released while `Cmd` is down, so `{ on: "keyup" }` bindings combined with `meta` will not fire. Use `keydown`.

**Double-tap and long-press shortcuts** are planned, not available yet.

**Browser only.** The package never touches `window` or `document` on import, but it is meant for the browser; the server is a safe no-op.
