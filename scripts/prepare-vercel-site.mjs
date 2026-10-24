#!/usr/bin/env node
/** Stage an HTML export as an isolated Vercel static site. Never deploys or reads credentials. */
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stagingRoot = join(projectRoot, ".vercel-sites");

function fail(message) {
  console.error(`Site Express · Vercel: ${message}`);
  process.exitCode = 1;
}

function siteSlug(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Uso: node scripts/prepare-vercel-site.mjs <site.html> [slug] [--update]");
    return;
  }
  const update = args.includes("--update");
  const positional = args.filter((value) => value !== "--update");
  if (positional.length < 1 || positional.length > 2) {
    fail("Informe o HTML exportado e, opcionalmente, um nome curto para o site.");
    return;
  }
  const source = resolve(positional[0]);
  const slug =
    positional[1] ??
    siteSlug(
      source
        .split(/[\\/]/)
        .at(-1)
        .replace(/\.html?$/i, ""),
    );
  if (
    extname(source).toLowerCase() !== ".html" ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)
  ) {
    fail("Use um arquivo .html e um nome de site com 1 a 63 letras minúsculas, números ou hífens.");
    return;
  }
  let sourceInfo;
  try {
    sourceInfo = await stat(source);
  } catch {
    fail("O HTML exportado não foi encontrado.");
    return;
  }
  if (!sourceInfo.isFile() || sourceInfo.size > 20_000_000) {
    fail("O arquivo precisa ser HTML e ter até 20 MB.");
    return;
  }
  const html = await readFile(source);
  if (!/^\s*<!doctype html\b/i.test(html.toString("utf8", 0, 128))) {
    fail("O arquivo não parece ser o HTML independente exportado pelo editor.");
    return;
  }
  const folder = join(stagingRoot, slug);
  const target = join(folder, "index.html");
  await mkdir(stagingRoot, { recursive: true });
  let existing;
  try {
    const folderInfo = await lstat(folder);
    if (!folderInfo.isDirectory()) throw new Error("O destino já existe e não é uma pasta.");
    const targetInfo = await lstat(target);
    if (!targetInfo.isFile()) throw new Error("O index.html existente não é um arquivo comum.");
    existing = await readFile(target);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      fail(error instanceof Error ? error.message : "Não foi possível conferir o destino.");
      return;
    }
    if (
      await lstat(folder).then(
        () => true,
        () => false,
      )
    ) {
      fail("A pasta do site já existe sem index.html. Confira-a antes de continuar.");
      return;
    }
  }
  const changed = existing && !existing.equals(html);
  if (changed && !update) {
    fail(`O site ${slug} já tem outro HTML. Revise a mudança e repita com --update.`);
    return;
  }
  if (!existing || changed) {
    await mkdir(folder, { recursive: true });
    await writeFile(target, html, { flag: existing ? "w" : "wx" });
  }
  const digest = createHash("sha256").update(html).digest("hex").slice(0, 12);
  console.log(
    `Site Express · Vercel: ${existing && !changed ? "sem alterações" : "preparado"} em ${folder}`,
  );
  console.log(`HTML: ${html.length} bytes · SHA-256 ${digest}`);
  console.log("Nenhuma publicação foi feita. Confira docs/VERCEL_PUBLISH.md para o próximo passo.");
}

await main().catch((error) => fail(error instanceof Error ? error.message : "Erro desconhecido."));
