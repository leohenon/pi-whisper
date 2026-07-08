#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";

const distRoot = process.env.PI_CODING_AGENT_DIST || "/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/dist";
const testedPiVersion = "0.80.3";

process.on("uncaughtException", (error) => {
  console.error(`pi-whisper: optional core patch failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

const files = {
  agentSession: join(distRoot, "core/agent-session.js"),
  loader: join(distRoot, "core/extensions/loader.js"),
  runner: join(distRoot, "core/extensions/runner.js"),
  interactiveMode: join(distRoot, "modes/interactive/interactive-mode.js"),
  userMessage: join(distRoot, "modes/interactive/components/user-message.js"),
  assistantMessage: join(distRoot, "modes/interactive/components/assistant-message.js"),
};

function ensureFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing file: ${path}\nSet PI_CODING_AGENT_DIST if your pi install lives elsewhere.`);
  }
}

function backup(path) {
  const backupPath = `${path}.pi-whisper.bak`;
  if (!existsSync(backupPath)) {
    copyFileSync(path, backupPath);
  }
}

function replaceOnce(content, oldText, newText, label) {
  if (content.includes(newText)) return content;
  if (!content.includes(oldText)) {
    throw new Error(`Patch target not found for ${label}`);
  }
  return content.replace(oldText, newText);
}

function patchFile(path, edits) {
  ensureFile(path);
  backup(path);
  let content = readFileSync(path, "utf8");
  for (const edit of edits) {
    content = replaceOnce(content, edit.oldText, edit.newText, edit.label);
  }
  writeFileSync(path, content, "utf8");
}

function readInstalledPiVersion() {
  const packageJsonPath = resolve(distRoot, "..", "package.json");
  if (!existsSync(packageJsonPath)) return undefined;
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return typeof packageJson.version === "string" ? packageJson.version : undefined;
  } catch {
    return undefined;
  }
}

const installedPiVersion = readInstalledPiVersion();
if (installedPiVersion && installedPiVersion !== testedPiVersion) {
  console.warn(`pi-whisper: warning: optional core patch tested with pi ${testedPiVersion}, found ${installedPiVersion}`);
  console.warn("pi-whisper: warning: context isolation does not require this patch; transcript hiding/styling may be skipped if pi internals changed");
}

for (const path of Object.values(files)) {
  ensureFile(path);
}

patchFile(files.agentSession, [
  {
    label: "agent-session whisper visibility methods",
    oldText: `    /**\n     * Send a custom message to the session. Creates a CustomMessageEntry.\n`,
    newText: `    setMessageContextActiveByGroup(groupId, activeInContext) {\n        for (const message of this.agent.state.messages) {\n            if (message?.meta?.groupId === groupId) {\n                message.meta = { ...message.meta, activeInContext };\n            }\n        }\n        for (const entry of this.sessionManager.fileEntries ?? []) {\n            if (entry?.type === "message" && entry.message?.meta?.groupId === groupId) {\n                entry.message.meta = { ...entry.message.meta, activeInContext };\n            }\n            if (entry?.type === "custom_message" && entry.meta?.groupId === groupId) {\n                entry.meta = { ...entry.meta, activeInContext };\n            }\n        }\n    }\n    setMessageVisibilityByGroup(groupId, hidden) {\n        for (const message of this.agent.state.messages) {\n            if (message?.meta?.groupId === groupId) {\n                message.meta = { ...message.meta, hiddenInTranscript: hidden };\n                if (message.role === "custom") {\n                    message.display = !hidden;\n                }\n            }\n        }\n        for (const entry of this.sessionManager.fileEntries ?? []) {\n            if (entry?.type === "message" && entry.message?.meta?.groupId === groupId) {\n                entry.message.meta = { ...entry.message.meta, hiddenInTranscript: hidden };\n            }\n            if (entry?.type === "custom_message" && entry.meta?.groupId === groupId) {\n                entry.meta = { ...entry.meta, hiddenInTranscript: hidden };\n                entry.display = !hidden;\n            }\n        }\n        this._emit({ type: "transcript_visibility_changed", groupId, hidden });\n    }\n    /**\n     * Send a custom message to the session. Creates a CustomMessageEntry.\n`,
  },
  {
    label: "agent-session bindCore visibility actions",
    oldText: `            appendEntry: (customType, data) => {\n                this.sessionManager.appendCustomEntry(customType, data);\n            },\n            setSessionName: (name) => {\n`,
    newText: `            appendEntry: (customType, data) => {\n                this.sessionManager.appendCustomEntry(customType, data);\n            },\n            setMessageContextActiveByGroup: (groupId, activeInContext) => {\n                this.setMessageContextActiveByGroup(groupId, activeInContext);\n            },\n            setMessageVisibilityByGroup: (groupId, hidden) => {\n                this.setMessageVisibilityByGroup(groupId, hidden);\n            },\n            setSessionName: (name) => {\n`,
  },
]);

patchFile(files.loader, [
  {
    label: "loader runtime visibility stubs",
    oldText: `        appendEntry: notInitialized,\n        setSessionName: notInitialized,\n`,
    newText: `        appendEntry: notInitialized,\n        setMessageContextActiveByGroup: notInitialized,\n        setMessageVisibilityByGroup: notInitialized,\n        setSessionName: notInitialized,\n`,
  },
  {
    label: "loader api visibility methods",
    oldText: `        appendEntry(customType, data) {\n            runtime.assertActive();\n            runtime.appendEntry(customType, data);\n        },\n        setSessionName(name) {\n`,
    newText: `        appendEntry(customType, data) {\n            runtime.assertActive();\n            runtime.appendEntry(customType, data);\n        },\n        setMessageContextActiveByGroup(groupId, activeInContext) {\n            runtime.assertActive();\n            runtime.setMessageContextActiveByGroup(groupId, activeInContext);\n        },\n        setMessageVisibilityByGroup(groupId, hidden) {\n            runtime.assertActive();\n            runtime.setMessageVisibilityByGroup(groupId, hidden);\n        },\n        setSessionName(name) {\n`,
  },
]);

patchFile(files.runner, [
  {
    label: "runner bindCore visibility actions",
    oldText: `        this.runtime.sendMessage = actions.sendMessage;\n        this.runtime.sendUserMessage = actions.sendUserMessage;\n        this.runtime.appendEntry = actions.appendEntry;\n        this.runtime.setSessionName = actions.setSessionName;\n`,
    newText: `        this.runtime.sendMessage = actions.sendMessage;\n        this.runtime.sendUserMessage = actions.sendUserMessage;\n        this.runtime.appendEntry = actions.appendEntry;\n        this.runtime.setMessageContextActiveByGroup = actions.setMessageContextActiveByGroup;\n        this.runtime.setMessageVisibilityByGroup = actions.setMessageVisibilityByGroup;\n        this.runtime.setSessionName = actions.setSessionName;\n`,
  },
]);

patchFile(files.interactiveMode, [
  {
    label: "interactive-mode transcript visibility event",
    oldText: `        this.footer.invalidate();\n        switch (event.type) {\n`,
    newText: `        this.footer.invalidate();\n        switch (event.type) {\n            case "transcript_visibility_changed":\n                this.rebuildChatFromMessages();\n                this.ui.requestRender();\n                break;\n`,
  },
  {
    label: "interactive-mode skip hidden streaming assistant start",
    oldText: `                else if (event.message.role === "assistant") {\n                    this.streamingComponent = new AssistantMessageComponent(undefined, this.hideThinkingBlock, this.getMarkdownThemeWithSettings(), this.hiddenThinkingLabel, this.outputPad);\n                    this.streamingMessage = event.message;\n                    this.chatContainer.addChild(this.streamingComponent);\n                    this.streamingComponent.updateContent(this.streamingMessage);\n                    this.ui.requestRender();\n                }\n`,
    newText: `                else if (event.message.role === "assistant") {\n                    this.streamingMessage = event.message;\n                    if (event.message?.meta?.hiddenInTranscript) {\n                        this.streamingComponent = undefined;\n                        this.ui.requestRender();\n                    }\n                    else {\n                        this.streamingComponent = new AssistantMessageComponent(undefined, this.hideThinkingBlock, this.getMarkdownThemeWithSettings(), this.hiddenThinkingLabel, this.outputPad);\n                        this.chatContainer.addChild(this.streamingComponent);\n                        this.streamingComponent.updateContent(this.streamingMessage);\n                        this.ui.requestRender();\n                    }\n                }\n`,
  },
  {
    label: "interactive-mode skip hidden streaming assistant updates",
    oldText: `                if (this.streamingComponent && event.message.role === "assistant") {\n                    this.streamingMessage = event.message;\n                    this.streamingComponent.updateContent(this.streamingMessage);\n                    for (const content of this.streamingMessage.content) {\n`,
    newText: `                if (event.message.role === "assistant") {\n                    this.streamingMessage = event.message;\n                    if (event.message?.meta?.hiddenInTranscript) {\n                        this.streamingComponent = undefined;\n                        this.pendingTools.clear();\n                        this.ui.requestRender();\n                        break;\n                    }\n                    if (!this.streamingComponent) break;\n                    this.streamingComponent.updateContent(this.streamingMessage);\n                    for (const content of this.streamingMessage.content) {\n`,
  },
  {
    label: "interactive-mode skip hidden tool execution start",
    oldText: `            case "tool_execution_start": {\n                let component = this.pendingTools.get(event.toolCallId);\n`,
    newText: `            case "tool_execution_start": {\n                if (this.streamingMessage?.meta?.hiddenInTranscript) {\n                    break;\n                }\n                let component = this.pendingTools.get(event.toolCallId);\n`,
  },
  {
    label: "interactive-mode hide transcript entries",
    oldText: `    addMessageToChat(message, options) {\n        switch (message.role) {\n`,
    newText: `    addMessageToChat(message, options) {\n        if (message?.meta?.hiddenInTranscript) {\n            return;\n        }\n        switch (message.role) {\n`,
  },
  {
    label: "interactive-mode skip hidden assistant tool rebuild",
    oldText: `            if (message.role === "assistant") {\n                this.addMessageToChat(message);\n                // Render tool call components\n                for (const content of message.content) {\n`,
    newText: `            if (message.role === "assistant") {\n                this.addMessageToChat(message);\n                if (message?.meta?.hiddenInTranscript) {\n                    continue;\n                }\n                // Render tool call components\n                for (const content of message.content) {\n`,
  },
  {
    label: "interactive-mode whisper user variant",
    oldText: `                    const skillBlock = parseSkillBlock(textContent);\n                    if (skillBlock) {\n`,
    newText: `                    const userVariant = message?.meta?.groupKind === "whisper" ? "whisper" : "default";\n                    const skillBlock = parseSkillBlock(textContent);\n                    if (skillBlock) {\n`,
  },
  {
    label: "interactive-mode whisper skill user variant",
    oldText: `                            const userComponent = new UserMessageComponent(skillBlock.userMessage, this.getMarkdownThemeWithSettings(), this.outputPad);\n`,
    newText: `                            const userComponent = new UserMessageComponent(skillBlock.userMessage, this.getMarkdownThemeWithSettings(), this.outputPad, userVariant);\n`,
  },
  {
    label: "interactive-mode whisper user component variant",
    oldText: `                        const userComponent = new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings(), this.outputPad);\n`,
    newText: `                        const userComponent = new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings(), this.outputPad, userVariant);\n`,
  },
]);

patchFile(files.userMessage, [
  {
    label: "user-message whisper variant field",
    oldText: `    outputPad;\n    constructor(text, markdownTheme = getMarkdownTheme(), outputPad = 1) {\n`,
    newText: `    outputPad;\n    variant;\n    constructor(text, markdownTheme = getMarkdownTheme(), outputPad = 1, variant = "default") {\n`,
  },
  {
    label: "user-message whisper variant assignment",
    oldText: `        this.outputPad = outputPad;\n        this.rebuild();\n`,
    newText: `        this.outputPad = outputPad;\n        this.variant = variant;\n        this.rebuild();\n`,
  },
  {
    label: "user-message whisper variant rendering",
    oldText: `        const contentBox = new Box(this.outputPad, 1, (content) => theme.bg("userMessageBg", content));\n        contentBox.addChild(new Markdown(this.text, 0, 0, this.markdownTheme, {\n            color: (content) => theme.fg("userMessageText", content),\n        }, { preserveOrderedListMarkers: true, preserveBackslashEscapes: true }));\n`,
    newText: `        const isWhisper = this.variant === "whisper";\n        const contentBox = new Box(this.outputPad, 1, (content) => theme.bg("userMessageBg", content));\n        contentBox.addChild(new Markdown(this.text, 0, 0, this.markdownTheme, {\n            color: (content) => isWhisper ? theme.fg("muted", content) : theme.fg("userMessageText", content),\n        }, { preserveOrderedListMarkers: true, preserveBackslashEscapes: true }));\n`,
  },
]);

patchFile(files.assistantMessage, [
  {
    label: "assistant-message whisper flag",
    oldText: `        // Clear content container\n        this.contentContainer.clear();\n        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));\n`,
    newText: `        // Clear content container\n        this.contentContainer.clear();\n        const isWhisper = message?.meta?.groupKind === "whisper";\n        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));\n`,
  },
  {
    label: "assistant-message whisper muted text",
    oldText: `                this.contentContainer.addChild(new Markdown(content.text.trim(), this.outputPad, 0, this.markdownTheme));\n`,
    newText: `                this.contentContainer.addChild(new Markdown(content.text.trim(), this.outputPad, 0, this.markdownTheme, isWhisper ? {\n                    color: (text) => theme.fg("muted", text),\n                } : undefined));\n`,
  },
]);

console.log(`pi-whisper: patched pi core at ${distRoot}`);
console.log("Restart pi after patching.");
