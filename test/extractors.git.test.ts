import { describe, it, expect, afterEach } from "vitest";
import { extractGit } from "../src/extractors/git.js";
import { gitRepo, commit, git, fakeConfig, cleanup } from "./helpers.js";

afterEach(cleanup);

const comp = (path?: string) => ({ key: "app", extractor: "git" as const, path });

describe("git extractor — primary path (git describe)", () => {
    it("returns the most-recent tag reachable from HEAD, stripping a leading v", () => {
        const dir = gitRepo();
        commit(dir, "first");
        git(dir, "tag", "v0.5.0");
        commit(dir, "second");
        git(dir, "tag", "v0.6.0");
        const cfg = fakeConfig(dir, [comp()]);
        expect(extractGit(cfg, cfg.components[0])).toBe("0.6.0");
    });

    it("ignores path: when describe succeeds (git picks the tag)", () => {
        const dir = gitRepo();
        commit(dir, "first");
        git(dir, "tag", "v1.0.0");
        // path is a glob that wouldn't match v1.0.0, but describe wins so
        // it's never consulted.
        const cfg = fakeConfig(dir, [comp("nomatch-*")]);
        expect(extractGit(cfg, cfg.components[0])).toBe("1.0.0");
    });
});

describe("git extractor — fallback path (tag --list)", () => {
    it("picks the highest tag by a semver-ish compare, not lexicographic", () => {
        const dir = gitRepo();
        commit(dir, "main-base");
        // Put the tags on a branch NOT reachable from HEAD so `git
        // describe` fails and we drop into the glob fallback.
        git(dir, "checkout", "-b", "feature");
        commit(dir, "feature-work");
        git(dir, "tag", "v1.2.0");
        git(dir, "tag", "v1.10.0");
        git(dir, "checkout", "main");
        const cfg = fakeConfig(dir, [comp()]);
        // Naive lexicographic sort would pick v1.2.0 — the semver-ish
        // comparator must pick v1.10.0. This is the bug the docstring warns
        // about.
        expect(extractGit(cfg, cfg.components[0])).toBe("1.10.0");
    });

    it("honors a custom glob via path: in the fallback", () => {
        const dir = gitRepo();
        commit(dir, "main-base");
        git(dir, "checkout", "-b", "feature");
        commit(dir, "feature-work");
        git(dir, "tag", "stable-1.0.0");
        git(dir, "tag", "stable-2.0.0");
        git(dir, "tag", "v9.9.9"); // should be ignored — glob is stable-*
        git(dir, "checkout", "main");
        const cfg = fakeConfig(dir, [comp("stable-*")]);
        expect(extractGit(cfg, cfg.components[0])).toBe("stable-2.0.0");
    });

    it("throws when no tags match", () => {
        const dir = gitRepo();
        commit(dir, "only-commit");
        const cfg = fakeConfig(dir, [comp()]);
        expect(() => extractGit(cfg, cfg.components[0])).toThrow(/no tags matching/);
    });
});
