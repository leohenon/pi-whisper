#!/usr/bin/env node
import { existsSync, lstatSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const agentDir = process.env.PI_AGENT_DIR || resolve(process.env.HOME || "~", ".pi/agent");
const extensionsDir = join(agentDir, "extensions");
const linkPath = join(extensionsDir, "pi-whisper");
const unpatchScript = join(packageRoot, "scripts", "unpatch.mjs");

const result = spawnSync(process.execPath, [unpatchScript], {
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  console.error("pi-whisper: uninstall failed during unpatch step");
  process.exit(result.status ?? 1);
}

if (existsSync(linkPath)) {
  const stat = lstatSync(linkPath);
  if (stat.isSymbolicLink() || stat.isDirectory()) {
    rmSync(linkPath, { recursive: true, force: true });
    console.log(`pi-whisper: removed extension ${linkPath}`);
  } else {
    console.log(`pi-whisper: left non-directory path untouched: ${linkPath}`);
  }
}

console.log("pi-whisper: restart pi to finish uninstall.");
