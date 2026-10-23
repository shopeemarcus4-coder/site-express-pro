#!/usr/bin/env node
// Prepare a Cloudflare D1 binding in Nitro's generated Wrangler config.
// This script never logs in, creates a database, or deploys a Worker.
import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";

const buildDir = resolve(
  process.env.SITE_EXPRESS_BUILD_DIR || join(process.cwd(), ".output", "server"),
);
const sourcePath = join(buildDir, "wrangler.json");
const targetPath = join(buildDir, "wrangler.site-express.json");
const databaseId = process.env.SITE_EXPRESS_D1_DATABASE_ID?.trim();
const databaseName = process.env.SITE_EXPRESS_D1_DATABASE_NAME?.trim();

function fail(message) {
  console.error(`Cloudflare deploy prep: ${message}`);
  process.exitCode = 1;
}

if (
  !databaseId ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId)
) {
  fail("set SITE_EXPRESS_D1_DATABASE_ID to the actual UUID shown in your Cloudflare D1 dashboard.");
} else if (!databaseName || !/^[a-zA-Z0-9_-]{1,128}$/.test(databaseName)) {
  fail(
    "set SITE_EXPRESS_D1_DATABASE_NAME to the actual D1 database name (letters, numbers, - or _).",
  );
} else if (
  !existsSync(sourcePath) ||
  !existsSync(join(buildDir, "index.mjs")) ||
  !existsSync(resolve(buildDir, "../public"))
) {
  fail(
    "Cloudflare build is missing. Run npm run build first and check .output/server/wrangler.json.",
  );
} else if (
  lstatSync(sourcePath).isSymbolicLink() ||
  (existsSync(targetPath) && lstatSync(targetPath).isSymbolicLink())
) {
  fail("refusing a symbolic-link Wrangler config path.");
} else {
  try {
    const source = JSON.parse(readFileSync(sourcePath, "utf8"));
    if (
      source.main !== "index.mjs" ||
      source.assets?.binding !== "ASSETS" ||
      source.assets?.directory !== "../public"
    ) {
      throw new Error(
        "expected a Nitro Cloudflare Worker build with its generated ASSETS binding.",
      );
    }
    const existing = Array.isArray(source.d1_databases) ? source.d1_databases : [];
    if (existing.some((item) => item.binding === "SITE_EXPRESS_DB")) {
      throw new Error(
        "the build already defines SITE_EXPRESS_DB; review its binding before preparing another config.",
      );
    }
    const prepared = {
      ...source,
      // Tested with the local Wrangler/workerd runtime; Nitro's build date may be newer.
      compatibility_date: "2026-05-27",
      d1_databases: [
        ...existing,
        { binding: "SITE_EXPRESS_DB", database_name: databaseName, database_id: databaseId },
      ],
    };
    const content = `${JSON.stringify(prepared, null, 2)}\n`;
    if (existsSync(targetPath)) {
      if (readFileSync(targetPath, "utf8") !== content)
        throw new Error(
          "prepared config already exists with different contents; review or remove it before rerunning.",
        );
      console.log(`Cloudflare deploy prep: already prepared at ${targetPath}`);
    } else {
      if (dirname(targetPath) !== buildDir) throw new Error("invalid build directory.");
      writeFileSync(targetPath, content, { flag: "wx", mode: 0o600 });
      console.log(`Cloudflare deploy prep: wrote ${targetPath}`);
    }
    console.log("Binding: SITE_EXPRESS_DB. No deployment performed.");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
