#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(here);

const command = (process.argv[2] || "").trim().toLowerCase();

const commands = {
  install: join(scriptsDir, "install.mjs"),
  uninstall: join(scriptsDir, "uninstall.mjs"),
  patch: join(scriptsDir, "patch.mjs"),
  unpatch: join(scriptsDir, "unpatch.mjs"),
};

if (!command || !(command in commands)) {
  console.error("Usage: pi-whisper <install|uninstall|patch|unpatch>");
  process.exit(command ? 1 : 0);
}

const result = spawnSync(process.execPath, [commands[command]], {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
