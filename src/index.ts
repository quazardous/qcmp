/**
 * qcmp SDK — the programmatic counterpart to the CLI.
 *
 * The CLI (`qcmp version <key>`, `qcmp versions`) is the language-agnostic
 * interface: shell out and read its JSON. This module is for callers
 * already in the Node/TS ecosystem who'd rather skip the subprocess:
 *
 *   import { qcmp } from "@quazardous/qcmp";
 *
 *   const c = qcmp();                 // walks up from cwd to find qcmp.yaml
 *   c.version("app");                 // "1.4.2"
 *   c.versions();                     // { app: "1.4.2", api: "0.9.0" }
 *   c.list();                         // Component[]
 *   c.changelog("app", 3);            // last 3 CHANGELOG entries
 *
 * `qcmp()` is the ergonomic entry point; the low-level functions
 * (`loadConfig`, `extractVersion`, `writeVersion`, the semver helpers)
 * are re-exported below for callers who want full control.
 *
 * Note on distribution: qcmp ships as TypeScript source and runs under
 * tsx (no build step), so `exports` points at the `.ts`. Importing it
 * works from any tsx / ts-node / bundler-based consumer in the
 * quazardous ecosystem. Plain `node` consumers should use the CLI's
 * JSON output instead (see README → "Programmatic access").
 */
import {
    loadConfig,
    findComponent,
    type Component,
    type ComponentsConfig,
    type ExtractorKind,
} from "./parser.js";
import { extractVersion } from "./extractors/index.js";
import { writeVersion, type BumpResult } from "./bumpers/index.js";
import { incrementSemver, parseSemver, type BumpType } from "./semver.js";
import { tailChangelog, type ChangelogEntry } from "./changelog.js";

// Low-level surface — same functions the CLI is built on.
export {
    loadConfig,
    findComponent,
    extractVersion,
    writeVersion,
    incrementSemver,
    parseSemver,
    tailChangelog,
};
export type {
    Component,
    ComponentsConfig,
    ExtractorKind,
    BumpType,
    BumpResult,
    ChangelogEntry,
};

export interface QcmpOptions {
    /** Explicit path to `qcmp.yaml`. Default: walk up from `cwd`. */
    config?: string;
    /** Directory the walk-up starts from. Default: `QCMP_CWD` or `process.cwd()`. */
    cwd?: string;
}

/** A loaded qcmp config with ergonomic accessors. Returned by {@link qcmp}. */
export interface Qcmp {
    /** The loaded config: components + resolved `configPath` / `projectRoot`. */
    readonly config: ComponentsConfig;
    /** Every component, in declaration order. */
    list(): Component[];
    /** Look up one component by key. Throws if the key is unknown. */
    get(key: string): Component;
    /** Extract one component's version. Throws if the key is unknown or unreadable. */
    version(key: string): string;
    /**
     * Extract every component's version as a `{ key: version }` map.
     * Throws on the first extractor failure — use {@link Qcmp.versionsSafe}
     * to collect per-key errors instead.
     */
    versions(): Record<string, string>;
    /**
     * Like {@link Qcmp.versions} but never throws: a failing extractor
     * yields `{ error: string }` for that key. Mirrors the `qcmp versions`
     * CLI command.
     */
    versionsSafe(): Record<string, string | { error: string }>;
    /**
     * Tail a component's changelog (requires `changelog:` in its yaml entry).
     * `limit` defaults to 5.
     */
    changelog(key: string, limit?: number): ChangelogEntry[];
}

/**
 * Load `qcmp.yaml` and return a handle with ergonomic accessors. This is
 * the one-liner entry point most callers want.
 */
export function qcmp(options: QcmpOptions = {}): Qcmp {
    const config = loadConfig(options.config ?? null, options.cwd);
    const get = (key: string): Component => findComponent(config, key);
    return {
        config,
        list: () => config.components,
        get,
        version: (key) => extractVersion(config, get(key)),
        versions: () => {
            const out: Record<string, string> = {};
            for (const c of config.components) {
                out[c.key] = extractVersion(config, c);
            }
            return out;
        },
        versionsSafe: () => {
            const out: Record<string, string | { error: string }> = {};
            for (const c of config.components) {
                try {
                    out[c.key] = extractVersion(config, c);
                } catch (e) {
                    out[c.key] = { error: (e as Error).message };
                }
            }
            return out;
        },
        changelog: (key, limit = 5) => tailChangelog(config, get(key), limit),
    };
}
