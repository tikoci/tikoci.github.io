#!/usr/bin/env bun
/**
 * import-cli.ts — CLI wrapper around the CSV import pipeline.
 *
 * Usage:
 *   bun run import-cli.ts [--root <path>] [--user <name>] [--force]
 *
 * Defaults:
 *   --root   CSV_ROOT env var or <workspace>/.local/sqlkb/mtforum
 *   --user   CSV_USER env var or "amm0"
 */

import { initDb } from "./db.ts";
import { runImport } from "./importer.ts";
import path from "path";

initDb();

const args = process.argv.slice(2);
function getArg(flag: string) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
}

const workspaceRoot = path.resolve(import.meta.dirname, "..", "..");
const csvRoot = getArg("--root") || process.env.CSV_ROOT?.trim()
  || path.join(workspaceRoot, ".local", "sqlkb", "mtforum");
const userName = getArg("--user") || process.env.CSV_USER?.trim() || "amm0";
const force = args.includes("--force");

console.log(`Importing from: ${csvRoot}`);
console.log(`User label:     ${userName}`);
console.log(`Force:          ${force}`);
console.log("");

const result = runImport({ rootPath: csvRoot, userName, force });

console.log(`Scanned:  ${result.filesScanned}`);
console.log(`Imported: ${result.filesImported}`);
console.log(`Skipped:  ${result.filesSkipped}`);
if (result.errors.length) {
  console.error("\nErrors:");
  for (const e of result.errors) console.error(`  ${e}`);
  process.exit(1);
} else {
  console.log("\nDone.");
}
