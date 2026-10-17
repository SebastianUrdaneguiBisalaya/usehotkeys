# usehotkeys

Keyboard shortcuts for the web that stay out of your way: **combos, scopes, priorities and conflict resolution**, in a framework-agnostic core with React bindings.

```tsx
import { useHotkeys } from "@usehotkeys/react";

function App() {
  const [open, setOpen] = useState(false);

  useHotkeys("mod+k", () => setOpen(true), { label: "Open command palette" });

  return open ? <CommandPalette onClose={() => setOpen(false)} /> : null;
}
```

`mod` is `⌘` on macOS and `Ctrl` everywhere else. The shortcut is removed when the component unmounts. That is the whole API for the common case.

## Contents

- [Packages](#packages)
- [Part 1: Core (`@usehotkeys/core`)](#part-1-core-usehotkeyscore)
  - [Core quick start](#core-quick-start) · [Writing combos](#writing-combos) · [Sequences](#sequences) · [Options](#options) · [Scopes](#scopes) · [Priorities and conflicts](#priorities-and-conflicts) · [Typing in inputs](#typing-in-inputs) · [Keyboard layouts](#keyboard-layouts) · [Reading state](#reading-state) · [Recording shortcuts](#recording-shortcuts) · [Errors](#errors) · [Core recipes](#core-recipes) · [How it works](#how-it-works) · [FAQ and known limits](#faq-and-known-limits)
- [Part 2: React (`@usehotkeys/react`)](#part-2-react-usehotkeysreact)
  - [React quick start](#react-quick-start) · [`useHotkeys`](#usehotkeys) · [`useHotkeyScope`](#usehotkeyscope) · [`useRecordHotkey`](#userecordhotkey) · [`HotkeysProvider`](#hotkeysprovider) · [React recipes](#react-recipes) · [How the React hooks work](#how-the-react-hooks-work) · [React FAQ](#react-faq)
- [Pending](#pending)
- [Contributing](#contributing) · [License](#license)

## Packages

| Package | What it is | Use it when |
| --- | --- | --- |
| [`@usehotkeys/core`](./packages/core) | The engine. No dependencies, no framework. | Vanilla JS, Vue, Svelte, Angular, or building your own bindings. |
| [`@usehotkeys/react`](./packages/react) | `useHotkeys`, `useHotkeyScope`, `<HotkeysProvider>`. | React 18 or 19. It installs on top of core. |

```bash
pnpm add -E @usehotkeys/react @usehotkeys/core   # React
pnpm add -E @usehotkeys/core                     # anything else
```

## Part 1: Core (`@usehotkeys/core`)

### Core quick start

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

### Writing combos

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

### Sequences

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

### Options

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

### Scopes

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

#### Modals: block everything behind

```ts
hotkeys.bind("escape", closeModal, { scope: "modal" });

const closeScope = hotkeys.pushScope("modal", { inherit: false });
// Now ONLY "modal" (and "*") bindings fire. "global" shortcuts are paused.
closeScope(); // everything is back
```

`inherit: false` is the difference between "a modal where `j`/`k` still scroll the page behind it" and a proper modal.

Want a shortcut that works everywhere, even inside a modal (like `?` for help)? Use `scope: "*"`.

`hotkeys.getActiveScopes()` returns the active names, top first, e.g. `["modal"]`.

### Priorities and conflicts

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

#### Finding accidental conflicts

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

### Typing in inputs

`ignoreInputs` decides whether a binding is skipped because the user is typing.

| Value | Behaviour |
| --- | --- |
| `"auto"` (default) | Skip inside `<input>` (text-like types), `<textarea>`, `<select>` and `contenteditable`, **unless the combo has `ctrl` or `meta`**. So `j` does not fire while typing, but `mod+s` does. Checkboxes, radios and buttons are not "typing" and are never skipped. |
| `true` | Always skip inside editable elements. |
| `false` | Never skip. Use it for shortcuts like `escape` that should work everywhere. |
| `".some-selector"` | Skip when the event target is inside an element matching the selector. |
| `(event) => boolean` | Return `true` to skip. Full control. |

The check looks through open Shadow DOM, so components that wrap an `<input>` are handled. Events while an IME (e.g. Chinese or Japanese input) is composing text are always ignored.

### Keyboard layouts

Every key press has two identities: the **character** it types (`event.key`) and the **position** on the board (`event.code`). They differ on Dvorak, Colemak, AZERTY, Cyrillic and Greek layouts.

- `layout: "logical"` (default): `"s"` is whichever key types an `s` for this user. Right for mnemonic shortcuts (`s` = save, `n` = new).
- `layout: "physical"`: `"w"` is the key where `W` sits on a QWERTY keyboard, whatever it types. Right for games and WASD-style navigation.

```ts
hotkeys.bind("w", moveUp, { layout: "physical" });
```

In logical mode, letters and digits fall back to the physical key when the layout cannot produce the Latin character the combo names: `Option+A` on macOS (which types `å`), a Russian layout pressing `Ctrl+S` (which types `ы`), and `Shift+1` (which types `!`). AltGr (reported as `Ctrl+Alt` on Windows) is ignored for character keys.

### Reading state

#### `getBindings()`: build a shortcuts help dialog

```ts
hotkeys.bind("mod+k", openPalette, { label: "Command palette", group: "Navigation" });

hotkeys.getBindings();
// [{ id: 1, combos: ["mod+k"], label: "Command palette", group: "Navigation",
//    scope: "global", priority: 0, on: "keydown", enabled: true, active: true }]
```

`active` is `false` when the binding is disabled or its scope is not live right now.

#### `formatHotkey(combo)`: show it to the user

```ts
import { formatHotkey } from "@usehotkeys/core";

formatHotkey("mod+shift+k", { platform: "mac" });   // "⇧⌘K"
formatHotkey("mod+shift+k", { platform: "other" }); // "Ctrl+Shift+K"
formatHotkey("esc");                                // "⎋" on Mac, "Esc" elsewhere
```

`platform` defaults to the user's.

#### `isPressed(key)`

```ts
hotkeys.isPressed("shift"); // true while Shift is held
hotkeys.isPressed("a");
```

State resets when the window loses focus, the tab is hidden, or `Cmd` is released on macOS (browsers do not send `keyup` for other keys in that case), so keys never get "stuck". `isPressed` is already `false` inside a `keyup` handler.

#### `trigger(combo)`

Runs the binding that would win for `combo`, as if the user had pressed it. Useful for a toolbar button that should do the same as the shortcut, and for tests. It returns `true` if a handler ran. It needs `KeyboardEvent`, so it throws `HotkeysEnvironmentError` on a server.

```ts
button.onclick = () => hotkeys.trigger("mod+k");
```

#### `destroy()`

Removes every binding, scope and listener. Call it when you are done with an engine you created yourself.

### Recording shortcuts

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

### Errors

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

### Core recipes

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

### How it works

For people who want to contribute or debug.

- **Files** (`packages/core/src`): `parser.ts` turns `"mod+k"` into modifier flags plus a normalised key; `matcher.ts` compares that with a `KeyboardEvent`; `hotkeys.ts` owns the registry, the scope stack, the pressed-key set and dispatch; `filter.ts` implements `ignoreInputs`; `format.ts` renders combos; `keys.ts` holds aliases. `index.ts` is the only public surface.
- **No classes.** State lives in the closure that `createHotkeys` returns (the only classes are the error types).
- **One listener pair.** The engine registers a single `keydown` and `keyup` on the target and does its own matching, so adding bindings never adds DOM listeners.
- **Dispatch** (per event): drop IME events; collect candidates that match event type, repeat rule, enabled, active scope, element, keys and `ignoreInputs`; sort by priority, scope depth, then registration id; run the winner (and further ones only after `passthrough`). `once` bindings are removed before their handler runs.
- **Sequences.** The engine keeps the last few non-modifier key presses with timestamps. A binding with N steps matches when the last N presses match its steps in order; presses older than `sequenceTimeout` are dropped, and the history is cleared after a sequence fires. Single combos are just sequences of one step.
- **Recorder.** `record()` (in `record.ts`) adds capture-phase listeners that swallow the keys, pauses dispatch while active, and builds the combo string with the same key rules as the matcher.
- **Lazy lifecycle.** Listeners attach on the first binding and detach on the last unbind.

### FAQ and known limits

**Why did my shortcut not fire?** Check, in order: is the combo what you think (`formatHotkey` it)? Is its `scope` active (`getActiveScopes()`)? Is another binding outranking it (`getConflicts()`, or set `debug: true`)? Is the user typing in an input (`ignoreInputs`)? Did the browser or OS reserve the key (`Ctrl+W`, `Cmd+Q`, `Ctrl+T` cannot be intercepted by any web page)?

**`keyup` on macOS with `Cmd` held.** The browser does not send `keyup` for non-modifier keys released while `Cmd` is down, so `{ on: "keyup" }` bindings combined with `meta` will not fire. Use `keydown`.

**Double-tap and long-press shortcuts** are planned, not available yet.

**Browser only.** The package never touches `window` or `document` on import, but it is meant for the browser; the server is a safe no-op.

## Part 2: React (`@usehotkeys/react`)

### React quick start

```tsx
import { useState } from "react";
import { useHotkeys } from "@usehotkeys/react";

export function App() {
  const [open, setOpen] = useState(false);

  useHotkeys("mod+k", () => setOpen(true), { label: "Open command palette" });
  useHotkeys("escape", () => setOpen(false), { enabled: open });

  return open ? <CommandPalette /> : <button onClick={() => setOpen(true)}>Search</button>;
}
```

No provider, no setup. `mod` is `⌘` on macOS and `Ctrl` elsewhere. For how combos are written (`"mod+shift+k"`, `"?"`, `"ctrl++"`, arrays), see [Writing combos](#writing-combos) in the core README.

### `useHotkeys`

```ts
useHotkeys(combo, handler, options?)
```

| Argument | Type | Notes |
| --- | --- | --- |
| `combo` | `string \| string[]` | `"mod+k"` or `["j", "arrowdown"]`. An invalid combo throws `HotkeyParseError` during the effect. |
| `handler` | `(event, { combo, binding }) => void` | Called when the keys are pressed. |
| `options` | `UseHotkeysOptions` | Same options as [core `bind`](#options): `scope`, `priority`, `enabled`, `once`, `ignoreInputs`, `layout`, `label`... |

Things worth knowing:

- **The latest handler always runs.** You can pass an inline arrow function that reads state; there is no stale closure and nothing is re-registered on every render. The same is true for `enabled` and a function `ignoreInputs`.
- **It re-registers only when the keys or a static option change** (`combo`, `scope`, `priority`, `on`, `layout`, `label`...).
- **`element` accepts a ref**, to fire only inside a rendered element:

  ```tsx
  function Card({ onDelete }: { onDelete: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useHotkeys("delete", onDelete, { element: ref });
    return <div ref={ref} tabIndex={0}>…</div>;
  }
  ```

- **Conflicts between components are resolved for you.** If two mounted components bind `escape`, the highest `priority` wins, then the most recently mounted. See [Priorities and conflicts](#priorities-and-conflicts).
- **Typing in inputs is handled.** Plain keys do not fire while the user types; `mod+s` does. Change it with `ignoreInputs`. See [Typing in inputs](#typing-in-inputs).

### `useHotkeyScope`

```ts
useHotkeyScope(name, { inherit?, enabled? })
```

Activates a scope while the component is mounted. Bindings declared with `{ scope: name }` only fire while it is active.

```tsx
function Modal({ onClose }: { onClose: () => void }) {
  // While this modal is mounted, shortcuts behind it are paused.
  useHotkeyScope("modal", { inherit: false });
  useHotkeys("escape", onClose, { scope: "modal" });

  return <dialog open>…</dialog>;
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `inherit` | `true` | `false` makes only this scope (and `scope: "*"` bindings) active. Use it for modals. |
| `enabled` | `true` | Activate the scope only while `true`. |

### `useRecordHotkey`

```ts
const { start, cancel, isRecording, preview, combo } = useRecordHotkey(options?);
```

Records the next combo the user presses (see [Recording shortcuts](#recording-shortcuts)) and keeps the UI state for you. Options are the same as `hotkeys.record`, except `onChange` and `signal`, which the hook manages.

| Returned | Meaning |
| --- | --- |
| `start()` | Begin listening. Returns a promise with the combo, or `null` if cancelled. |
| `cancel()` | Stop without recording. |
| `isRecording` | `true` while listening. |
| `preview` | What is held right now (`"mod+shift"`), for a live label. |
| `combo` | The last recorded combo, or `null`. Cancelling keeps the previous one. |

```tsx
function ShortcutField({ value, onChange }: { value: string; onChange: (combo: string) => void }) {
  const { start, isRecording, preview } = useRecordHotkey();

  async function record() {
    const combo = await start();
    if (combo) onChange(combo);
  }

  return (
    <button type="button" onClick={record}>
      {isRecording ? preview || "Press the keys… (Esc to cancel)" : formatHotkey(value)}
    </button>
  );
}
```

Recording stops by itself if the component unmounts.

### `HotkeysProvider`

**Optional.** Without it, every hook shares one global engine, which is what you want in most apps. Add a provider when you need to configure the engine or isolate a part of the tree:

```tsx
import { HotkeysProvider } from "@usehotkeys/react";

<HotkeysProvider options={{ debug: true, defaults: { ignoreInputs: "auto" } }}>
  <App />
</HotkeysProvider>
```

| Prop | Meaning |
| --- | --- |
| `options` | [`createHotkeys` options](#options) for the engine the provider creates: `platform`, `capture`, `defaults`, `onConflict`, `debug`. |
| `hotkeys` | Pass an engine you created yourself (e.g. to also use it outside React). |

`useHotkeysInstance()` returns the engine in use, so you can call `getBindings()` for a help dialog or `formatHotkey`:

```tsx
import { formatHotkey } from "@usehotkeys/core";
import { useHotkeysInstance } from "@usehotkeys/react";

function ShortcutsHelp() {
  const hotkeys = useHotkeysInstance();
  return (
    <ul>
      {hotkeys.getBindings().filter((b) => b.active && b.label).map((b) => (
        <li key={b.id}>{b.label}: <kbd>{formatHotkey(b.combos[0]!)}</kbd></li>
      ))}
    </ul>
  );
}
```

Providers nest: a hook uses the nearest one. In tests, wrap components in a provider with `options={{ platform: "other" }}` to make `mod` deterministic.

### React recipes

**Disable a shortcut conditionally**

```tsx
useHotkeys("mod+enter", submit, { enabled: !isSubmitting });
```

**Same action, several keys**

```tsx
useHotkeys(["j", "arrowdown"], selectNext);
```

**A shortcut that works while typing**

```tsx
useHotkeys("escape", () => inputRef.current?.blur(), { ignoreInputs: false });
```

**Let the parent keep reacting too**

```tsx
useHotkeys("escape", closeChild, { priority: 10, passthrough: true });
```

**Run once**

```tsx
useHotkeys("enter", dismissBanner, { once: true });
```

**Next.js / SSR**: hooks only register inside effects, so nothing runs on the server. Use them in Client Components (`"use client"`).

### How the React hooks work

- `useHotkeys` stores the latest `handler` and options in a ref and runs one `useEffect` that calls `hotkeys.bind(...)` and returns the unbind function. The effect depends on the combo and the static options only, so it is StrictMode-safe (mount, unmount, mount again leaves exactly one binding).
- `useHotkeyScope` runs `hotkeys.pushScope(...)` in an effect and returns its disposer.
- The engine is created lazily on first use (or by `HotkeysProvider`), and attaches DOM listeners only while at least one binding exists.
- Source is three small files in `src/`: `context.tsx`, `use-hotkeys.ts`, `use-hotkey-scope.ts`.

### React FAQ

**My shortcut does nothing.** See "Why did my shortcut not fire?" in the [core FAQ](#faq-and-known-limits). Setting `<HotkeysProvider options={{ debug: true }}>` logs conflicts.

**Do I need `@usehotkeys/core` installed?** Yes. It is a peer dependency so your app and these hooks share one copy.

**Does re-rendering reset the binding order?** No. Handler, `enabled` and function `ignoreInputs` changes do not re-register. Only changes to the combo or static options do, and then the binding counts as "most recent" again.

## Pending

Not implemented yet:

- **`useIsPressed`**: a React hook that re-renders while a key or combo is held.
- **`doubleTap` and `hold`**: double-tap (`shift` twice) and long-press shortcuts.

## Contributing

Setup, the checks to run before a pull request, and how to try the built packages locally are in [CONTRIBUTING.md](./CONTRIBUTING.md#development-workflow).

## License

[ISC](./LICENSE)
