import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { writeVersion } from "../src/bumpers/index.js";
import { extractVersion } from "../src/extractors/index.js";
import { tmpDir, writeFile, fakeConfig, cleanup } from "./helpers.js";

afterEach(cleanup);

describe("json bumper", () => {
    it("rewrites the dotted path and reports old → new", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{\n  "version": "1.2.3"\n}\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        const r = writeVersion(cfg, cfg.components[0], "1.2.4");
        expect(r.oldVersion).toBe("1.2.3");
        expect(r.newVersion).toBe("1.2.4");
        // Round-trips through the extractor.
        expect(extractVersion(cfg, cfg.components[0])).toBe("1.2.4");
    });

    it("preserves 2-space indentation", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{\n  "version": "1.0.0"\n}\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        writeVersion(cfg, cfg.components[0], "2.0.0");
        expect(readFileSync(join(root, "package.json"), "utf8")).toBe('{\n  "version": "2.0.0"\n}\n');
    });

    it("preserves 4-space indentation", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{\n    "version": "1.0.0"\n}\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        writeVersion(cfg, cfg.components[0], "2.0.0");
        expect(readFileSync(join(root, "package.json"), "utf8")).toContain('\n    "version": "2.0.0"');
    });

    it("preserves tab indentation", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{\n\t"version": "1.0.0"\n}\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        writeVersion(cfg, cfg.components[0], "2.0.0");
        expect(readFileSync(join(root, "package.json"), "utf8")).toContain('\n\t"version": "2.0.0"');
    });

    it("omits a trailing newline when the original had none", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{\n  "version": "1.0.0"\n}');
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        writeVersion(cfg, cfg.components[0], "1.0.1");
        expect(readFileSync(join(root, "package.json"), "utf8").endsWith("}")).toBe(true);
    });

    it("bumps a nested path without disturbing siblings", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{\n  "name": "x",\n  "dependencies": {\n    "react": "18.0.0"\n  }\n}\n');
        const cfg = fakeConfig(root, [{ key: "react", file: "package.json", path: "dependencies.react", extractor: "json" }]);
        writeVersion(cfg, cfg.components[0], "18.3.1");
        const data = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
        expect(data.dependencies.react).toBe("18.3.1");
        expect(data.name).toBe("x");
    });

    it("throws when path is missing (bump needs the dotted key)", () => {
        const root = tmpDir();
        writeFile(root, "package.json", '{ "version": "1.0.0" }');
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", extractor: "json" }]);
        expect(() => writeVersion(cfg, cfg.components[0], "1.0.1")).toThrow(/requires 'path'/);
    });
});

describe("text bumper", () => {
    it("overwrites the whole file with a trailing newline", () => {
        const root = tmpDir();
        writeFile(root, "VERSION", "1.0.0\n");
        const cfg = fakeConfig(root, [{ key: "app", file: "VERSION", extractor: "text" }]);
        const r = writeVersion(cfg, cfg.components[0], "1.1.0");
        expect(r.oldVersion).toBe("1.0.0");
        expect(readFileSync(join(root, "VERSION"), "utf8")).toBe("1.1.0\n");
    });
});

describe("regex bumper", () => {
    it("swaps only the first capture group, leaving formatting intact", () => {
        const root = tmpDir();
        writeFile(root, "Cargo.toml", '[package]\nname = "x"\nversion = "0.3.0"\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "Cargo.toml", path: 'version = "([^"]+)"', extractor: "regex" }]);
        const r = writeVersion(cfg, cfg.components[0], "0.4.0");
        expect(r.oldVersion).toBe("0.3.0");
        expect(readFileSync(join(root, "Cargo.toml"), "utf8")).toBe('[package]\nname = "x"\nversion = "0.4.0"\n');
    });

    it("replaces only the first match", () => {
        const root = tmpDir();
        writeFile(root, "f.txt", 'v = "1.0.0"\nv = "1.0.0"\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "f.txt", path: 'v = "([^"]+)"', extractor: "regex" }]);
        writeVersion(cfg, cfg.components[0], "2.0.0");
        expect(readFileSync(join(root, "f.txt"), "utf8")).toBe('v = "2.0.0"\nv = "1.0.0"\n');
    });

    it("handles a new version that contains the old as a substring", () => {
        const root = tmpDir();
        writeFile(root, "f.txt", 'ver=1.2 end\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "f.txt", path: "ver=(1\\.2)", extractor: "regex" }]);
        writeVersion(cfg, cfg.components[0], "1.2.0");
        expect(readFileSync(join(root, "f.txt"), "utf8")).toBe("ver=1.2.0 end\n");
    });

    it("throws when the regex does not match", () => {
        const root = tmpDir();
        writeFile(root, "f.txt", "nothing\n");
        const cfg = fakeConfig(root, [{ key: "app", file: "f.txt", path: 'version = "([^"]+)"', extractor: "regex" }]);
        expect(() => writeVersion(cfg, cfg.components[0], "1.0.0")).toThrow(/did not match/);
    });
});

describe("git has no bumper", () => {
    it("throws with a hint to tag manually", () => {
        const root = tmpDir();
        const cfg = fakeConfig(root, [{ key: "app", extractor: "git" }]);
        expect(() => writeVersion(cfg, cfg.components[0], "1.0.0")).toThrow(/no bumper.*git tag v1\.0\.0/);
    });
});
