/**
 * Test helpers: build throwaway project trees in os.tmpdir() so the
 * filesystem-touching code (parser walk-up, extractors, bumpers) runs
 * against real files instead of mocks. Each helper returns the temp
 * root; register cleanup with `cleanup()` in an afterEach.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { ComponentsConfig } from "../src/parser.js";

const created: string[] = [];

/** Make an empty temp dir and remember it for cleanup. */
export function tmpDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "qcmp-test-"));
    created.push(dir);
    return dir;
}

/** Remove every temp dir made since the last cleanup. Call in afterEach. */
export function cleanup(): void {
    while (created.length) {
        const dir = created.pop()!;
        rmSync(dir, { recursive: true, force: true });
    }
}

/** Write a file under `root`, creating parent dirs as needed. */
export function writeFile(root: string, rel: string, content: string): string {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf8");
    return full;
}

/**
 * Build a minimal ComponentsConfig pointing at `root` — handy for
 * unit-testing an extractor/bumper without going through qcmp.yaml.
 */
export function fakeConfig(root: string, components: ComponentsConfig["components"]): ComponentsConfig {
    return {
        components,
        configPath: join(root, "qcmp.yaml"),
        projectRoot: root,
    };
}

/** Run a git command in `cwd`, throwing on non-zero exit. */
export function git(cwd: string, ...args: string[]): string {
    const r = spawnSync("git", ["-C", cwd, ...args], {
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_GLOBAL: "", GIT_CONFIG_SYSTEM: "" },
    });
    if (r.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed: ${r.stderr || r.stdout}`);
    }
    return r.stdout;
}

/**
 * Initialise a git repo in a fresh temp dir with deterministic
 * identity + signing off, so commits don't depend on the host config.
 */
export function gitRepo(): string {
    const dir = tmpDir();
    const r = spawnSync("git", ["init", "-b", "main", dir], {
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_GLOBAL: "", GIT_CONFIG_SYSTEM: "" },
    });
    if (r.status !== 0) throw new Error(`git init failed: ${r.stderr}`);
    git(dir, "config", "user.email", "test@qcmp.test");
    git(dir, "config", "user.name", "qcmp test");
    git(dir, "config", "commit.gpgsign", "false");
    git(dir, "config", "tag.gpgsign", "false");
    return dir;
}

/** Create an empty commit with a message. */
export function commit(dir: string, message: string): void {
    git(dir, "commit", "--allow-empty", "-m", message);
}
