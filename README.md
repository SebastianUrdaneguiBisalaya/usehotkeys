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
  - [Core quick start](#core-quick-start) · [Writing combos](#writing-combos) · [Sequences](#sequences) · [Double tap and long press](#double-tap-and-long-press) · [Options](#options) · [Scopes](#scopes) · [Priorities and conflicts](#priorities-and-conflicts) · [Typing in inputs](#typing-in-inputs) · [Keyboard layouts](#keyboard-layouts) · [Reading state](#reading-state) · [Recording shortcuts](#recording-shortcuts) · [Keymap](#keymap) · [Errors](#errors) · [Core recipes](#core-recipes) · [Compatibility and size](#compatibility-and-size) · [How it works](#how-it-works) · [FAQ and known limits](#faq-and-known-limits)
- [Part 2: React (`@usehotkeys/react`)](#part-2-react-usehotkeysreact)
  - [React quick start](#react-quick-start) · [`useHotkeys`](#usehotkeys) · [`useHotkeyAction`](#usehotkeyaction) · [`useHotkeyScope`](#usehotkeyscope) · [`useBindings`](#usebindings) · [`useShortcuts`](#useshortcuts) · [`useRecordHotkey`](#userecordhotkey) · [`useIsPressed`](#useispressed) · [`HotkeysProvider`](#hotkeysprovider) · [React recipes](#react-recipes) · [Next.js and server rendering](#nextjs-and-server-rendering) · [How the React hooks work](#how-the-react-hooks-work) · [React FAQ](#react-faq)
- [Contributing](#contributing) · [License](#license)

## Packages

| Package | What it is | Use it when |
| --- | --- | --- |
| [`@usehotkeys/core`](./packages/core) | The engine. No dependencies, no framework. | Vanilla JS, Vue, Svelte, Angular, or building your own bindings. |
| [`@usehotkeys/react`](./packages/react) | `useHotkeys`, `useHotkeyAction`, `useHotkeyScope`, `useBindings`, `useShortcuts`, `useRecordHotkey`, `useIsPressed`, `<HotkeysProvider>`. | React 18 or 19. It installs on top of core. |

```bash
pnpm add -E @usehotkeys/react @usehotkeys/core   # React
pnpm add -E @usehotkeys/core                     # anything else
```

**Bundle size** (the published ESM build, minified with esbuild; peer dependencies not included):

| Package | Minified | Gzip | Brotli |
| --- | --- | --- | --- |
| `@usehotkeys/core` | 16.5 KB | 6.7 KB | 6.1 KB |
| `@usehotkeys/react` (on top of core) | 3.1 KB | 1.4 KB | 1.2 KB |

Both packages have zero runtime dependencies. The core is a single module, so bundlers include all of it (sequences, keymap, recorder) even if you use only a part.

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
- **Every step is a full combo**, with its own modifiers. A step can also be a single modifier, which means a tap: see [Double tap and long press](#double-tap-and-long-press).
- **Prefix bindings wait, like Vim.** If you bind both `"g"` and `"g g"`, pressing `g` does not fire `"g"` yet: the engine waits up to `sequenceTimeout` to see whether a second `g` follows. If it does, only `"g g"` fires. If a different key comes, or the time runs out, `"g"` fires then. The wait happens only when a longer sequence starting with the same keys is bound, enabled and in an active scope; a lone `"g"` fires instantly. The key's default action is cancelled right away (when `preventDefault` is on), and `trigger()` never waits.
- **Typing in inputs:** `ignoreInputs: "auto"` looks at the last step, so `"g i"` does not fire while typing, but `"mod+k mod+s"` does.
- **Only on `keydown`.** `{ on: "keyup" }` with a sequence throws `HotkeyParseError`.
- **`preventDefault` applies to the final step.** Earlier keys keep their normal behaviour.
- `hotkeys.trigger("g i")` runs it, and `formatHotkey("g i")` gives `"G I"`.

### Double tap and long press

**Double tap is a sequence that repeats the key.** There is nothing extra to learn:

```ts
hotkeys.bind("k k", openSearch);          // press k twice
hotkeys.bind("shift shift", openSearch);  // tap Shift twice, like "Search Everywhere" in an IDE
hotkeys.bind("shift k", doSomething);     // tap Shift, then press k
```

In a sequence, a step that is a single modifier means a **tap**: press and release that modifier quickly without touching any other key.

- A tap lasts at most `tapTimeout` (300 ms by default, an option of `createHotkeys`). Holding Shift while typing `A` is not a tap.
- Taps are spaced like the other steps of a sequence, by `sequenceTimeout`.
- The binding fires when the second tap is **released**, not when it is pressed.
- A tap step is a single modifier. `"ctrl+shift ctrl+shift"` throws `HotkeyParseError`.
- A modifier-only combo on its own (`"shift"`) is not a tap: it fires when the modifier is pressed, as before.
- `ignoreInputs: "auto"` ignores Shift and Alt taps while typing in an input, but `ctrl` and `meta` taps still work.

**Long press is the `hold` option**, in milliseconds:

```ts
hotkeys.bind("k", showTooltip, { hold: 600 });          // fires once k has been held for 600 ms
hotkeys.bind("shift", enterSelectMode, { hold: 400 });  // also works with modifiers
```

- It fires **once**, and the handler receives the original `keydown` event. Releasing the key, or one of the combo's modifiers, before the time is up cancels it. Auto-repeat is ignored.
- `preventDefault` is applied right when the key goes down, not after the wait.
- A `hold` binding is **independent** of plain bindings on the same keys. A plain `"k"` binding still fires on press. Give long press its own combo, or accept that both fire.
- `hold` needs a single combo and `on: "keydown"`; with a sequence, `keyup`, or a value that is not greater than 0, `bind` throws `HotkeyParseError`.
- `trigger()` fires a `hold` binding immediately, and `getBindings()` includes the `hold` time.

### Options

Pass them as the third argument: `hotkeys.bind("mod+k", handler, { scope: "editor", priority: 10 })`.

| Option | Default | What it does |
| --- | --- | --- |
| `scope` | `"global"` | Scope the binding belongs to. `"*"` means active in every scope. See [Scopes](#scopes). |
| `priority` | `0` | Higher wins when several bindings match. See [Priorities](#priorities-and-conflicts). |
| `on` | `"keydown"` | `"keydown"` or `"keyup"`. Sequences need `"keydown"`. |
| `enabled` | `true` | `false` turns it off. Pass a function `() => boolean` to decide at event time. |
| `once` | `false` | Remove the binding after it fires once. |
| `hold` | none | Fire only after the combo has been held this many milliseconds (long press). See [Double tap and long press](#double-tap-and-long-press). |
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
| `tapTimeout` | `300` | Longest time a modifier can be held and still count as a tap (`"shift shift"`). |
| `sequenceTimeout` | `1000` | Milliseconds allowed between the steps of a [sequence](#sequences), and how long a [prefix binding](#sequences) waits. |
| `keymap` | none | Named actions with default shortcuts. See [Keymap](#keymap). |
| `overrides` | none | The user's saved shortcut changes, applied on top of the keymap. |
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

#### `subscribe(listener)` and `notify()`: react to changes

```ts
const stop = hotkeys.subscribe(() => {
  renderHelp(hotkeys.getBindings());
});
```

The listener runs whenever a binding is added or removed (including `once` bindings firing), a scope opens or closes, or a shortcut changes. `getBindings()` and `getShortcuts()` return the **same array** until then, so they work directly with React's `useSyncExternalStore`. The arrays are read-only.

The engine cannot see what an `enabled` function reads. If that changes, call `hotkeys.notify()` so subscribers refresh `active`.

#### `formatHotkey(combo)`: show it to the user

```ts
import { formatHotkey } from "@usehotkeys/core";

formatHotkey("mod+shift+k", { platform: "mac" });   // "⇧⌘K"
formatHotkey("mod+shift+k", { platform: "other" }); // "Ctrl+Shift+K"
formatHotkey("esc");                                // "⎋" on Mac, "Esc" elsewhere
```

`platform` defaults to the user's.

### `isPressed(combo)`

```ts
hotkeys.isPressed("shift");      // true while Shift is held
hotkeys.isPressed("a");
hotkeys.isPressed("ctrl+shift"); // true while both are held; "mod" works too
```

State resets when the window loses focus, the tab is hidden, or `Cmd` is released on macOS (browsers do not send `keyup` for other keys in that case), so keys never get "stuck". `isPressed` is already `false` inside a `keyup` handler.

`isPressed` is a snapshot. To react to changes, `hotkeys.subscribePressed(listener)` calls `listener` on every key press and release and returns the function that stops it. While someone is subscribed the engine keeps listening to the keyboard, even with no bindings. In React use [`useIsPressed`](#useispressed).

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

### Keymap

So far a shortcut was written next to the code that runs it. A **keymap** separates the two: you name an *action* once, give it default keys, and the user can change the keys later without any code change.

```ts
const hotkeys = createHotkeys({
  keymap: {
    openPalette: { keys: "mod+k", label: "Open command palette", group: "Navigation" },
    save: "mod+s",
    goInbox: "g i",
  },
  overrides: JSON.parse(localStorage.getItem("shortcuts") ?? "{}"), // the user's saved changes
});

hotkeys.bindAction("openPalette", () => openPalette());
hotkeys.bindAction("save", save);
```

An entry is the keys (`"mod+k"`, `["j", "arrowdown"]`, a sequence), or an object with `keys` plus `label`, `description` and `group`. Bindings of the action inherit that metadata, so `getBindings()` can build a help screen with no extra work. `bindAction` takes the same options as `bind`.

| Method | What it does |
| --- | --- |
| `bindAction(action, handler, options?)` | Like `bind`, but the keys come from the keymap. Returns the unbind function. |
| `setShortcut(action, keys)` | Change an action's keys. `null` goes back to the default, `[]` removes the shortcut. Existing bindings follow the change immediately; nothing is re-registered. |
| `getShortcuts()` | Every action with `keys`, `defaultKeys`, `customized`, `label`, `group`... for a settings screen. |
| `getOverrides()` | Only what the user changed, `{ openPalette: ["mod+p"] }`, ready to save. |
| `subscribe(listener)` | Called after any change, so a settings screen can re-render. |

**Letting users change a shortcut** (record, apply, save):

```ts
const combo = await hotkeys.record();
if (combo) {
  hotkeys.setShortcut("openPalette", combo);
  localStorage.setItem("shortcuts", JSON.stringify(hotkeys.getOverrides()));
}
```

- **Saving is yours.** The library never touches storage. Pass what you saved as `overrides` next time. Saved combos use `mod`, so they work across platforms.
- **Everything is validated up front.** An invalid combo in `keymap`/`overrides` throws `HotkeyParseError` from `createHotkeys`; an unknown action throws `UnknownActionError` from `bindAction`, `setShortcut` and `overrides`.
- **Conflicts are still reported.** If the user gives two actions the same keys, `onConflict` / `getConflicts()` tell you (see [Priorities and conflicts](#priorities-and-conflicts)).
- A sequence cannot be assigned to an action that is bound with `on: "keyup"`; `setShortcut` throws and changes nothing.

### Errors

All errors extend `HotkeysError`, so `instanceof` works.

| Error | When |
| --- | --- |
| `HotkeyParseError` | A combo is invalid: empty, `"ctrl+"`, `"k+ctrl"`, repeated modifier, two keys, a sequence step with several modifiers and no key, a sequence on `keyup`, `hold` with a sequence or `keyup`, or `hold` not greater than 0. It has a `combo` property and a message saying what is wrong. Thrown by `bind` and `formatHotkey`, so mistakes show up the first time you run the code. |
| `UnknownActionError` | `bindAction`, `setShortcut` or `overrides` named an action that is not in the `keymap`. It has an `action` property. |
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

**Use it with any framework**: create the engine once, `bind` when the component mounts in the browser, and call the function `bind` returned when it unmounts. That is all the React package does.

### Compatibility and size

| | |
| --- | --- |
| Browsers | Modern evergreen browsers (the build targets ES2022, so browsers from 2021 onwards). No IE, no polyfills. |
| React (`@usehotkeys/react`) | React 18 and 19. CI runs the hook tests against both. |
| Other frameworks | Any. The core has no framework code: create one engine, `bind` when the component mounts in the browser, and call the returned function when it unmounts. |
| TypeScript | Written in strict TypeScript; types are included. |
| Module formats | ESM and CommonJS, each with matching type declarations. |
| Dependencies | None. `@usehotkeys/react` has `react` and `@usehotkeys/core` as peer dependencies. |
| Size | About 6.7 KB minified + gzipped for `@usehotkeys/core`, and about 1.4 KB for `@usehotkeys/react` on top of it. |
| Server | Importing the packages or creating an engine on a server does nothing: no DOM access at import time, and nothing is attached until the first `bind`. Handling keys only makes sense in the browser. |

### How it works

For people who want to contribute or debug.

- **Files** (`packages/core/src`): `parser.ts` turns `"mod+k"` into modifier flags plus a normalised key; `matcher.ts` compares that with a `KeyboardEvent`; `hotkeys.ts` owns the registry, the scope stack, the pressed-key set and dispatch; `filter.ts` implements `ignoreInputs`; `format.ts` renders combos; `keys.ts` holds aliases. `index.ts` is the only public surface.
- **No classes.** State lives in the closure that `createHotkeys` returns (the only classes are the error types).
- **One listener pair.** The engine registers a single `keydown` and `keyup` on the target and does its own matching, so adding bindings never adds DOM listeners.
- **Dispatch** (per event): drop IME events; collect candidates that match event type, repeat rule, enabled, active scope, element, keys and `ignoreInputs`; sort by priority, scope depth, then registration id; run the winner (and further ones only after `passthrough`). `once` bindings are removed before their handler runs.
- **Sequences.** The engine keeps the last few non-modifier key presses with timestamps. A binding with N steps matches when the last N presses match its steps in order; presses older than `sequenceTimeout` are dropped, and the history is cleared after a sequence fires. Single combos are just sequences of one step.
- **Taps and holds.** The engine remembers when each modifier went down and whether another key was pressed meanwhile; releasing it quickly with nothing in between adds a `tap` item to the history, which only satisfies modifier-only steps of multi-step sequences. A `hold` binding does not fire on `keydown`: it starts a timer that is cancelled by the `keyup` of its key or modifiers, and runs the handler when it expires.
- **Recorder.** `record()` (in `record.ts`) adds capture-phase listeners that swallow the keys, pauses dispatch while active, and builds the combo string with the same key rules as the matcher.
- **Change tracking.** Every change bumps a `version` and calls subscribers. `getBindings()`/`getShortcuts()` cache their result per version, which is what makes them safe for `useSyncExternalStore`.
- **Keymap.** Action bindings store the action id, not fixed keys; `setShortcut` re-parses the keys of the affected entries in place, so they keep their registration order.
- **Lazy lifecycle.** Listeners attach on the first binding and detach on the last unbind.

### FAQ and known limits

**Why did my shortcut not fire?** Check, in order: is the combo what you think (`formatHotkey` it)? Is its `scope` active (`getActiveScopes()`)? Is another binding outranking it (`getConflicts()`, or set `debug: true`)? Is the user typing in an input (`ignoreInputs`)? Did the browser or OS reserve the key (`Ctrl+W`, `Cmd+Q`, `Ctrl+T` cannot be intercepted by any web page)?

**`keyup` on macOS with `Cmd` held.** The browser does not send `keyup` for non-modifier keys released while `Cmd` is down, so `{ on: "keyup" }` bindings combined with `meta` will not fire. Use `keydown`.


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

### `useHotkeyAction`

```ts
useHotkeyAction(action, handler, options?)
```

Like `useHotkeys`, but the keys come from the **keymap** (see [Keymap](#keymap)) instead of being written in the component. If the user changes the shortcut later, the binding follows it without re-registering.

```tsx
<HotkeysProvider options={{ keymap: { openPalette: { keys: "mod+k", label: "Open palette" } } }}>
  <App />
</HotkeysProvider>

function App() {
  useHotkeyAction("openPalette", () => setOpen(true));
  // ...
}
```

An action that is not in the keymap throws `UnknownActionError`. The options are the same as `useHotkeys`.

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

### `useBindings`

```ts
const bindings = useBindings({ activeOnly?, labeledOnly?, group?, scope? });
```

Returns every shortcut registered in the app and **stays up to date**: it re-renders when a component mounts or unmounts a hotkey, a scope opens or closes, or `enabled` flips. Use it for a "keyboard shortcuts" help dialog.

| Filter | Meaning |
| --- | --- |
| `activeOnly` | Only shortcuts that can fire right now: enabled and in an active scope. |
| `labeledOnly` | Only shortcuts with a `label` (skips the ones you did not name). |
| `group` | Only this `group`. |
| `scope` | Only this `scope`. |

```tsx
import { formatHotkey } from "@usehotkeys/core";
import { useBindings } from "@usehotkeys/react";

function ShortcutsHelp() {
  const bindings = useBindings({ activeOnly: true, labeledOnly: true });
  return (
    <ul>
      {bindings.map((b) => (
        <li key={b.id}>
          {b.label}: <kbd>{formatHotkey(b.combos[0]!)}</kbd>
        </li>
      ))}
    </ul>
  );
}
```

Each item has `label`, `description`, `group`, `combos`, `scope`, `priority`, `active` and `action`. It lists what is *registered*; if you want the keys the user customised, use `useShortcuts`.

### `useShortcuts`

```ts
const shortcuts = useShortcuts({ group? });
```

Every action of the keymap with its current keys, kept up to date: `action`, `keys`, `defaultKeys`, `customized`, `label`, `description`, `group`. Combine it with `useRecordHotkey` for a settings screen:

```tsx
function ShortcutSettings() {
  const hotkeys = useHotkeysInstance();
  const shortcuts = useShortcuts();
  const { start, isRecording } = useRecordHotkey();

  async function change(action: string) {
    const combo = await start();
    if (combo) {
      hotkeys.setShortcut(action, combo);
      localStorage.setItem("shortcuts", JSON.stringify(hotkeys.getOverrides()));
    }
  }

  return (
    <ul>
      {shortcuts.map((s) => (
        <li key={s.action}>
          {s.label ?? s.action}: <kbd>{s.keys.map((k) => formatHotkey(k)).join(", ") || "none"}</kbd>
          <button type="button" onClick={() => change(s.action)} disabled={isRecording}>Change</button>
          {s.customized && <button type="button" onClick={() => hotkeys.setShortcut(s.action, null)}>Reset</button>}
        </li>
      ))}
    </ul>
  );
}
```

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

### `useIsPressed`

```ts
const shiftHeld = useIsPressed("shift");
```

`true` while the user is holding the combo, and re-renders when that changes. The argument can be a key (`"shift"`, `"a"`) or a combination (`"ctrl+shift"`, `"mod+k"`). It is `false` on the server and while hydrating, and an invalid combo throws `HotkeyParseError`.

```tsx
function Row({ item }: { item: Item }) {
  const selecting = useIsPressed("shift"); // show checkboxes while Shift is held
  return <li>{selecting && <input type="checkbox" />} {item.name}</li>;
}
```

It reads the same pressed-key state as `hotkeys.isPressed`, which resets on window blur, tab hiding and `Cmd` release, so it never gets stuck. Use `useHotkeys` with `hold` or a modifier tap if you want to *run* something instead of showing a state.

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

`useHotkeysInstance()` returns the engine in use, for calling methods directly such as `setShortcut`, `getOverrides` or `trigger`. For lists, use [`useBindings`](#usebindings) and [`useShortcuts`](#useshortcuts), which stay up to date.

Engine methods that have no hook of their own are available on that instance:

| Method | Use it for |
| --- | --- |
| `getBindings()` | A one-time read of the registered shortcuts. It does not re-render; use `useBindings` in components. |
| `getConflicts()` | Checking for competing shortcuts, e.g. in a test or a dev-only effect. |
| `getActiveScopes()` | Seeing which scopes are active right now. |
| `isPressed(key)` | Whether a key is held. Read it inside event handlers, not while rendering: it is not reactive. |
| `trigger(combo)` | Running a shortcut from a button so both do the same thing. |
| `notify()` | Telling `useBindings` to refresh when something an `enabled` function reads has changed. |

Each is explained in the [core README](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#reading-state).

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

**Next.js / SSR**: see [Next.js and server rendering](#nextjs-and-server-rendering).

### Next.js and server rendering

- **The hooks are safe on the server.** `useHotkeys`, `useHotkeyAction` and `useHotkeyScope` only touch the engine inside effects, which never run on the server. `useBindings` and `useShortcuts` render an empty list on the server and while hydrating, then fill in, so there is no hydration mismatch.
- **App Router.** The package ships with a `"use client"` directive, so you can import `HotkeysProvider` straight into a Server Component such as `app/layout.tsx`. Your own components that *call* a hook need `"use client"` at the top of their file, like with any React hook.

  ```tsx
  // app/layout.tsx (a Server Component)
  import { HotkeysProvider } from "@usehotkeys/react";

  export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
      <html lang="en">
        <body>
          <HotkeysProvider>{children}</HotkeysProvider>
        </body>
      </html>
    );
  }
  ```

  ```tsx
  // app/command-palette.tsx
  "use client";

  import { useHotkeys } from "@usehotkeys/react";
  import { useState } from "react";

  export function CommandPalette() {
    const [open, setOpen] = useState(false);
    useHotkeys("mod+k", () => setOpen(true));
    return open ? <dialog open>…</dialog> : null;
  }
  ```

- **Functions cannot cross the server/client boundary.** If you need `options.onConflict` or `options.defaults.ignoreInputs` as a function, build the provider in your own `"use client"` component instead of passing those props from a Server Component.
- **No leaks between requests.** Without a provider the hooks share one engine that attaches nothing until a binding exists, and bindings only exist in browsers, so a server rendering many requests never accumulates shortcuts.
- Pages Router, Remix, Vite SSR and Astro islands follow the same rule: hooks go in components that render on the client.

### How the React hooks work

- `useHotkeys` stores the latest `handler` and options in a ref and runs one `useEffect` that calls `hotkeys.bind(...)` and returns the unbind function. The effect depends on the combo and the static options only, so it is StrictMode-safe (mount, unmount, mount again leaves exactly one binding).
- `useHotkeyAction` shares its implementation with `useHotkeys` and calls `hotkeys.bindAction`, so changing a shortcut never re-registers.
- `useBindings` and `useShortcuts` use `useSyncExternalStore` with the engine's `subscribe` and its cached snapshots; they re-render only when something changed.
- `useIsPressed` subscribes to the engine's pressed-key state with `useSyncExternalStore`, so it re-renders only when the answer for its combo changes.
- `useHotkeyScope` runs `hotkeys.pushScope(...)` in an effect and returns its disposer.
- The engine is created lazily on first use (or by `HotkeysProvider`), and attaches DOM listeners only while at least one binding exists.
- Source is three small files in `src/`: `context.tsx`, `use-hotkeys.ts`, `use-hotkey-scope.ts`.

### React FAQ

**My shortcut does nothing.** See "Why did my shortcut not fire?" in the [core FAQ](#faq-and-known-limits). Setting `<HotkeysProvider options={{ debug: true }}>` logs conflicts.

**Do I need `@usehotkeys/core` installed?** Yes. It is a peer dependency so your app and these hooks share one copy.

**Does re-rendering reset the binding order?** No. Handler, `enabled` and function `ignoreInputs` changes do not re-register. Only changes to the combo or static options do, and then the binding counts as "most recent" again.

## Contributing

Setup, the checks to run before a pull request, and how to try the built packages locally are in [CONTRIBUTING.md](./CONTRIBUTING.md#development-workflow).

Changelogs: [`@usehotkeys/core`](./packages/core/CHANGELOG.md) · [`@usehotkeys/react`](./packages/react/CHANGELOG.md).

## License

[ISC](./LICENSE)
