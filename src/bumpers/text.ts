/**
 * Text bumper — overwrite the entire file with the new version + a
 * trailing newline. Use for plain `VERSION` files.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Component, ComponentsConfig } from "../parser.js";
import type { BumpResult } from "./index.js";

export function bumpText(
    cfg: ComponentsConfig,
    comp: Component,
    newVersion: string,
): BumpResult {
    if (!comp.file) {
        throw new Error(`component '${comp.key}': extractor text requires 'file'`);
    }
    const file = resolve(cfg.projectRoot, comp.file);
    const oldVersion = readFileSync(file, "utf8").trim();
    writeFileSync(file, newVersion + "\n", "utf8");
    return { oldVersion, newVersion, file };
}
