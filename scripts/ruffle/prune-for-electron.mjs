#!/usr/bin/env node
/**
 * Prune the Ruffle self-hosted bundle down to what Electron actually loads.
 *
 *   node scripts/ruffle/prune-for-electron.mjs [--dry-run]
 *
 * Ruffle ships TWO complete wasm builds and picks at runtime:
 *
 *   ruffle.js:  const n = (await Promise.all([He(),Ye(),Ze(),Qe(),Ke()])).every(Boolean)   // wasm ext probes
 *               ... await (n ? r.e(655) : r.e(482))            // chunk
 *               ... const s = n ? new URL(r(797)) : new URL(r(124))   // wasm
 *
 *   n === true  -> chunk 655 + module 797  (the "extensions" build)
 *   n === false -> chunk 482 + module 124  (the "vanilla" MVP fallback)
 *
 * Electron bundles a fixed modern Chromium, which supports every extension Ruffle probes for, so
 * the vanilla build is dead weight that ships in the installer and is never fetched. Verified by
 * resource timing in the preview: only the extensions wasm is ever requested.
 *
 * Source maps are dev-only and are dropped too.
 *
 * Re-run this after any Ruffle upgrade. It re-derives the hashes from ruffle.js rather than
 * hardcoding them, so it keeps working when the filenames change; if it cannot parse the mapping
 * it refuses to delete anything.
 */
import { readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes('--dry-run');
const js = readFileSync(join(here, 'ruffle.js'), 'utf8');

// chunkId -> filename hash, from webpack's  r.u = e => "core.ruffle."+{482:"..",655:".."}[e]+".js"
const chunkMap = {};
const chunkTable = js.match(/"core\.ruffle\."\+\{([^}]+)\}/);
if (chunkTable) {
    for (const [, id, hash] of chunkTable[1].matchAll(/(\d+):"([0-9a-f]+)"/g)) chunkMap[id] = hash;
}

// moduleId -> wasm filename, from  e.exports=a.p+"<hash>.wasm"
const wasmMap = {};
for (const [, id, name] of js.matchAll(/(\d+)\(e,n,a\)\{e\.exports=a\.p\+"([0-9a-f]+\.wasm)"\}/g)) {
    wasmMap[id] = name;
}

// the ternary tells us which chunk/module is the extensions path (kept) vs vanilla (dropped)
const chunkPick = js.match(/n\?r\.e\((\d+)\)[^:]*:r\.e\((\d+)\)/);
const wasmPick = js.match(/n\?new URL\(r\((\d+)\)/);

// A bundle produced by build-lean.sh contains only ONE wasm (BUILD_WASM_MVP is left unset), so the
// dual-build selection logic simply is not present. That is the desired end state, not a parse
// failure — there is nothing left to prune except source maps.
const singleBuild = Object.keys(wasmMap).length === 1 && !chunkPick;

if (!singleBuild && (!chunkPick || !wasmPick || !Object.keys(chunkMap).length || !Object.keys(wasmMap).length)) {
    console.error('Could not parse Ruffle\'s build-selection logic — bundle layout changed.');
    console.error('Refusing to delete anything. Re-read ruffle.js and update this script.');
    process.exit(1);
}

let keep, drop;
if (singleBuild) {
    console.log('  single-wasm bundle (already lean) — only source maps to prune');
    keep = new Set([
        ...Object.values(wasmMap),
        ...Object.values(chunkMap).map((h) => `core.ruffle.${h}.js`),
    ]);
    drop = [];
} else {
    const keepChunk = chunkPick[1], dropChunk = chunkPick[2];
    const keepWasmId = wasmPick[1];
    const keepWasm = wasmMap[keepWasmId];
    const dropWasm = Object.entries(wasmMap).find(([id]) => id !== keepWasmId)?.[1];

    keep = new Set([`core.ruffle.${chunkMap[keepChunk]}.js`, keepWasm]);
    drop = [`core.ruffle.${chunkMap[dropChunk]}.js`, dropWasm].filter(Boolean);
}

// every source map is dev-only
for (const f of readdirSync(here)) if (f.endsWith('.map')) drop.push(f);

console.log(`Ruffle prune (${dryRun ? 'DRY RUN' : 'applying'})`);
console.log(`  keeping  extensions build: ${[...keep].join(', ')}`);

let freed = 0;
for (const f of drop) {
    const p = join(here, f);
    let size;
    try { size = statSync(p).size; } catch { continue; }
    if (keep.has(f)) { console.log(`  SKIP (in use): ${f}`); continue; }
    freed += size;
    console.log(`  ${dryRun ? 'would remove' : 'removing'}: ${f}  (${(size / 1048576).toFixed(2)} MB)`);
    if (!dryRun) unlinkSync(p);
}
console.log(`  ${dryRun ? 'would free' : 'freed'}: ${(freed / 1048576).toFixed(2)} MB`);
