import { describe, it, expect } from "vitest";
import { parseSemver, incrementSemver } from "../src/semver.js";

describe("parseSemver", () => {
    it("parses a strict x.y.z", () => {
        expect(parseSemver("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    it("tolerates surrounding whitespace", () => {
        expect(parseSemver("  10.0.5\n")).toEqual({ major: 10, minor: 0, patch: 5 });
    });

    it("rejects two-segment versions", () => {
        expect(parseSemver("1.2")).toBeNull();
    });

    it("rejects pre-release / build metadata", () => {
        expect(parseSemver("1.2.3-alpha.1")).toBeNull();
        expect(parseSemver("1.2.3+build")).toBeNull();
    });

    it("rejects a leading v", () => {
        expect(parseSemver("v1.2.3")).toBeNull();
    });
});

describe("incrementSemver", () => {
    it("bumps patch", () => {
        expect(incrementSemver("1.2.3", "patch")).toBe("1.2.4");
    });

    it("bumps minor and zeroes patch", () => {
        expect(incrementSemver("1.2.3", "minor")).toBe("1.3.0");
    });

    it("bumps major and zeroes minor + patch", () => {
        expect(incrementSemver("1.2.3", "major")).toBe("2.0.0");
    });

    it("throws on a non-strict version with a helpful hint", () => {
        expect(() => incrementSemver("1.2.3-rc1", "patch")).toThrow(/--exact/);
    });
});
