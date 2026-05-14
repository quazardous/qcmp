# qcmp — Quick Components

Tiny CLI that turns a `qcmp.yaml` at the project root into a uniform view of
your project's components: their current versions, their changelogs, and a
simple `bump` operation. One config file, four extractors
(`json` / `text` / `regex` / `git`), three bumpers, no daemon, no MCP.

```bash
qcmp list                       # one row per component
qcmp version <key>              # print one version
qcmp versions [--pretty]        # JSON map { key: version }
qcmp bump <key> patch           # 0.1.4 → 0.1.5, writes back to the source file
qcmp bump <key> minor
qcmp bump <key> major
qcmp bump <key> --exact 1.0.0   # explicit override (skips semver math)
qcmp bump <key> patch --dry-run # show the change, don't write
qcmp changelog <key> --limit 5  # tail CHANGELOG.md sections
```

`qcmp` walks up from `cwd` to find `qcmp.yaml`, so subcommands work
from anywhere in your repo. Override with `--config <path>`.

## Install

```bash
git clone https://github.com/quazardous/qcmp.git
cd qcmp
./install.sh              # rsync into ~/.local/lib/qcmp + symlink ~/.local/bin/qcmp
# or
./install.sh --symlink    # dev install: symlink ~/.local/lib/qcmp to this checkout
```

Requires Node ≥ 20.

Make sure `~/.local/bin` is on your `PATH`.

## `qcmp.yaml`

```yaml
project: my-app                   # free-form id, links to your other tooling

components:
  - key: app                      # short id used on the CLI
    name: My App                  # human-friendly name (optional)
    file: package.json            # path relative to qcmp.yaml's dir
    path: version                 # dotted path inside the file
    extractor: json
    main: true                    # marks the "project version" (one max)

  - key: api
    name: API service
    file: api/package.json
    path: version
    extractor: json
    changelog: api/CHANGELOG.md   # optional, enables `qcmp changelog api`

  - key: vendor-lib
    file: vendor/lib.php
    path: "Version:\\s*([\\d.]+)"  # the first capture group is the version
    extractor: regex

  - key: release
    extractor: git                 # `git describe --tags --abbrev=0` (fallback glob: `path:` or `v*`)
```

## Extractors

| Extractor | Reads from | `path:` means |
| --- | --- | --- |
| `json`  | `file:` (JSON) | dotted key (e.g. `version`, `dependencies.react`) |
| `text`  | `file:` (plain text) | ignored — the whole trimmed file is the version |
| `regex` | `file:` (any text) | a regex, the **first capture group** is the version |
| `git`   | the repo containing `qcmp.yaml` | fallback tag glob, default `v*` (ignored when `git describe` succeeds) |

## Bumpers

`qcmp bump <key> <patch|minor|major>` increments and writes the new version
back to the source file:

| Extractor | Write strategy |
| --- | --- |
| `json`  | rewrites the dotted key in place, preserves the file's indentation |
| `text`  | overwrites the file with `<new-version>\n` |
| `regex` | substitutes the first capture group, leaves the rest of the match alone |
| `git`   | **no bumper** — qcmp will refuse and tell you to `git tag v<new>` manually |

Pass `--exact <version>` to set an arbitrary string (pre-release suffixes,
non-semver versions, downgrades, …). Pass `--dry-run` to print without
writing.

## Why not a build/release tool

`qcmp` is intentionally narrow:

- No conventional commits, no auto-bump from history.
- No CHANGELOG generation — it only **tails** an existing CHANGELOG.md.
- No PR creation, no tagging, no publish.
- No multi-bump (`bump-all` ergonomics) — chain shell calls if you need that.

When those features matter, reach for [`release-please`](https://github.com/googleapis/release-please),
[`changesets`](https://github.com/changesets/changesets), or
[`knope`](https://github.com/knope-dev/knope). `qcmp` is the primitive
underneath: a uniform `<key> → version` mapping and a safe in-place bump.

## License

MIT — © David Berlioz.
