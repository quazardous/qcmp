/**
 * `qcmp` (Quick Components) CLI — inventory + version extractors +
 * bumpers driven by a project-root `qcmp.yaml`.
 *
 *   qcmp list                          one row per component
 *   qcmp version <key>                 print one version
 *   qcmp versions [--pretty]           JSON map { key: version }
 *   qcmp bump <key> <type> [--exact V] in-place bump (major/minor/patch)
 *   qcmp changelog <key> [--limit N]   tail CHANGELOG entries
 *
 * Pass --config <path> to point at an explicit qcmp.yaml; otherwise
 * we walk up from cwd. See README.md.
 */
import { Command } from "commander";
import { loadConfig, findComponent, type ComponentsConfig } from "./parser.js";
import { extractVersion } from "./extractors/index.js";
import { writeVersion } from "./bumpers/index.js";
import { incrementSemver, type BumpType } from "./semver.js";
import { tailChangelog } from "./changelog.js";

interface GlobalOpts {
    config?: string;
}

function loadCfgOrDie(opts: GlobalOpts): ComponentsConfig {
    try {
        return loadConfig(opts.config ?? null);
    } catch (e) {
        process.stderr.write(`qcmp: ${(e as Error).message}\n`);
        process.exit(1);
    }
}

const program = new Command();
program
    .name("qcmp")
    .description("Quick Components — inventory + version extractors + bumpers")
    .option("--config <path>", "Path to qcmp.yaml (default: walk up from cwd)")
    .version("0.3.0");

program
    .command("list")
    .description("List all components (key, name, file, extractor)")
    .action(() => {
        const cfg = loadCfgOrDie(program.opts<GlobalOpts>());
        for (const c of cfg.components) {
            const flag = c.main ? " *" : "  ";
            const name = c.name ?? "";
            const where = c.file ?? `[${c.extractor}]`;
            process.stdout.write(`${flag} ${c.key.padEnd(20)} ${name.padEnd(24)} ${where}\n`);
        }
    });

program
    .command("version <key>")
    .description("Print one component's version")
    .action((key: string) => {
        const cfg = loadCfgOrDie(program.opts<GlobalOpts>());
        try {
            const c = findComponent(cfg, key);
            process.stdout.write(extractVersion(cfg, c) + "\n");
        } catch (e) {
            process.stderr.write(`qcmp: ${(e as Error).message}\n`);
            process.exit(1);
        }
    });

program
    .command("versions")
    .description("Print every component's version as a JSON map")
    .option("--pretty", "Pretty-print the JSON")
    .action((opts: { pretty?: boolean }) => {
        const cfg = loadCfgOrDie(program.opts<GlobalOpts>());
        const out: Record<string, string | { error: string }> = {};
        for (const c of cfg.components) {
            try {
                out[c.key] = extractVersion(cfg, c);
            } catch (e) {
                out[c.key] = { error: (e as Error).message };
            }
        }
        process.stdout.write(JSON.stringify(out, null, opts.pretty ? 2 : 0) + "\n");
    });

program
    .command("bump <key> [type]")
    .description("Bump a component's version (type: major|minor|patch, or omit + use --exact)")
    .option("--exact <version>", "Set an exact version instead of a semver bump")
    .option("--dry-run", "Print what would change without writing")
    .action(
        (key: string, type: string | undefined, opts: { exact?: string; dryRun?: boolean }) => {
            const cfg = loadCfgOrDie(program.opts<GlobalOpts>());
            try {
                const c = findComponent(cfg, key);
                const current = extractVersion(cfg, c);
                let next: string;
                if (opts.exact) {
                    next = opts.exact.trim();
                    if (!next) {
                        process.stderr.write(`qcmp: --exact must be non-empty\n`);
                        process.exit(1);
                    }
                } else {
                    if (!type) {
                        process.stderr.write(
                            `qcmp: bump requires a type (major|minor|patch) or --exact <version>\n`,
                        );
                        process.exit(1);
                    }
                    if (type !== "major" && type !== "minor" && type !== "patch") {
                        process.stderr.write(
                            `qcmp: unknown bump type '${type}' (expected major|minor|patch)\n`,
                        );
                        process.exit(1);
                    }
                    next = incrementSemver(current, type as BumpType);
                }
                if (opts.dryRun) {
                    process.stdout.write(`${key}: ${current} → ${next} (dry-run, no write)\n`);
                    return;
                }
                const r = writeVersion(cfg, c, next);
                process.stdout.write(`${key}: ${r.oldVersion} → ${r.newVersion}  (${r.file})\n`);
            } catch (e) {
                process.stderr.write(`qcmp: ${(e as Error).message}\n`);
                process.exit(1);
            }
        },
    );

program
    .command("changelog <key>")
    .description("Tail a component's CHANGELOG (requires `changelog:` in qcmp.yaml)")
    .option("--limit <n>", "How many entries to return", "5")
    .action((key: string, opts: { limit: string }) => {
        const cfg = loadCfgOrDie(program.opts<GlobalOpts>());
        try {
            const c = findComponent(cfg, key);
            const limit = Number.parseInt(opts.limit, 10);
            if (!Number.isFinite(limit) || limit <= 0) {
                process.stderr.write(`qcmp: --limit must be a positive integer\n`);
                process.exit(1);
            }
            const entries = tailChangelog(cfg, c, limit);
            for (const e of entries) {
                process.stdout.write(`${e.header}\n${e.body}\n\n`);
            }
        } catch (e) {
            process.stderr.write(`qcmp: ${(e as Error).message}\n`);
            process.exit(1);
        }
    });

program.parse(process.argv);
