#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const agentDir = process.env.PI_AGENT_DIR || resolve(process.env.HOME || "~", ".pi/agent");
const extensionsDir = join(agentDir, "extensions");
const linkPath = join(extensionsDir, "pi-whisper");
const patchScript = join(packageRoot, "scripts", "patch.mjs");

mkdirSync(extensionsDir, { recursive: true });

if (existsSync(linkPath)) {
  const stat = lstatSync(linkPath);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    rmSync(linkPath, { recursive: true, force: true });
  } else {
    console.error(`Refusing to replace non-directory path: ${linkPath}`);
    process.exit(1);
  }
}

cpSync(packageRoot, linkPath, { recursive: true });

const result = spawnSync(process.execPath, [patchScript], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  rmSync(linkPath, { recursive: true, force: true });
  console.error("pi-whisper: install failed during patch step; rolled back extension files");
  process.exit(result.status ?? 1);
}

console.log(`pi-whisper: installed extension at ${linkPath}`);
console.log("pi-whisper: restart pi to finish install.");
