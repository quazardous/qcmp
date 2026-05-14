/**
 * Dispatch a `Component` to the right write-back bumper. Inverse of
 * the extractors: given a new version, persist it to the file in
 * whatever shape the extractor produced.
 *
 * `git` extractor has no bumper — semantic-tag releases are out of
 * scope (use `git tag v<new>` yourself). Trying to bump a `git`
 * component throws.
 */
import type { Component, ComponentsConfig } from "../parser.js";
import { bumpJson } from "./json.js";
import { bumpText } from "./text.js";
import { bumpRegex } from "./regex.js";

export interface BumpResult {
    oldVersion: string;
    newVersion: string;
    file: string;
}

export function writeVersion(
    cfg: ComponentsConfig,
    comp: Component,
    newVersion: string,
): BumpResult {
    switch (comp.extractor) {
        case "json":
            return bumpJson(cfg, comp, newVersion);
        case "text":
            return bumpText(cfg, comp, newVersion);
        case "regex":
            return bumpRegex(cfg, comp, newVersion);
        case "git":
            throw new Error(
                `component '${comp.key}': git extractor has no bumper — tag manually (git tag v${newVersion})`,
            );
    }
}
