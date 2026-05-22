import { describe, it, expect, afterEach } from "vitest";
import { extractVersion } from "../src/extractors/index.js";
import { tmpDir, writeFile, fakeConfig, cleanup } from "./helpers.js";

afterEach(cleanup);

describe("json extractor", () => {
    it("reads a top-level dotted path", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ version: "1.4.2" }));
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        expect(extractVersion(cfg, cfg.components[0])).toBe("1.4.2");
    });

    it("walks a nested path", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ dependencies: { react: "18.3.1" } }));
        const cfg = fakeConfig(root, [{ key: "react", file: "package.json", path: "dependencies.react", extractor: "json" }]);
        expect(extractVersion(cfg, cfg.components[0])).toBe("18.3.1");
    });

    it("throws when the path is not found", () => {
        const root = tmpDir();
        writeFile(root, "package.json", JSON.stringify({ version: "1.0.0" }));
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "nope.deeper", extractor: "json" }]);
        expect(() => extractVersion(cfg, cfg.components[0])).toThrow(/walked past a non-object/);
    });

    it("throws on invalid JSON", () => {
        const root = tmpDir();
        writeFile(root, "package.json", "{ not json");
        const cfg = fakeConfig(root, [{ key: "app", file: "package.json", path: "version", extractor: "json" }]);
        expect(() => extractVersion(cfg, cfg.components[0])).toThrow(/not valid JSON/);
    });

    it("throws when file is missing from the component", () => {
        const root = tmpDir();
        const cfg = fakeConfig(root, [{ key: "app", path: "version", extractor: "json" }]);
        expect(() => extractVersion(cfg, cfg.components[0])).toThrow(/requires 'file'/);
    });
});

describe("text extractor", () => {
    it("returns the trimmed file contents", () => {
        const root = tmpDir();
        writeFile(root, "VERSION", "  2.7.0\n\n");
        const cfg = fakeConfig(root, [{ key: "app", file: "VERSION", extractor: "text" }]);
        expect(extractVersion(cfg, cfg.components[0])).toBe("2.7.0");
    });
});

describe("regex extractor", () => {
    it("returns the first capture group", () => {
        const root = tmpDir();
        writeFile(root, "version.go", 'const Version = "3.14.1"\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "version.go", path: 'Version = "([^"]+)"', extractor: "regex" }]);
        expect(extractVersion(cfg, cfg.components[0])).toBe("3.14.1");
    });

    it("throws when the regex does not match", () => {
        const root = tmpDir();
        writeFile(root, "version.go", "no version here\n");
        const cfg = fakeConfig(root, [{ key: "app", file: "version.go", path: 'Version = "([^"]+)"', extractor: "regex" }]);
        expect(() => extractVersion(cfg, cfg.components[0])).toThrow(/did not match/);
    });

    it("throws when the regex matched but has no capture group", () => {
        const root = tmpDir();
        writeFile(root, "version.go", 'Version = "1.0.0"\n');
        const cfg = fakeConfig(root, [{ key: "app", file: "version.go", path: 'Version = "[^"]+"', extractor: "regex" }]);
        expect(() => extractVersion(cfg, cfg.components[0])).toThrow(/no capture group/);
    });

    it("throws on an invalid regex", () => {
        const root = tmpDir();
        writeFile(root, "version.go", "x\n");
        const cfg = fakeConfig(root, [{ key: "app", file: "version.go", path: "(unterminated", extractor: "regex" }]);
        expect(() => extractVersion(cfg, cfg.components[0])).toThrow(/invalid regex/);
    });
});
