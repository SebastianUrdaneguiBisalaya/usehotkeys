# Changelog

All notable changes to `@usehotkeys/core` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-17

First release.

### Added

- `createHotkeys()` engine with `bind`, `trigger`, `destroy` and lazy listeners (nothing is attached until the first binding).
- Combos with exact modifiers, `mod` per platform, aliases, `ctrl++`, modifier-only combos and arrays of combos.
- Logical and physical keyboard layouts; handling of symbols, numpad, macOS Option, non-Latin layouts and AltGr.
- Sequences (`"g i"`, `"mod+k mod+s"`) with `sequenceTimeout` and Vim-style waiting when a binding is a prefix of a longer sequence.
- Double tap through sequences (`"k k"`, `"shift shift"` with `tapTimeout`) and long press through the `hold` option.
- `isPressed` accepts combos, and `subscribePressed` reports pressed-key changes.
- Scopes (`pushScope`, `inherit: false` for modals, `"*"` for always-on bindings).
- Priorities, `passthrough`, conflict detection (`onConflict`, `getConflicts`, `debug`).
- `ignoreInputs` (`"auto"`, boolean, selector or function) with Shadow DOM support and IME handling.
- Options `enabled`, `once`, `repeat`, `on: "keyup"`, `element`, `preventDefault`, `stopPropagation`, `label`, `description`, `group`.
- `getBindings`, `isPressed` with blur/visibility/Cmd reset, `formatHotkey`.
- `record()` to capture a combo from the user.
- `subscribe`/`notify` with version-cached snapshots.
- Keymap of named actions with user overrides: `bindAction`, `setShortcut`, `getShortcuts`, `getOverrides`.
- Typed errors: `HotkeysError`, `HotkeyParseError`, `HotkeysEnvironmentError`, `UnknownActionError`.

[0.1.0]: https://github.com/SebastianUrdaneguiBisalaya/usehotkeys/releases/tag/v0.1.0
