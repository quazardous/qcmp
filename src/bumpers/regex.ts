/**
 * Regex bumper — find the first match, swap only the first capture
 * group with the new version, write back. Leaves the surrounding
 * text untouched (so a `version = "1.2.3"` line stays formatted
 * identically).
 *
 * Caveat: the capture group is replaced via string substitution on
 * the matched substring — if the new version literally contains the
 * old version as a substring (e.g. 1.2 → 1.2.0), we replace the
 * leftmost occurrence inside the match, which is the right one.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Component, ComponentsConfig } from "../parser.js";
import type { BumpResult } from "./index.js";

export function bumpRegex(
    cfg: ComponentsConfig,
    comp: Component,
    newVersion: string,
): BumpResult {
    if (!comp.file) {
        throw new Error(`component '${comp.key}': extractor regex requires 'file'`);
    }
    if (!comp.path) {
        throw new Error(`component '${comp.key}': extractor regex requires 'path' (the regex)`);
    }
    const file = resolve(cfg.projectRoot, comp.file);
    const content = readFileSync(file, "utf8");
    let re: RegExp;
    try {
        re = new RegExp(comp.path);
    } catch (e) {
        throw new Error(`component '${comp.key}': invalid regex '${comp.path}': ${(e as Error).message}`);
    }
    const m = re.exec(content);
    if (!m) {
        throw new Error(`component '${comp.key}': regex '${comp.path}' did not match in ${file}`);
    }
    if (m[1] === undefined) {
        throw new Error(
            `component '${comp.key}': regex matched but had no capture group — add parentheses around the version`,
        );
    }
    const oldVersion = m[1];
    const updatedMatch = m[0].replace(oldVersion, newVersion);
    const next = content.slice(0, m.index) + updatedMatch + content.slice(m.index + m[0].length);
    writeFileSync(file, next, "utf8");
    return { oldVersion, newVersion, file };
}
