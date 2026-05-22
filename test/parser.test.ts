import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import {
    findConfigUpwards,
    loadConfig,
    findComponent,
} from "../src/parser.js";
import { tmpDir, writeFile, cleanup } from "./helpers.js";

afterEach(cleanup);

const MINIMAL_YAML = `project: demo
components:
  - key: app
    file: package.json
`;

describe("findConfigUpwards (walk-up)", () => {
    it("finds qcmp.yaml in the start dir itself", () => {
        const root = tmpDir();
        const cfg = writeFile(root, "qcmp.yaml", MINIMAL_YAML);
        expect(findConfigUpwards(root)).toBe(cfg);
    });

    it("walks up from a nested subdir to the root config", () => {
        const root = tmpDir();
        const cfg = writeFile(root, "qcmp.yaml", MINIMAL_YAML);
        writeFile(root, "packages/web/src/.keep", "");
        const deep = join(root, "packages", "web", "src");
        // This is the regression covered by fix 45dcfb1: subcommands must
        // work from anywhere in the tree, not just the project root.
        expect(findConfigUpwards(deep)).toBe(cfg);
    });

    it("returns null when no qcmp.yaml exists up to the FS root", () => {
        const root = tmpDir();
        const deep = join(root, "a", "b");
        writeFile(root, "a/b/.keep", "");
        expect(findConfigUpwards(deep)).toBeNull();
    });
});

describe("loadConfig", () => {
    it("loads + parses the config from an explicit path", () => {
        const root = tmpDir();
        const cfg = writeFile(root, "qcmp.yaml", MINIMAL_YAML);
        const loaded = loadConfig(cfg);
        expect(loaded.project).toBe("demo");
        expect(loaded.projectRoot).toBe(root);
        expect(loaded.configPath).toBe(cfg);
        expect(loaded.components).toHaveLength(1);
        expect(loaded.components[0].key).toBe("app");
    });

    it("walks up from cwd when no explicit path is given", () => {
        const root = tmpDir();
        writeFile(root, "qcmp.yaml", MINIMAL_YAML);
        const deep = join(root, "deep", "nested");
        writeFile(root, "deep/nested/.keep", "");
        const loaded = loadConfig(null, deep);
        expect(loaded.projectRoot).toBe(root);
    });

    it("defaults a missing extractor to json", () => {
        const root = tmpDir();
        const cfg = writeFile(root, "qcmp.yaml", MINIMAL_YAML);
        expect(loadConfig(cfg).components[0].extractor).toBe("json");
    });

    it("throws on an unknown extractor", () => {
        const root = tmpDir();
        const cfg = writeFile(
            root,
            "qcmp.yaml",
            "components:\n  - key: app\n    extractor: jons\n",
        );
        expect(() => loadConfig(cfg)).toThrow(/extractor 'jons' unknown/);
    });

    it("throws on duplicate component keys", () => {
        const root = tmpDir();
        const cfg = writeFile(
            root,
            "qcmp.yaml",
            "components:\n  - key: app\n  - key: app\n",
        );
        expect(() => loadConfig(cfg)).toThrow(/duplicate component key 'app'/);
    });

    it("throws when components is not a list", () => {
        const root = tmpDir();
        const cfg = writeFile(root, "qcmp.yaml", "components: nope\n");
        expect(() => loadConfig(cfg)).toThrow(/'components' must be a list/);
    });

    it("throws when a component is missing key", () => {
        const root = tmpDir();
        const cfg = writeFile(root, "qcmp.yaml", "components:\n  - file: x\n");
        expect(() => loadConfig(cfg)).toThrow(/components\[0\].key is required/);
    });

    it("throws a clear error when the file does not exist", () => {
        const root = tmpDir();
        expect(() => loadConfig(join(root, "nope.yaml"))).toThrow(/not found/);
    });

    it("marks main: true components", () => {
        const root = tmpDir();
        const cfg = writeFile(
            root,
            "qcmp.yaml",
            "components:\n  - key: app\n    main: true\n  - key: lib\n",
        );
        const loaded = loadConfig(cfg);
        expect(loaded.components[0].main).toBe(true);
        expect(loaded.components[1].main).toBe(false);
    });
});

describe("findComponent", () => {
    it("returns the matching component", () => {
        const root = tmpDir();
        const cfg = loadConfig(writeFile(root, "qcmp.yaml", MINIMAL_YAML));
        expect(findComponent(cfg, "app").key).toBe("app");
    });

    it("throws and lists known keys when not found", () => {
        const root = tmpDir();
        const cfg = loadConfig(writeFile(root, "qcmp.yaml", MINIMAL_YAML));
        expect(() => findComponent(cfg, "ghost")).toThrow(/no component with key 'ghost'.*app/);
    });
});
