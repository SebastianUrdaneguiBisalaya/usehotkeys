# @usehotkeys/react

React hooks for [`@usehotkeys/core`](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md): declare keyboard shortcuts next to the component that owns them. They are added on mount and removed on unmount.

Works with React 18 and 19, StrictMode and server rendering.

```bash
pnpm add -E @usehotkeys/react @usehotkeys/core
```

## Contents

1. [Quick start](#quick-start)
2. [`useHotkeys`](#usehotkeys)
3. [`useHotkeyAction`](#usehotkeyaction)
4. [`useHotkeyScope`](#usehotkeyscope)
5. [`useBindings`](#usebindings) and [`useShortcuts`](#useshortcuts)
6. [`useRecordHotkey`](#userecordhotkey)
7. [`useIsPressed`](#useispressed)
8. [`HotkeysProvider`](#hotkeysprovider)
9. [Recipes](#recipes)
10. [Next.js and server rendering](#nextjs-and-server-rendering)
11. [Compatibility](#compatibility)
12. [How it works](#how-it-works)
13. [FAQ](#faq)

## Quick start

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

No provider, no setup. `mod` is `⌘` on macOS and `Ctrl` elsewhere. For how combos are written (`"mod+shift+k"`, `"?"`, `"ctrl++"`, arrays), see [Writing combos](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#writing-combos) in the core README.

## `useHotkeys`

```ts
useHotkeys(combo, handler, options?)
```

| Argument | Type | Notes |
| --- | --- | --- |
| `combo` | `string \| string[]` | `"mod+k"` or `["j", "arrowdown"]`. An invalid combo throws `HotkeyParseError` during the effect. |
| `handler` | `(event, { combo, binding }) => void` | Called when the keys are pressed. |
| `options` | `UseHotkeysOptions` | Same options as [core `bind`](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#options): `scope`, `priority`, `enabled`, `once`, `ignoreInputs`, `layout`, `label`... |

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

- **Conflicts between components are resolved for you.** If two mounted components bind `escape`, the highest `priority` wins, then the most recently mounted. See [Priorities and conflicts](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#priorities-and-conflicts).
- **Typing in inputs is handled.** Plain keys do not fire while the user types; `mod+s` does. Change it with `ignoreInputs`. See [Typing in inputs](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#typing-in-inputs).

## `useHotkeyAction`

```ts
useHotkeyAction(action, handler, options?)
```

Like `useHotkeys`, but the keys come from the **keymap** (see [Keymap](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#keymap)) instead of being written in the component. If the user changes the shortcut later, the binding follows it without re-registering.

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

## `useHotkeyScope`

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

## `useBindings`

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

## `useShortcuts`

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

## `useRecordHotkey`

```ts
const { start, cancel, isRecording, preview, combo } = useRecordHotkey(options?);
```

Records the next combo the user presses (see [Recording shortcuts](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#recording-shortcuts)) and keeps the UI state for you. Options are the same as `hotkeys.record`, except `onChange` and `signal`, which the hook manages.

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

## `useIsPressed`

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

## `HotkeysProvider`

**Optional.** Without it, every hook shares one global engine, which is what you want in most apps. Add a provider when you need to configure the engine or isolate a part of the tree:

```tsx
import { HotkeysProvider } from "@usehotkeys/react";

<HotkeysProvider options={{ debug: true, defaults: { ignoreInputs: "auto" } }}>
  <App />
</HotkeysProvider>
```

| Prop | Meaning |
| --- | --- |
| `options` | [`createHotkeys` options](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#options) for the engine the provider creates: `platform`, `capture`, `defaults`, `onConflict`, `debug`. |
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

## Recipes

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

## Next.js and server rendering

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

## Compatibility

- **React** 18 and 19 (CI runs the tests against both), with StrictMode and concurrent rendering.
- **Peer dependencies:** `react` and `@usehotkeys/core`.
- **Formats:** ESM and CommonJS with types; `"use client"` included for Next.js.
- **Size:** about 1.4 KB minified + gzipped, on top of the core (about 6.7 KB). Browser support is the same as the core's: see [Compatibility and size](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#compatibility-and-size).

## How it works

- `useHotkeys` stores the latest `handler` and options in a ref and runs one `useEffect` that calls `hotkeys.bind(...)` and returns the unbind function. The effect depends on the combo and the static options only, so it is StrictMode-safe (mount, unmount, mount again leaves exactly one binding).
- `useHotkeyAction` shares its implementation with `useHotkeys` and calls `hotkeys.bindAction`, so changing a shortcut never re-registers.
- `useBindings` and `useShortcuts` use `useSyncExternalStore` with the engine's `subscribe` and its cached snapshots; they re-render only when something changed.
- `useIsPressed` subscribes to the engine's pressed-key state with `useSyncExternalStore`, so it re-renders only when the answer for its combo changes.
- `useHotkeyScope` runs `hotkeys.pushScope(...)` in an effect and returns its disposer.
- The engine is created lazily on first use (or by `HotkeysProvider`), and attaches DOM listeners only while at least one binding exists.
- Source is three small files in `src/`: `context.tsx`, `use-hotkeys.ts`, `use-hotkey-scope.ts`.

## FAQ

**My shortcut does nothing.** See "Why did my shortcut not fire?" in the [core FAQ](https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/blob/main/packages/core/README.md#faq-and-known-limits). Setting `<HotkeysProvider options={{ debug: true }}>` logs conflicts.

**Do I need `@usehotkeys/core` installed?** Yes. It is a peer dependency so your app and these hooks share one copy.

**Does re-rendering reset the binding order?** No. Handler, `enabled` and function `ignoreInputs` changes do not re-register. Only changes to the combo or static options do, and then the binding counts as "most recent" again.
