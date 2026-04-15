/**
 * pi-whisper
 *
 * Usage:
 *   /whisper          — Toggle whisper mode on/off
 *   /whisper hide     — Hide whisper output
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
  activeGroupId?: string;
  groupIds: string[];
}

const state: WhisperState = {
  active: false,
  activeGroupId: undefined,
  groupIds: [],
};

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

function resetWhisperState(ui: ExtensionUIContext): void {
  state.active = false;
  state.activeGroupId = undefined;
  state.groupIds = [];
  updateUI(ui);
}

export default function whisperExtension(pi: ExtensionAPI): void {
  const setMessageContextActiveByGroup = (
    groupId: string | undefined,
    activeInContext: boolean,
  ) => {
    if (!groupId) return;
    (pi as any).setMessageContextActiveByGroup?.(groupId, activeInContext);
  };

  const createWhisperGroupId = () =>
    `whisper-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const ensureActiveGroupId = () => {
    if (state.activeGroupId) return state.activeGroupId;
    const groupId = createWhisperGroupId();
    state.activeGroupId = groupId;
    state.groupIds.push(groupId);
    return groupId;
  };

  const stopWhisperMode = () => {
    setMessageContextActiveByGroup(state.activeGroupId, false);
    state.active = false;
    state.activeGroupId = undefined;
  };

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
          stopWhisperMode();
          hideAllWhisperGroups();
          ctx.ui.notify("Whisper hidden", "info");
          break;

        default:
          if (state.active) {
            stopWhisperMode();
            ctx.ui.notify("Whisper OFF", "info");
          } else {
            state.active = true;
            ensureActiveGroupId();
            ctx.ui.notify("Whisper ON", "info");
          }
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

  pi.on("session_before_switch", () => {
    stopWhisperMode();
  });

  pi.on("session_switch", (_event: { type: "session_switch" }, ctx: ExtensionContext) => {
    resetWhisperState(ctx.ui);
  });

  pi.on("session_shutdown", () => {
    stopWhisperMode();
    state.groupIds = [];
  });

  pi.on("input", (event: InputEvent) => {
    if (!state.active) return { action: "continue" };
    if (event.source !== "interactive") return { action: "continue" };
    if (event.text.startsWith("/") || event.text.startsWith("!")) {
      return { action: "continue" };
    }

    const groupId = ensureActiveGroupId();

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
