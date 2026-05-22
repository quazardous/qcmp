import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { initConfig } from "../src/init.js";
import { loadConfig } from "../src/parser.js";
import { extractVersion } from "../src/extractors/index.js";
import { qcmp } from "../src/index.js";
import { tmpDir, writeFile, cleanup } from "./helpers.js";

afterEach(cleanup);

describe("qcmp init", () => {
    it("scaffolds a qcmp.yaml that loads and resolves the package version", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ name: "my-app", version: "1.4.2" }));
        const r = initConfig({ cwd: root });
        expect(r.configPath).toBe(join(root, "qcmp.yaml"));
        expect(r.project).toBe("my-app");
        expect(r.componentKey).toBe("my-app");
        // The generated config must round-trip through the real loader + extractor.
        const cfg = loadConfig(r.configPath);
        expect(cfg.project).toBe("my-app");
        const main = cfg.components.find((c) => c.main);
        expect(main?.key).toBe("my-app");
        expect(extractVersion(cfg, main!)).toBe("1.4.2");
        // ...and through the SDK.
        expect(qcmp({ config: r.configPath }).version("my-app")).toBe("1.4.2");
    });

    it("unscopes a scoped package name for the component key", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ name: "@quazardous/qcmp", version: "0.3.0" }));
        const r = initConfig({ cwd: root });
        expect(r.componentKey).toBe("qcmp");
        expect(r.project).toBe("qcmp");
        // The written YAML key must be a clean plain scalar (no '@'/'/').
        expect(loadConfig(r.configPath).components[0].key).toBe("qcmp");
    });

    it("falls back to key 'app' when package.json has no name", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ version: "0.0.1" }));
        const r = initConfig({ cwd: root });
        expect(r.componentKey).toBe("app");
        expect(r.project).toBeUndefined();
        const cfg = loadConfig(r.configPath);
        expect(cfg.project).toBeUndefined();
        expect(extractVersion(cfg, cfg.components[0])).toBe("0.0.1");
    });

    it("refuses to overwrite an existing qcmp.yaml without --force", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ name: "x", version: "1.0.0" }));
        writeFile(root, "qcmp.yaml", "project: keep-me\ncomponents: []\n");
        expect(() => initConfig({ cwd: root })).toThrow(/already exists.*--force/);
        // Untouched.
        expect(readFileSync(join(root, "qcmp.yaml"), "utf8")).toContain("keep-me");
    });

    it("overwrites with force: true", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ name: "x", version: "1.0.0" }));
        writeFile(root, "qcmp.yaml", "project: old\ncomponents: []\n");
        initConfig({ cwd: root, force: true });
        expect(readFileSync(join(root, "qcmp.yaml"), "utf8")).not.toContain("old");
        expect(loadConfig(join(root, "qcmp.yaml")).project).toBe("x");
    });

    it("errors clearly when there is no package.json", () => {
        const root = tmpDir();
        expect(() => initConfig({ cwd: root })).toThrow(/no package\.json/);
    });

    it("errors when package.json is invalid JSON", () => {
        const root = tmpDir();
        writeFile(root, "package.json", "{ not json");
        expect(() => initConfig({ cwd: root })).toThrow(/not valid JSON/);
    });

    it("errors when package.json has no version field", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ name: "x" }));
        expect(() => initConfig({ cwd: root })).toThrow(/no string "version" field/);
    });
});
