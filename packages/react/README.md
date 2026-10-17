# @usehotkeys/react

React hooks for [`@usehotkeys/core`](../core/README.md): declare keyboard shortcuts next to the component that owns them. They are added on mount and removed on unmount.

Works with React 18 and 19, StrictMode and server rendering.

```bash
pnpm add -E @usehotkeys/react @usehotkeys/core
```

## Contents

1. [Quick start](#quick-start)
2. [`useHotkeys`](#usehotkeys)
3. [`useHotkeyScope`](#usehotkeyscope)
4. [`useRecordHotkey`](#userecordhotkey)
5. [`HotkeysProvider`](#hotkeysprovider)
6. [Recipes](#recipes)
7. [How it works](#how-it-works)
8. [FAQ](#faq)

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

No provider, no setup. `mod` is `⌘` on macOS and `Ctrl` elsewhere. For how combos are written (`"mod+shift+k"`, `"?"`, `"ctrl++"`, arrays), see [Writing combos](../core/README.md#writing-combos) in the core README.

## `useHotkeys`

```ts
useHotkeys(combo, handler, options?)
```

| Argument | Type | Notes |
| --- | --- | --- |
| `combo` | `string \| string[]` | `"mod+k"` or `["j", "arrowdown"]`. An invalid combo throws `HotkeyParseError` during the effect. |
| `handler` | `(event, { combo, binding }) => void` | Called when the keys are pressed. |
| `options` | `UseHotkeysOptions` | Same options as [core `bind`](../core/README.md#options): `scope`, `priority`, `enabled`, `once`, `ignoreInputs`, `layout`, `label`... |

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

- **Conflicts between components are resolved for you.** If two mounted components bind `escape`, the highest `priority` wins, then the most recently mounted. See [Priorities and conflicts](../core/README.md#priorities-and-conflicts).
- **Typing in inputs is handled.** Plain keys do not fire while the user types; `mod+s` does. Change it with `ignoreInputs`. See [Typing in inputs](../core/README.md#typing-in-inputs).

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

## `useRecordHotkey`

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
| `options` | [`createHotkeys` options](../core/README.md#options) for the engine the provider creates: `platform`, `capture`, `defaults`, `onConflict`, `debug`. |
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

**Next.js / SSR**: hooks only register inside effects, so nothing runs on the server. Use them in Client Components (`"use client"`).

## How it works

- `useHotkeys` stores the latest `handler` and options in a ref and runs one `useEffect` that calls `hotkeys.bind(...)` and returns the unbind function. The effect depends on the combo and the static options only, so it is StrictMode-safe (mount, unmount, mount again leaves exactly one binding).
- `useHotkeyScope` runs `hotkeys.pushScope(...)` in an effect and returns its disposer.
- The engine is created lazily on first use (or by `HotkeysProvider`), and attaches DOM listeners only while at least one binding exists.
- Source is three small files in `src/`: `context.tsx`, `use-hotkeys.ts`, `use-hotkey-scope.ts`.

## FAQ

**My shortcut does nothing.** See "Why did my shortcut not fire?" in the [core FAQ](../core/README.md#faq-and-known-limits). Setting `<HotkeysProvider options={{ debug: true }}>` logs conflicts.

**Do I need `@usehotkeys/core` installed?** Yes. It is a peer dependency so your app and these hooks share one copy.

**Does re-rendering reset the binding order?** No. Handler, `enabled` and function `ignoreInputs` changes do not re-register. Only changes to the combo or static options do, and then the binding counts as "most recent" again.
