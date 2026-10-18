# Changelog

All notable changes to `@usehotkeys/react` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-17

First release. Requires `@usehotkeys/core` 0.1.0 and React 18 or later.

### Added

- `useHotkeys` (combos and sequences), `useHotkeyAction` (named actions from the keymap) and `useHotkeyScope`.
- `useBindings` and `useShortcuts`, always up to date through `useSyncExternalStore`.
- `useIsPressed` re-renders while a key or combo is held; `hold` is available in every binding hook.
- `useRecordHotkey` for "customize your shortcuts" screens.
- `HotkeysProvider` and `useHotkeysInstance`; hooks work without a provider through a shared engine.
- Latest-handler semantics: no stale closures, no re-registration on re-render.
- `"use client"` directive for the Next.js App Router; StrictMode and SSR safe.

[0.1.0]: https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/releases/tag/v0.1.0
