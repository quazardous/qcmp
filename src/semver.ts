/**
 * Tiny semver helper — parse + bump major/minor/patch + exact. We
 * stay strict (`x.y.z` only, no pre-release / build metadata) on
 * purpose: qcmp is a primitive over the simple case. If you have
 * `1.2.3-alpha.1` rolling, use `--exact` or stage a regular release
 * first.
 *
 * Ported from rudder's version-manager (sailing), trimmed to the
 * parts we actually use.
 */

export type BumpType = "major" | "minor" | "patch";

export interface SemverParts {
    major: number;
    minor: number;
    patch: number;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(version: string): SemverParts | null {
    const m = SEMVER_RE.exec(version.trim());
    if (!m) return null;
    return {
        major: Number.parseInt(m[1], 10),
        minor: Number.parseInt(m[2], 10),
        patch: Number.parseInt(m[3], 10),
    };
}

export function incrementSemver(version: string, type: BumpType): string {
    const p = parseSemver(version);
    if (!p) {
        throw new Error(
            `cannot bump '${version}' — not a strict x.y.z semver (use --exact to override)`,
        );
    }
    switch (type) {
        case "major":
            return `${p.major + 1}.0.0`;
        case "minor":
            return `${p.major}.${p.minor + 1}.0`;
        case "patch":
            return `${p.major}.${p.minor}.${p.patch + 1}`;
    }
}
