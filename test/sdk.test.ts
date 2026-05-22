import { describe, it, expect, afterEach } from "vitest";
import { qcmp, loadConfig, extractVersion } from "../src/index.js";
import { tmpDir, writeFile, cleanup } from "./helpers.js";

afterEach(cleanup);

const YAML = `project: demo
components:
  - key: app
    name: My App
    file: package.json
    path: version
    extractor: json
    main: true
    changelog: CHANGELOG.md
  - key: ver
    file: VERSION
    extractor: text
  - key: broken
    file: missing.json
    path: version
    extractor: json
`;

function project(): string {
    const root = tmpDir();
    writeFile(root, "qcmp.yaml", YAML);
    writeFile(root, "package.json", JSON.stringify({ version: "1.4.2" }));
    writeFile(root, "VERSION", "2.0.0\n");
    writeFile(root, "CHANGELOG.md", "## [1.4.2] - 2026-05-22\n- shipped\n\n## [1.4.1] - 2026-05-01\n- older\n");
    return root;
}

describe("qcmp() factory", () => {
    it("loads config from an explicit path and exposes resolved roots", () => {
        const root = project();
        const c = qcmp({ config: `${root}/qcmp.yaml` });
        expect(c.config.project).toBe("demo");
        expect(c.config.projectRoot).toBe(root);
    });

    it("walks up from cwd when no config path is given", () => {
        const root = project();
        writeFile(root, "deep/nested/.keep", "");
        const c = qcmp({ cwd: `${root}/deep/nested` });
        expect(c.config.projectRoot).toBe(root);
    });

    it("list() returns components in declaration order", () => {
        const c = qcmp({ config: `${project()}/qcmp.yaml` });
        expect(c.list().map((x) => x.key)).toEqual(["app", "ver", "broken"]);
    });

    it("get() returns one component and throws on unknown key", () => {
        const c = qcmp({ config: `${project()}/qcmp.yaml` });
        expect(c.get("app").name).toBe("My App");
        expect(() => c.get("ghost")).toThrow(/no component with key 'ghost'/);
    });

    it("version() extracts one component across extractor kinds", () => {
        const c = qcmp({ config: `${project()}/qcmp.yaml` });
        expect(c.version("app")).toBe("1.4.2");
        expect(c.version("ver")).toBe("2.0.0");
    });

    it("versions() throws when any extractor fails", () => {
        const c = qcmp({ config: `${project()}/qcmp.yaml` });
        expect(() => c.versions()).toThrow();
    });

    it("versionsSafe() collects per-key errors instead of throwing", () => {
        const c = qcmp({ config: `${project()}/qcmp.yaml` });
        const v = c.versionsSafe();
        expect(v.app).toBe("1.4.2");
        expect(v.ver).toBe("2.0.0");
        expect(v.broken).toMatchObject({ error: expect.stringMatching(/missing\.json/) });
    });

    it("changelog() tails entries with a default and explicit limit", () => {
        const c = qcmp({ config: `${project()}/qcmp.yaml` });
        expect(c.changelog("app")).toHaveLength(2);
        expect(c.changelog("app", 1)).toHaveLength(1);
        expect(c.changelog("app", 1)[0].header).toBe("## [1.4.2] - 2026-05-22");
    });
});

describe("low-level re-exports", () => {
    it("loadConfig + extractVersion are reachable from the package entry", () => {
        const cfg = loadConfig(`${project()}/qcmp.yaml`);
        expect(extractVersion(cfg, cfg.components[0])).toBe("1.4.2");
    });
});
