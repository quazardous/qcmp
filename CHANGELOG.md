# Changelog

> **This file is human-friendly.** It is written for a developer deciding
> whether to upgrade — not for a release bot. Each section leads with the
> user-facing impact (the CLI surface, the `qcmp.yaml` contract, install
> behavior). Internal refactors, typo fixes, and CI churn don't show up
> here unless they change something a user can observe.
>
> Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
> loosely — `## [X.Y.Z] - YYYY-MM-DD` headers, grouped under
> **Added / Changed / Fixed / Removed / Deprecated**. The header shape is
> the one `qcmp changelog <key>` tails, so the file doubles as its own
> machine-readable feed.
>
> Versioning: [SemVer](https://semver.org/). Bumps reflect user-visible
> contract changes, not internal cleanup cadence.

## [0.3.0] - 2026-05-22

### Added
- **Programmatic SDK** — `import { qcmp } from "@quazardous/qcmp"` is now
  the single way to read versions from code: `qcmp().version(key)`,
  `.versions()`, `.versionsSafe()`, `.list()`, `.get(key)`,
  `.changelog(key)`. The low-level functions the CLI is built on
  (`loadConfig`, `extractVersion`, `writeVersion`, the semver helpers) and
  the `Component` / `ComponentsConfig` types are exported too. The CLI is
  the same library with a terminal face — not a separate API.

### Changed
- **qcmp now builds to `dist/`** (`.js` + `.d.ts`) instead of running the
  TypeScript source directly. The import works from any JS runtime (plain
  Node, tsx, bundler), and qcmp is installable as a git/file dependency —
  the `prepare` script builds on `npm install`. The CLI runs
  `node dist/cli.js` (no tsx at runtime); `./install.sh` builds during
  install.

## [0.2.0] - 2026-05-14

Documentation-only release. No code paths change; if you read the README
to figure out how the `git` extractor picks a tag, the answer was wrong
before — now it isn't.

### Fixed
- **README** — the `git` extractor docs implied `path:` overrides the
  default `v*` glob in the normal case. In reality, the primary code
  path is `git describe --tags --abbrev=0`, which lets git pick the tag
  itself and **ignores `path:`**. The glob is only consulted as a
  fallback when describe returns nothing. Both the YAML example and the
  extractors table now reflect that.
- **`src/extractors/git.ts` docstrings** — said "annotated tag" (but
  `git describe --tags` accepts lightweight tags too) and "regex passed
  via `path`" (it's a shell glob, not a regex). An internal comment also
  said "lexicographically last" right next to a semver-ish comparator.
  All three reworded.

## [0.1.0] - 2026-05-14

Initial release.

### Added
- `qcmp.yaml` at the project root as the single source of truth for the
  component inventory. Walk-up from `cwd` finds it, so subcommands work
  from anywhere in the repo; `--config <path>` overrides.
- CLI surface: `list`, `version <key>`, `versions [--pretty]`,
  `bump <key> <major|minor|patch> [--exact V] [--dry-run]`,
  `changelog <key> [--limit N]`.
- Four extractors: **`json`** (dotted path), **`text`** (whole file
  trimmed), **`regex`** (first capture group), **`git`** (latest tag
  reachable from HEAD).
- Three bumpers: `json` preserves indentation, `text` rewrites the file
  with a trailing newline, `regex` substitutes only the first capture
  group. `git` has no bumper and exits non-zero with a hint to
  `git tag v<new>`.
- `install.sh` — rsync into `~/.local/lib/qcmp` + symlink
  `~/.local/bin/qcmp`. `--symlink` mode for dev (lib dir → checkout).
  `--uninstall` removes both.
- `bin/qcmp` exports `QCMP_CWD` before `cd $ROOT`, so the parser's
  walk-up sees the invoker's tree (not the install dir).
