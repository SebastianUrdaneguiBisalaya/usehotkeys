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

## Packages

| Package | What it is | Use it when |
| --- | --- | --- |
| [`@usehotkeys/core`](./packages/core) | The engine. No dependencies, no framework. | Vanilla JS, Vue, Svelte, Angular, or building your own bindings. |
| [`@usehotkeys/react`](./packages/react) | `useHotkeys`, `useHotkeyScope`, `<HotkeysProvider>`. | React 18 or 19. It installs on top of core. |

```bash
pnpm add -E @usehotkeys/react @usehotkeys/core   # React
pnpm add -E @usehotkeys/core                     # anything else
```

Full documentation, with every option explained, lives in each package's README:

- **[Core: engine, combos, options, scopes, conflicts](./packages/core/README.md)**
- **[React: hooks and provider](./packages/react/README.md)**

## What you get

- **Readable combos.** `"mod+shift+k"`, `"ctrl++"`, `"esc"`, `"?"`, `["j", "arrowdown"]`. Invalid combos throw a clear `HotkeyParseError` right away.
- **Right key on every keyboard.** Matches the character the user types (Dvorak, AZERTY, Cyrillic) or the physical position with `layout: "physical"`. Handles `?`, `+`, numpad, arrows, macOS Option and AltGr.
- **Exact modifiers.** `ctrl+k` does not fire on `ctrl+shift+k`.
- **Scopes.** Activate a group of shortcuts only while a panel or modal is open, and optionally block everything behind it.
- **Priorities and conflicts.** Two components binding `escape` is not a coin flip: highest `priority` wins, then the deepest scope, then the most recent. Conflicts are detected and reported.
- **Smart input handling.** Plain keys are ignored while typing in inputs, `mod+s` still works. Configurable per binding, Shadow DOM aware.
- **No stuck keys.** Pressed-key state resets on window blur, tab switch and macOS `Cmd` release.
- **Introspection.** `getBindings()` returns labels, groups and descriptions for a "keyboard shortcuts" help dialog; `formatHotkey()` renders `⇧⌘K` or `Ctrl+Shift+K`.
- **Safe by default.** Nothing is attached until the first binding exists. Importing on the server does nothing.
- **Typed.** Strict TypeScript, ESM and CJS builds.

## Coming next

Key sequences (`"g g"`), a shortcut recorder for settings screens, and `useIsPressed`. Passing a space-separated combo today throws a `HotkeyParseError` that says so.

## Development

This is the exact sequence to run after making a source change, and how to actually try the built package locally. Run every command from the repo root with `pnpm` — they delegate to every package in `packages/` automatically.

### After any change to `packages/*/src/`, `tsup.config.ts`, `tsconfig.json`, or `package.json`

Run these in order and fix any failure before moving to the next step — don't skip ahead on a red step:

```bash
pnpm install          # only needed if dependencies changed
pnpm run lint:fix      # auto-fix formatting/lint issues (biome)
pnpm run typecheck     # tsc --noEmit — catches type errors
pnpm run test          # vitest run
pnpm run build         # tsup — confirms the package actually bundles
```

Notes:
- `pnpm run lint:fix` before `typecheck`/`test` so formatting noise never masks a real diff in review.
- If the change touched exports in a package's `src/index.ts`, treat it as a public API change: bump the version following semver and update `CHANGELOG.md`/docs accordingly (see [AGENTS.md](./AGENTS.md)).
- `.husky/pre-commit` already runs `lint` + `typecheck` and `.husky/pre-push` already runs `test` + `build` automatically — running them manually first just means you catch problems before the hook does, which is faster feedback.

### Trying the built package locally, as a consumer would

Running `pnpm run build` alone is not enough to know the package works when installed — `exports`, `dist` file paths, and CJS/ESM interop can only be verified by actually installing the built tarball somewhere else.

```bash
pnpm run build
pnpm --filter ./packages/core pack   # or ./packages/react   # produces @usehotkeys/core-<version>.tgz in packages/core/
```

Then, in a separate scratch project (not inside this repo):

```bash
mkdir -p /tmp/sdk-smoke-test && cd /tmp/sdk-smoke-test
npm init -y
npm install /absolute/path/to/@usehotkeys/core-<version>.tgz
```

Verify both module systems resolve correctly:

```js
// esm.mjs
import { createHotkeys } from "@usehotkeys/core";
console.log(typeof createHotkeys);
```
```js
// cjs.cjs
const { createHotkeys } = require("@usehotkeys/core");
console.log(typeof createHotkeys);
```
```bash
node esm.mjs
node cjs.cjs
```

Also open the scratch project in an editor and check that hovering `createHotkeys` shows the expected types — this catches broken `.d.ts` generation that compiling alone won't.

Alternatively, for faster iteration while actively developing against another local project, use `pnpm link` instead of repacking on every change:

```bash
# in this repo
pnpm run build
pnpm --filter ./packages/core link --global

# in the consumer project
pnpm link --global @usehotkeys/core
```

Remember to `pnpm unlink --global @usehotkeys/core` in the consumer project once done, so it goes back to resolving the real published version.

### Before opening a pull request

```bash
git switch -c feat/short-description   # or fix/, docs/, refactor/, test/, chore/ — see CONTRIBUTING.md
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
git add <files>
git commit -m "type(scope): description"      # commit-msg hook enforces Conventional Commits
git push -u origin feat/short-description     # pre-push hook re-runs test + build
```

Then open the PR against `main` as described in [CONTRIBUTING.md](./CONTRIBUTING.md). Do not bump `version` in `package.json` as part of this flow — see the release process in [AGENTS.md](./AGENTS.md).

## License

[ISC](./LICENSE)
