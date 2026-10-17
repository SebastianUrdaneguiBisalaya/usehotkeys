# Contributing

Thanks for your interest in contributing! This project is a TypeScript keyboard-shortcut library (a pnpm workspace with `@usehotkeys/core` and `@usehotkeys/react`). Please read this guide before opening a pull request.

## Code of conduct

Be respectful and constructive. Disagreements about code and design are welcome; personal attacks are not.

## Prerequisites

- Node.js `>=18.0.0`
- [pnpm](https://pnpm.io/) `11.1.1` (this repo uses pnpm exclusively — do not commit `package-lock.json` or `yarn.lock`)

## Getting started

1. **Fork** the repository and clone your fork:
   ```bash
   git clone git@github.com:<your-username>/<your-repo>.git
   cd <your-repo>
   ```
2. **Install dependencies**:
   ```bash
   pnpm install
   ```
3. **Create a branch** from `main` using a descriptive, prefixed name:
   ```bash
   git switch -c feat/add-refunds-resource
   git switch -c fix/charges-error-mapping
   git switch -c docs/update-readme-examples
   ```
   Common prefixes: `feat/`, `fix/`, `docs/`, `refactor/`, `test/`, `chore/`.

## Making changes

- Keep pull requests focused: one logical change per PR. Unrelated fixes should be separate PRs.
- Follow the standards documented in [`AGENTS.md`](./AGENTS.md) — this is the source of truth for architecture, TypeScript conventions, public API surface, and SDK-specific practices (client design, error handling, security). Read it before making non-trivial changes.
- Only export from `src/index.ts` what is meant to be public API. Adding or changing an export is a public API change — treat it accordingly (see semver rules in `AGENTS.md`).
- Never commit `dist/`, `.env*` files, real API credentials, or real sensitive data (including in test fixtures — use the third-party provider's documented test credentials/fixtures only).
- Write TSDoc comments on public functions/types when the name alone isn't self-explanatory.

## Git hooks

This repo uses [husky](https://typicode.github.io/husky/) to run checks automatically via git hooks. They install for you the first time you run `pnpm install`, so you don't need to set anything up manually:

- **`pre-commit`**: runs `pnpm run lint` and `pnpm run typecheck`.
- **`commit-msg`**: rejects commits whose message doesn't follow Conventional Commits (see below).
- **`pre-push`**: runs `pnpm run test` and `pnpm run build`.

Don't bypass these with `--no-verify` — if a hook is blocking you, fix the underlying issue (or ask in the PR/issue if you think the hook itself is wrong).

## Local checks (must pass before opening a PR)

Run these locally — the same checks run in CI on every pull request:

```bash
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # biome check
pnpm run test        # vitest run
pnpm run build       # tsup, verifies the package actually bundles
```

If you're adding new behavior, add or update tests under `tests/`, mirroring the structure of `src/`. Mock the HTTP layer — never call the real third-party API from unit tests.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(client): add support for automatic retries
fix(client): correctly propagate 401 responses as AuthenticationError
docs: add usage example to README
chore(deps): bump tsup to 8.6.0
```

This keeps history readable and makes it possible to automate changelogs later.

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Fill in the PR description: what changed, why, and how it was tested. Link any related issue.
3. Ensure the CI checks (typecheck, lint, test, build) pass — a PR with red checks will not be reviewed.
4. If your change affects the public API (anything exported from `src/index.ts`), call that out explicitly in the PR description and note whether it's a breaking change.
5. Be responsive to review feedback. A maintainer will merge once the PR is approved and CI is green.

## What you should *not* do

- Do not bump the `version` field in `package.json` in a feature/fix PR — versioning and releases are handled separately by maintainers (see the release process in `AGENTS.md`).
- Do not run `npm publish` / `pnpm publish` yourself. Publishing to npm happens exclusively through the `.github/workflows/publish.yml` GitHub Actions workflow, triggered by a maintainer publishing a GitHub Release.
- Do not add a runtime dependency without discussing it first in an issue — this SDK aims for zero runtime dependencies whenever possible (see `AGENTS.md`).

## Reporting bugs / requesting features

Open a GitHub issue with:
- A clear description of the bug or the requested feature.
- Steps to reproduce (for bugs), including the SDK version and Node.js version.
- Expected vs. actual behavior.

Please do not include real secret keys or customer data in issues — use the third-party provider's test credentials when sharing reproduction steps.

## Development workflow

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

By contributing, you agree that your contributions will be licensed under the project's [ISC License](./LICENSE).
