#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const buildDir = join(projectRoot, ".output", "server");
const buildConfig = join(buildDir, "wrangler.json");
const previewConfig = join(buildDir, "wrangler.preview.json");
const port = process.argv[2] ?? "4173";

if (!/^\d{2,5}$/.test(port) || Number(port) > 65535) {
  console.error("Use npm run preview -- <porta> com uma porta válida.");
  process.exit(2);
}

let config;
try {
  config = JSON.parse(readFileSync(buildConfig, "utf8"));
} catch {
  console.error("Build Cloudflare ausente. Execute npm run build antes da prévia.");
  process.exit(1);
}

// Wrangler 4.93.1's local workerd supports dates up to 2026-05-27. The
// generated build may use the current date, which can be newer. This override
// is for local validation only; it never changes the deployment configuration.
const localConfig = {
  ...config,
  compatibility_date: "2026-05-27",
  d1_databases: [
    {
      binding: "SITE_EXPRESS_DB",
      database_name: "site-express-preview",
      database_id: "00000000-0000-4000-8000-000000000001",
    },
  ],
};
writeFileSync(previewConfig, `${JSON.stringify(localConfig, null, 2)}\n`);

const qaRoot = join(tmpdir(), "site-express-preview");
const configHome = join(qaRoot, "config");
const npmCache = join(qaRoot, "npm-cache");
const persistence = join(qaRoot, "state");
for (const path of [configHome, npmCache, persistence]) mkdirSync(path, { recursive: true });

console.log(`Prévia local: http://127.0.0.1:${port}`);
console.log("Banco D1 local de teste; nenhum serviço Cloudflare ou crédito da Lovable é usado.");
const child = spawn(
  "npm",
  [
    "exec",
    "--yes",
    "--ignore-scripts",
    "--package",
    "wrangler@4.93.1",
    "--",
    "wrangler",
    "dev",
    "--config",
    previewConfig,
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    port,
    "--persist-to",
    persistence,
    "--log-level",
    "error",
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      XDG_CONFIG_HOME: configHome,
      npm_config_cache: npmCache,
      CLOUDFLARE_SEND_METRICS: "false",
    },
  },
);

child.on("error", (error) => {
  console.error(`Não foi possível iniciar o Wrangler: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
