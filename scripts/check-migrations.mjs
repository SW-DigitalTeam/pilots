#!/usr/bin/env node
/**
 * Migration guard (CI required check).
 *
 * For every table created in supabase/migrations, assert:
 *   1. it has `FORCE ROW LEVEL SECURITY` somewhere in the migrations, and
 *   2. its name appears in supabase/tests/rls_test.sql (a tenancy test exists).
 *
 * This is the mechanical enforcement of the CLAUDE.md rule "every new table has
 * RLS FORCE and a corresponding RLS test". Prose survives two staff changes;
 * this fails the build.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIG_DIR = join(ROOT, "supabase", "migrations");
const RLS_TEST = join(ROOT, "supabase", "tests", "rls_test.sql");

if (!existsSync(MIG_DIR)) {
  console.log("No supabase/migrations yet — nothing to check.");
  process.exit(0);
}

const sql = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(join(MIG_DIR, f), "utf8"))
  .join("\n")
  .toLowerCase();

const rlsTest = existsSync(RLS_TEST) ? readFileSync(RLS_TEST, "utf8").toLowerCase() : "";

// Collect created tables (ignore `auth.` and other schemas).
const tables = [...sql.matchAll(/create table (?:if not exists )?([a-z_][a-z0-9_]*)/g)].map((m) => m[1]);

const failures = [];
for (const t of tables) {
  const forceRe = new RegExp(`alter table\\s+${t}\\s+force\\s+row level security`);
  if (!forceRe.test(sql)) failures.push(`${t}: missing FORCE ROW LEVEL SECURITY`);
  if (!rlsTest.includes(t)) failures.push(`${t}: no reference in supabase/tests/rls_test.sql`);
}

if (failures.length > 0) {
  console.error("Migration check FAILED:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
console.log(`Migration check passed: ${tables.length} tables, all FORCE RLS + tenancy-tested.`);
