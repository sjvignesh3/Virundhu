#!/usr/bin/env node
/**
 * Grep-in-CI safety net (paired with the ESLint rule in apps/spa).
 *
 * Fails the build if any file under packages/client/src or apps/spa/src
 * contains a literal `.select('*')` or `.select("*")` — column projection
 * discipline per Plan §Stage 2 §2.6.
 *
 * Exit code:
 *   0 → clean
 *   1 → offenders printed to stderr
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve default roots from the REPO ROOT, not the cwd. npm workspace
// scripts run with cwd = packages/client, which made the previous
// cwd-relative defaults resolve to nonexistent paths — the script scanned
// ZERO files while printing success (2026-08-29 audit finding).
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const roots = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [join(repoRoot, "packages/client/src"), join(repoRoot, "apps/spa/src")];

// Defaults must exist — a typo'd root failing silently is how the gate
// became a no-op. (Explicit CLI args may still point at not-yet-created
// trees, so only the defaults are strict.)
if (!process.argv.slice(2).length) {
  for (const root of roots) {
    if (!existsSync(root)) {
      console.error(`\x1b[31m✖ scan root missing: ${root}\x1b[0m`);
      process.exit(1);
    }
  }
}

const OFFENSE = /\.select\(\s*['"`]\*['"`]/g;
const EXTS = new Set([".ts", ".tsx", ".js", ".mjs"]);
let hits = 0;

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // silently skip missing (apps/spa may not exist yet in Stage 2)
  }
  for (const entry of entries) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!EXTS.has(extname(p))) continue;
    const src = readFileSync(p, "utf8");
    OFFENSE.lastIndex = 0;
    let m;
    while ((m = OFFENSE.exec(src)) !== null) {
      const line = src.slice(0, m.index).split("\n").length;
      console.error(`  \x1b[31m${p}:${line}\x1b[0m  ${m[0]}`);
      hits += 1;
    }
  }
}

for (const root of roots) walk(root);

if (hits > 0) {
  console.error(
    `\n\x1b[31m✖ ${hits} banned \`.select('*')\` occurrence(s).\x1b[0m Import a column list from packages/client/src/columns.ts.\n`,
  );
  process.exit(1);
} else {
  console.log("✓ no `.select('*')` in scanned trees.");
}
