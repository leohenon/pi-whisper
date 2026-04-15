#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const distRoot = process.env.PI_CODING_AGENT_DIST || "/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/dist";

const files = {
  messages: join(distRoot, "core/messages.js"),
  sessionManager: join(distRoot, "core/session-manager.js"),
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

for (const path of Object.values(files)) {
  ensureFile(path);
}

patchFile(files.messages, [
  {
    label: "messages.createCustomMessage meta",
    oldText: `export function createCustomMessage(customType, content, display, details, timestamp) {\n    return {\n        role: "custom",\n        customType,\n        content,\n        display,\n        details,\n        timestamp: new Date(timestamp).getTime(),\n    };\n}\n`,
    newText: `export function createCustomMessage(customType, content, display, details, timestamp, meta) {\n    return {\n        role: "custom",\n        customType,\n        content,\n        display,\n        details,\n        meta,\n        timestamp: new Date(timestamp).getTime(),\n    };\n}\n`,
  },
  {
    label: "messages.convertToLlm ephemeral filter",
    oldText: `        switch (m.role) {\n            case "bashExecution":\n`,
    newText: `        const meta = m?.meta;\n        if (meta?.ephemeral && meta.activeInContext === false) {\n            return undefined;\n        }\n        switch (m.role) {\n            case "bashExecution":\n`,
  },
]);

patchFile(files.sessionManager, [
  {
    label: "session-manager buildSessionContext meta",
    oldText: `        else if (entry.type === "custom_message") {\n            messages.push(createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp));\n        }\n`,
    newText: `        else if (entry.type === "custom_message") {\n            messages.push(createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp, entry.meta));\n        }\n`,
  },
  {
    label: "session-manager appendCustomMessageEntry meta",
    oldText: `    appendCustomMessageEntry(customType, content, display, details) {\n        const entry = {\n            type: "custom_message",\n            customType,\n            content,\n            display,\n            details,\n            id: generateId(this.byId),\n            parentId: this.leafId,\n            timestamp: new Date().toISOString(),\n        };\n`,
    newText: `    appendCustomMessageEntry(customType, content, display, details, meta) {\n        const entry = {\n            type: "custom_message",\n            customType,\n            content,\n            display,\n            details,\n            meta,\n            id: generateId(this.byId),\n            parentId: this.leafId,\n            timestamp: new Date().toISOString(),\n        };\n`,
  },
]);

patchFile(files.agentSession, [
  {
    label: "agent-session active ephemeral field",
    oldText: `    _extensionRunner = undefined;\n    _turnIndex = 0;\n    _resourceLoader;\n`,
    newText: `    _extensionRunner = undefined;\n    _turnIndex = 0;\n    _activeEphemeralGroupMeta = undefined;\n    _resourceLoader;\n`,
  },
  {
    label: "agent-session transcript visibility method",
    oldText: `    /**\n     * Send a custom message to the session. Creates a CustomMessageEntry.\n`,
    newText: `    setMessageVisibilityByGroup(groupId, hidden) {\n        for (const message of this.agent.state.messages) {\n            if (message?.meta?.groupId === groupId) {\n                message.meta = { ...message.meta, hiddenInTranscript: hidden };\n                if (message.role === "custom") {\n                    message.display = !hidden;\n                }\n            }\n        }\n        for (const entry of this.sessionManager.fileEntries ?? []) {\n            if (entry?.type === "message" && entry.message?.meta?.groupId === groupId) {\n                entry.message.meta = { ...entry.message.meta, hiddenInTranscript: hidden };\n            }\n            if (entry?.type === "custom_message" && entry.meta?.groupId === groupId) {\n                entry.meta = { ...entry.meta, hiddenInTranscript: hidden };\n                entry.display = !hidden;\n            }\n        }\n        this._emit({ type: "transcript_visibility_changed", groupId, hidden });\n    }\n    /**\n     * Send a custom message to the session. Creates a CustomMessageEntry.\n`,
  },
  {
    label: "agent-session sendCustomMessage meta",
    oldText: `    async sendCustomMessage(message, options) {\n        const appMessage = {\n            role: "custom",\n            customType: message.customType,\n            content: message.content,\n            display: message.display,\n            details: message.details,\n            timestamp: Date.now(),\n        };\n`,
    newText: `    async sendCustomMessage(message, options) {\n        const appMessage = {\n            role: "custom",\n            customType: message.customType,\n            content: message.content,\n            display: message.display,\n            details: message.details,\n            meta: message.meta,\n            timestamp: Date.now(),\n        };\n`,
  },
  {
    label: "agent-session sendCustomMessage persist meta",
    oldText: `            this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details);\n`,
    newText: `            this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details, message.meta);\n`,
  },
  {
    label: "agent-session sendUserMessage meta",
    oldText: `    async sendUserMessage(content, options) {\n        // Normalize content to text string + optional images\n        let text;\n        let images;\n        if (typeof content === "string") {\n            text = content;\n        }\n        else {\n            const textParts = [];\n            images = [];\n            for (const part of content) {\n                if (part.type === "text") {\n                    textParts.push(part.text);\n                }\n                else {\n                    images.push(part);\n                }\n            }\n            text = textParts.join("\\n");\n            if (images.length === 0)\n                images = undefined;\n        }\n        // Use prompt() with expandPromptTemplates: false to skip command handling and template expansion\n        await this.prompt(text, {\n            expandPromptTemplates: false,\n            streamingBehavior: options?.deliverAs,\n            images,\n            source: "extension",\n        });\n    }\n`,
    newText: `    async sendUserMessage(content, options) {\n        let text;\n        let images;\n        let normalizedContent;\n        if (typeof content === "string") {\n            text = content;\n            normalizedContent = [{ type: "text", text }];\n        }\n        else {\n            const textParts = [];\n            images = [];\n            for (const part of content) {\n                if (part.type === "text") {\n                    textParts.push(part.text);\n                }\n                else {\n                    images.push(part);\n                }\n            }\n            text = textParts.join("\\n");\n            if (images.length === 0)\n                images = undefined;\n            normalizedContent = content;\n        }\n        if (options?.meta) {\n            const userMessage = {\n                role: "user",\n                content: normalizedContent,\n                meta: options.meta,\n                timestamp: Date.now(),\n            };\n            if (this.isStreaming) {\n                if (options?.deliverAs === "followUp") {\n                    this.agent.followUp(userMessage);\n                }\n                else {\n                    this.agent.steer(userMessage);\n                }\n                return;\n            }\n            await this.agent.prompt(userMessage);\n            return;\n        }\n        await this.prompt(text, {\n            expandPromptTemplates: false,\n            streamingBehavior: options?.deliverAs,\n            images,\n            source: "extension",\n        });\n    }\n`,
  },
  {
    label: "agent-session process event activate group",
    oldText: `    async _processAgentEvent(event) {\n        // When a user message starts, check if it's from either queue and remove it BEFORE emitting\n`,
    newText: `    async _processAgentEvent(event) {\n        if (event.type === "message_start" && (event.message.role === "custom" || event.message.role === "user") && event.message.meta?.ephemeral && event.message.meta?.groupId) {\n            this._activeEphemeralGroupMeta = { ...event.message.meta, activeInContext: true };\n            event.message.meta = this._activeEphemeralGroupMeta;\n        }\n        if (this._activeEphemeralGroupMeta && (event.type === "message_start" || event.type === "message_end")) {\n            if (event.message.role === "assistant" || event.message.role === "toolResult") {\n                event.message.meta = {\n                    ...this._activeEphemeralGroupMeta,\n                    activeInContext: true,\n                };\n            }\n        }\n        // When a user message starts, check if it's from either queue and remove it BEFORE emitting\n`,
  },
  {
    label: "agent-session persist custom meta",
    oldText: `                this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details);\n`,
    newText: `                this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details, event.message.meta);\n`,
  },
  {
    label: "agent-session deactivate group on agent_end",
    oldText: `        // Check auto-retry and auto-compaction after agent completes\n        if (event.type === "agent_end" && this._lastAssistantMessage) {\n`,
    newText: `        if (event.type === "agent_end" && this._activeEphemeralGroupMeta?.groupId) {\n            const groupId = this._activeEphemeralGroupMeta.groupId;\n            for (const message of this.agent.state.messages) {\n                if (message?.meta?.groupId === groupId) {\n                    message.meta = { ...message.meta, activeInContext: false };\n                }\n            }\n            for (const entry of this.sessionManager.fileEntries ?? []) {\n                if (entry?.type === "message" && entry.message?.meta?.groupId === groupId) {\n                    entry.message.meta = { ...entry.message.meta, activeInContext: false };\n                }\n                if (entry?.type === "custom_message" && entry.meta?.groupId === groupId) {\n                    entry.meta = { ...entry.meta, activeInContext: false };\n                }\n            }\n            this._activeEphemeralGroupMeta = undefined;\n        }\n        // Check auto-retry and auto-compaction after agent completes\n        if (event.type === "agent_end" && this._lastAssistantMessage) {\n`,
  },
  {
    label: "agent-session bindCore visibility action",
    oldText: `            appendEntry: (customType, data) => {\n                this.sessionManager.appendCustomEntry(customType, data);\n            },\n            setSessionName: (name) => {\n`,
    newText: `            appendEntry: (customType, data) => {\n                this.sessionManager.appendCustomEntry(customType, data);\n            },\n            setMessageVisibilityByGroup: (groupId, hidden) => {\n                this.setMessageVisibilityByGroup(groupId, hidden);\n            },\n            setSessionName: (name) => {\n`,
  },
]);

patchFile(files.loader, [
  {
    label: "loader runtime stub",
    oldText: `        appendEntry: notInitialized,\n        setSessionName: notInitialized,\n`,
    newText: `        appendEntry: notInitialized,\n        setMessageVisibilityByGroup: notInitialized,\n        setSessionName: notInitialized,\n`,
  },
  {
    label: "loader api method",
    oldText: `        appendEntry(customType, data) {\n            runtime.appendEntry(customType, data);\n        },\n        setSessionName(name) {\n`,
    newText: `        appendEntry(customType, data) {\n            runtime.appendEntry(customType, data);\n        },\n        setMessageVisibilityByGroup(groupId, hidden) {\n            runtime.setMessageVisibilityByGroup(groupId, hidden);\n        },\n        setSessionName(name) {\n`,
  },
]);

patchFile(files.runner, [
  {
    label: "runner bindCore visibility action",
    oldText: `        this.runtime.sendMessage = actions.sendMessage;\n        this.runtime.sendUserMessage = actions.sendUserMessage;\n        this.runtime.appendEntry = actions.appendEntry;\n        this.runtime.setSessionName = actions.setSessionName;\n`,
    newText: `        this.runtime.sendMessage = actions.sendMessage;\n        this.runtime.sendUserMessage = actions.sendUserMessage;\n        this.runtime.appendEntry = actions.appendEntry;\n        this.runtime.setMessageVisibilityByGroup = actions.setMessageVisibilityByGroup;\n        this.runtime.setSessionName = actions.setSessionName;\n`,
  },
]);

patchFile(files.interactiveMode, [
  {
    label: "interactive-mode transcript visibility event",
    oldText: `        this.footer.invalidate();\n        switch (event.type) {\n`,
    newText: `        this.footer.invalidate();\n        switch (event.type) {\n            case "transcript_visibility_changed":\n                this.rebuildChatFromMessages();\n                this.ui.requestRender();\n                break;\n`,
  },
  {
    label: "interactive-mode hide transcript entries",
    oldText: `    addMessageToChat(message, options) {\n        switch (message.role) {\n`,
    newText: `    addMessageToChat(message, options) {\n        if (message?.meta?.hiddenInTranscript) {\n            return;\n        }\n        switch (message.role) {\n`,
  },
  {
    label: "interactive-mode whisper user variant",
    oldText: `            case "user": {\n                const textContent = this.getUserMessageText(message);\n                if (textContent) {\n                    const skillBlock = parseSkillBlock(textContent);\n                    if (skillBlock) {\n                        // Render skill block (collapsible)\n                        this.chatContainer.addChild(new Spacer(1));\n                        const component = new SkillInvocationMessageComponent(skillBlock, this.getMarkdownThemeWithSettings());\n                        component.setExpanded(this.toolOutputExpanded);\n                        this.chatContainer.addChild(component);\n                        // Render user message separately if present\n                        if (skillBlock.userMessage) {\n                            const userComponent = new UserMessageComponent(skillBlock.userMessage, this.getMarkdownThemeWithSettings());\n                            this.chatContainer.addChild(userComponent);\n                        }\n                    }\n                    else {\n                        const userComponent = new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings());\n                        this.chatContainer.addChild(userComponent);\n                    }\n`,
    newText: `            case "user": {\n                const textContent = this.getUserMessageText(message);\n                if (textContent) {\n                    const userVariant = message?.meta?.groupKind === "whisper" ? "whisper" : "default";\n                    const skillBlock = parseSkillBlock(textContent);\n                    if (skillBlock) {\n                        // Render skill block (collapsible)\n                        this.chatContainer.addChild(new Spacer(1));\n                        const component = new SkillInvocationMessageComponent(skillBlock, this.getMarkdownThemeWithSettings());\n                        component.setExpanded(this.toolOutputExpanded);\n                        this.chatContainer.addChild(component);\n                        // Render user message separately if present\n                        if (skillBlock.userMessage) {\n                            const userComponent = new UserMessageComponent(skillBlock.userMessage, this.getMarkdownThemeWithSettings(), userVariant);\n                            this.chatContainer.addChild(userComponent);\n                        }\n                    }\n                    else {\n                        const userComponent = new UserMessageComponent(textContent, this.getMarkdownThemeWithSettings(), userVariant);\n                        this.chatContainer.addChild(userComponent);\n                    }\n`,
  },
]);

patchFile(files.userMessage, [
  {
    label: "user-message normal prompt rendering",
    oldText: `export class UserMessageComponent extends Container {\n    constructor(text, markdownTheme = getMarkdownTheme()) {\n        super();\n        this.addChild(new Spacer(1));\n        this.addChild(new Markdown(text, 1, 1, markdownTheme, {\n            bgColor: (text) => theme.bg("userMessageBg", text),\n            color: (text) => theme.fg("userMessageText", text),\n        }));\n    }\n`,
    newText: `export class UserMessageComponent extends Container {\n    constructor(text, markdownTheme = getMarkdownTheme(), variant = "default") {\n        super();\n        const isWhisper = variant === "whisper";\n        this.addChild(new Spacer(1));\n        this.addChild(new Markdown(text, 1, 1, markdownTheme, {\n            bgColor: (text) => theme.bg("userMessageBg", text),\n            color: (text) => isWhisper ? theme.fg("muted", text) : theme.fg("userMessageText", text),\n        }));\n    }\n`,
  },
]);

patchFile(files.assistantMessage, [
  {
    label: "assistant-message muted whisper replies",
    oldText: `    updateContent(message) {\n        this.lastMessage = message;\n        // Clear content container\n        this.contentContainer.clear();\n        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));\n        if (hasVisibleContent) {\n            this.contentContainer.addChild(new Spacer(1));\n        }\n`,
    newText: `    updateContent(message) {\n        this.lastMessage = message;\n        // Clear content container\n        this.contentContainer.clear();\n        const isWhisper = message?.meta?.groupKind === "whisper";\n        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));\n        if (hasVisibleContent) {\n            this.contentContainer.addChild(new Spacer(1));\n        }\n`,
  },
  {
    label: "assistant-message muted whisper text",
    oldText: `            if (content.type === "text" && content.text.trim()) {\n                // Assistant text messages with no background - trim the text\n                // Set paddingY=0 to avoid extra spacing before tool executions\n                this.contentContainer.addChild(new Markdown(content.text.trim(), 1, 0, this.markdownTheme));\n            }\n`,
    newText: `            if (content.type === "text" && content.text.trim()) {\n                // Assistant text messages with no background - trim the text\n                // Set paddingY=0 to avoid extra spacing before tool executions\n                this.contentContainer.addChild(new Markdown(content.text.trim(), 1, 0, this.markdownTheme, isWhisper ? {\n                    color: (text) => theme.fg("muted", text),\n                } : undefined));\n            }\n`,
  },
]);

console.log(`pi-whisper: patched pi core at ${distRoot}`);
console.log("Restart pi after patching.");
