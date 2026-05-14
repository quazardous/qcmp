/**
 * JSON bumper — rewrite the dotted-path value, preserving the file's
 * original indentation when detectable. Original formatting otherwise
 * (key order, comments) follows whatever `JSON.parse`/`JSON.stringify`
 * round-trips: keys stay in object order, no comments, no trailing
 * commas — which is the same shape `JSON.parse` accepts anyway.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Component, ComponentsConfig } from "../parser.js";
import type { BumpResult } from "./index.js";

export function bumpJson(
    cfg: ComponentsConfig,
    comp: Component,
    newVersion: string,
): BumpResult {
    if (!comp.file) {
        throw new Error(`component '${comp.key}': extractor json requires 'file'`);
    }
    if (!comp.path) {
        throw new Error(
            `component '${comp.key}': bump requires 'path' (the dotted key to overwrite)`,
        );
    }
    const file = resolve(cfg.projectRoot, comp.file);
    const raw = readFileSync(file, "utf8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    const segments = comp.path.split(".");
    const lastKey = segments.pop();
    if (!lastKey) {
        throw new Error(`component '${comp.key}': empty path`);
    }
    let cursor: unknown = data;
    for (const s of segments) {
        if (cursor == null || typeof cursor !== "object") {
            throw new Error(`component '${comp.key}': path walked past a non-object at '${s}'`);
        }
        cursor = (cursor as Record<string, unknown>)[s];
    }
    if (cursor == null || typeof cursor !== "object") {
        throw new Error(`component '${comp.key}': parent of '${lastKey}' is not an object`);
    }
    const parent = cursor as Record<string, unknown>;
    const oldVersion = typeof parent[lastKey] === "string" ? (parent[lastKey] as string) : "";
    parent[lastKey] = newVersion;

    // Best-effort indent detection: leading whitespace of the first
    // indented line. Falls back to 2 spaces which is the JS default.
    const indentMatch = /\n([ \t]+)\S/.exec(raw);
    const indent = indentMatch ? indentMatch[1] : "  ";
    const trailingNewline = raw.endsWith("\n") ? "\n" : "";
    writeFileSync(file, JSON.stringify(data, null, indent) + trailingNewline, "utf8");

    return { oldVersion, newVersion, file };
}
