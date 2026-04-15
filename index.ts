/**
 * pi-whisper
 *
 * Usage:
 *   /whisper          — Toggle whisper mode on/off
 *   /whisper hide     — Permanently hide whisper output
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ExtensionUIContext,
  InputEvent,
} from "@mariozechner/pi-coding-agent";

interface WhisperState {
  active: boolean;
  groupIds: string[];
}

const state: WhisperState = {
  active: false,
  groupIds: [],
};

function resetWhisperState(ui: ExtensionUIContext): void {
  state.active = false;
  state.groupIds = [];
  updateUI(ui);
}

export default function whisperExtension(pi: ExtensionAPI): void {
  const hideAllWhisperGroups = () => {
    for (const groupId of state.groupIds) {
      (pi as any).setMessageVisibilityByGroup?.(groupId, true);
    }
  };

  pi.registerCommand("whisper", {
    description: "Toggle whisper mode — messages that don't persist in context",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const subcommand = args.trim().toLowerCase();

      switch (subcommand) {
        case "hide":
          state.active = false;
          hideAllWhisperGroups();
          ctx.ui.notify("Whisper hidden", "info");
          break;

        default:
          state.active = !state.active;
          ctx.ui.notify(state.active ? "Whisper ON" : "Whisper OFF", "info");
          break;
      }

      updateUI(ctx.ui);
    },
    getArgumentCompletions: (prefix: string) => {
      return ["hide"]
        .filter((c) => c.startsWith(prefix))
        .map((c) => ({ label: c, value: c }));
    },
  });

  pi.on("session_start", (_event: { type: "session_start" }, ctx: ExtensionContext) => {
    resetWhisperState(ctx.ui);
  });

  pi.on("session_switch", (_event: { type: "session_switch" }, ctx: ExtensionContext) => {
    resetWhisperState(ctx.ui);
  });

  pi.on("input", (event: InputEvent) => {
    if (!state.active) return { action: "continue" };
    if (event.source !== "interactive") return { action: "continue" };
    if (event.text.startsWith("/") || event.text.startsWith("!"))
      return { action: "continue" };

    const groupId = `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.groupIds.push(groupId);

    pi.sendUserMessage(event.text, {
      meta: {
        ephemeral: true,
        groupId,
        groupKind: "whisper",
        activeInContext: true,
        hiddenInTranscript: false,
      },
    } as any);

    return { action: "handled" };
  });
}

function updateUI(ui: ExtensionUIContext): void {
  if (state.active) {
    const lines = ui.theme?.fg
      ? [ui.theme.fg("muted", "whisper mode — excluded from context")]
      : ["whisper mode — excluded from context"];
    ui.setWidget("whisper-mode", lines, { placement: "aboveEditor" });
    const label = ui.theme?.fg ? ui.theme.fg("muted", "whisper") : "whisper";
    ui.setStatus("whisper-mode", label);
  } else {
    ui.setWidget("whisper-mode", undefined);
    ui.setStatus("whisper-mode", undefined);
  }
}
