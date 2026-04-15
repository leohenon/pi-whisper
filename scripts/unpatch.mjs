#!/usr/bin/env node
import { existsSync, copyFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const distRoot = process.env.PI_CODING_AGENT_DIST || "/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/dist";

const files = [
  join(distRoot, "core/messages.js"),
  join(distRoot, "core/session-manager.js"),
  join(distRoot, "core/agent-session.js"),
  join(distRoot, "core/extensions/loader.js"),
  join(distRoot, "core/extensions/runner.js"),
  join(distRoot, "modes/interactive/interactive-mode.js"),
  join(distRoot, "modes/interactive/components/user-message.js"),
  join(distRoot, "modes/interactive/components/assistant-message.js"),
];

let restored = 0;
for (const path of files) {
  const backupPath = `${path}.pi-whisper.bak`;
  if (!existsSync(backupPath)) continue;
  copyFileSync(backupPath, path);
  unlinkSync(backupPath);
  restored += 1;
}

if (restored === 0) {
  console.log(`pi-whisper: no backup files found in ${distRoot}`);
  process.exit(0);
}

console.log(`pi-whisper: restored ${restored} file(s) from backup`);
console.log("Restart pi after restoring.");
