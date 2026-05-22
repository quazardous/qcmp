import { describe, it, expect, afterEach } from "vitest";
import { tailChangelog } from "../src/changelog.js";
import { tmpDir, writeFile, fakeConfig, cleanup } from "./helpers.js";

afterEach(cleanup);

const CHANGELOG = `# Changelog

## [1.2.0] - 2026-05-14
### Added
- newest thing

## 1.1.0 - 2026-05-01
### Fixed
- middle thing

## v1.0.0
- initial
`;

const comp = (changelog = "CHANGELOG.md") => ({ key: "app", extractor: "json" as const, changelog });

describe("tailChangelog", () => {
    it("returns entries most-recent first, capped at limit", () => {
        const root = tmpDir();
        writeFile(root, "CHANGELOG.md", CHANGELOG);
        const cfg = fakeConfig(root, [comp()]);
        const entries = tailChangelog(cfg, cfg.components[0], 2);
        expect(entries).toHaveLength(2);
        expect(entries[0].header).toBe("## [1.2.0] - 2026-05-14");
        expect(entries[1].header).toBe("## 1.1.0 - 2026-05-01");
        expect(entries[0].body).toContain("newest thing");
    });

    it("recognizes [X.Y.Z], bare X.Y.Z and vX header shapes", () => {
        const root = tmpDir();
        writeFile(root, "CHANGELOG.md", CHANGELOG);
        const cfg = fakeConfig(root, [comp()]);
        const entries = tailChangelog(cfg, cfg.components[0], 10);
        expect(entries.map((e) => e.header)).toEqual([
            "## [1.2.0] - 2026-05-14",
            "## 1.1.0 - 2026-05-01",
            "## v1.0.0",
        ]);
    });

    it("returns just the newest entry when limit is 1", () => {
        const root = tmpDir();
        writeFile(root, "CHANGELOG.md", CHANGELOG);
        const cfg = fakeConfig(root, [comp()]);
        const entries = tailChangelog(cfg, cfg.components[0], 1);
        expect(entries).toHaveLength(1);
        expect(entries[0].header).toBe("## [1.2.0] - 2026-05-14");
    });

    it("throws when changelog is not configured", () => {
        const root = tmpDir();
        const cfg = fakeConfig(root, [{ key: "app", extractor: "json" }]);
        expect(() => tailChangelog(cfg, cfg.components[0], 5)).toThrow(/no 'changelog' set/);
    });

    it("throws when the changelog file is missing", () => {
        const root = tmpDir();
        const cfg = fakeConfig(root, [comp("MISSING.md")]);
        expect(() => tailChangelog(cfg, cfg.components[0], 5)).toThrow(/not found/);
    });
});
