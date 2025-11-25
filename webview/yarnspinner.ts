import { NodesUpdatedEvent } from "../src/types/editor";
import { NodeInfo } from "./nodes";

import { Alignment, ViewState } from "./ViewState";
import { NodeView } from "./NodeView";
import { getLinesSVGForNodes } from "./svg";
import { getPositionFromNodeInfo } from "./util";

import { WebViewEvent } from "../src/types/editor";
import { newNodeOffset } from "./constants";

interface VSCode {
    postMessage(message: any): void;
}

export {};

declare global {
    function acquireVsCodeApi(): VSCode;
}

const vscode = acquireVsCodeApi();

let nodesContainer: HTMLElement;
let zoomContainer: HTMLElement;

zoomContainer = document.querySelector(".zoom-container") as HTMLElement;
nodesContainer = document.querySelector(".nodes") as HTMLElement;

let viewState = new ViewState(zoomContainer, nodesContainer);

viewState.onNodeDelete = (name) => {
    var ID = name;
    vscode.postMessage({
        type: "delete",
        id: ID,
    });
};

viewState.onNodeEdit = (name) => {
    var ID = name;
    vscode.postMessage({
        type: "open",
        id: ID,
    });
};

viewState.onNodesMoved = (positions) => {
    vscode.postMessage({
        type: "move",
        positions: positions,
    });
};

viewState.updateNodeHeader = (nodeName, headerName, headerValue) => {
    vscode.postMessage({
        type: "update-header",
        nodeName,
        key: headerName,
        value: headerValue,
    });
};

var buttonsContainer = document.querySelector("#nodes-header");

if (!buttonsContainer) {
    throw new Error("Failed to find buttons container");
}

const alignmentButtonContainer = document.createElement("div");
alignmentButtonContainer.id = "alignment-buttons";
alignmentButtonContainer.style.zIndex = "9999";
document.body.appendChild(alignmentButtonContainer);

type ButtonConfig = {
    id: string;
    title: string;
    icon: string | (() => string);
    onClick: () => void;
    requiresSelection?: boolean;
};

const buttonConfigs: ButtonConfig[] = [
    {
        id: "align-left",
        title: "Align Left",
        icon: require("./images/align-left.svg") as string,
        onClick: () => viewState.alignSelectedNodes(Alignment.Left),
        requiresSelection: true,
    },
    {
        id: "align-right",
        title: "Align Right",
        icon: require("./images/align-right.svg") as string,
        onClick: () => viewState.alignSelectedNodes(Alignment.Right),
        requiresSelection: true,
    },
    {
        id: "align-top",
        title: "Align Top",
        icon: require("./images/align-top.svg") as string,
        onClick: () => viewState.alignSelectedNodes(Alignment.Top),
        requiresSelection: true,
    },
    {
        id: "align-bottom",
        title: "Align Bottom",
        icon: require("./images/align-bottom.svg") as string,
        onClick: () => viewState.alignSelectedNodes(Alignment.Bottom),
        requiresSelection: true,
    },
    {
        id: "auto-layout-vertical",
        title: "Auto Layout Vertically",
        icon: require("./images/auto-layout-vertical.svg") as string,
        onClick: () => {
            void viewState.autoLayout("vertical");
        },
    },
    {
        id: "auto-layout-horizontal",
        title: "Auto Layout Horizontally",
        icon: require("./images/auto-layout-horizontal.svg") as string,
        onClick: () => {
            void viewState.autoLayout("horizontal");
        },
    },
    {
        id: "zoom-in",
        title: "Zoom In",
        icon: require("./images/zoom-in.svg") as string,
        onClick: () => viewState.zoomIn(),
    },
    {
        id: "zoom-out",
        title: "Zoom Out",
        icon: require("./images/zoom-out.svg") as string,
        onClick: () => viewState.zoomOut(),
    },
    {
        id: "zoom-fit",
        title: "Zoom to Fit",
        icon: require("./images/zoom-fit.svg") as string,
        onClick: () => viewState.zoomToFit(),
    },
];

const lockIcons = {
    locked: require("./images/lock.svg") as string,
    unlocked: require("./images/unlock.svg") as string,
};

const fullscreenIcons = {
    enter: require("./images/fullscreen-enter.svg") as string,
    exit: require("./images/fullscreen-exit.svg") as string,
};

buttonConfigs.push({
    id: "toggle-interactive",
    title: "Toggle Interaction",
    icon: () =>
        viewState.isInteractionEnabled ? lockIcons.unlocked : lockIcons.locked,
    onClick: () => {
        viewState.setInteractionEnabled(!viewState.isInteractionEnabled);
        updateDynamicIcons();
    },
});

buttonConfigs.push({
    id: "toggle-fullscreen",
    title: "Toggle Fullscreen",
    icon: () =>
        isFullscreenActive() ? fullscreenIcons.exit : fullscreenIcons.enter,
    onClick: () => {
        toggleFullscreen();
    },
});

const parser = new DOMParser();

const selectionButtons: HTMLElement[] = [];
const dynamicIconButtons: Array<{
    button: HTMLElement;
    iconProvider: () => string;
}> = [];

let hideCommentsInPreview = false;
let hideCommandsInPreview = false;
let renderTextEffectsInPreview = true;
let previewFontSize = 12;
let explicitSpeakerColors: Record<string, string> = {};
let autoSpeakerColors: Record<string, string> = {};
let autoColorEnabled = true;
let lastNodesEvent: NodesUpdatedEvent | null = null;

function applyPreviewFontSize() {
    const clamped = Math.min(Math.max(previewFontSize, 8), 24);
    document.documentElement.style.setProperty(
        "--node-preview-font-size",
        `${clamped}px`,
    );
}

applyPreviewFontSize();
applySpeakerColors("");

function applySpeakerColors(raw: string) {
    explicitSpeakerColors = parseSpeakerColors(raw);
    autoSpeakerColors = {};
}

let pseudoFullscreen = false;

function toggleFullscreen() {
    if (document.fullscreenEnabled) {
        if (!document.fullscreenElement) {
            document.documentElement
                .requestFullscreen?.()
                .then(() => updateDynamicIcons())
                .catch(() => togglePseudoFullscreen());
            return;
        } else {
            document
                .exitFullscreen?.()
                .then(() => updateDynamicIcons())
                .catch(() => togglePseudoFullscreen());
            return;
        }
    }
    togglePseudoFullscreen();
}

function togglePseudoFullscreen() {
    pseudoFullscreen = !pseudoFullscreen;
    document.body.classList.toggle("webview-fullscreen", pseudoFullscreen);
    updateDynamicIcons();
}

function isFullscreenActive(): boolean {
    return Boolean(document.fullscreenElement) || pseudoFullscreen;
}

document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === null && pseudoFullscreen) {
        document.body.classList.remove("webview-fullscreen");
        pseudoFullscreen = false;
    }
    updateDynamicIcons();
});

function ensureAutoSpeakerColor(name: string) {
    const key = name.toLowerCase();
    if (explicitSpeakerColors[key] || autoSpeakerColors[key]) {
        return;
    }
    if (!autoColorEnabled) {
        return;
    }
    const palette = [
        "#ff7043",
        "#29b6f6",
        "#ab47bc",
        "#9ccc65",
        "#ffa726",
        "#ec407a",
        "#26a69a",
        "#7e57c2",
    ];
    const index = Math.abs(hashString(key)) % palette.length;
    autoSpeakerColors[key] = palette[index];
}

function hashString(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

function sanitizeColor(value: string): string | null {
    const cleaned = value.replace(/["']/g, "");
    if (/^#[0-9a-fA-F]{3,8}$/.test(cleaned)) {
        return cleaned;
    }
    if (/^[a-zA-Z]+$/.test(cleaned)) {
        return cleaned;
    }
    if (
        /^(rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)$/.test(cleaned.replace(/\s+/g, ""))
    ) {
        return cleaned;
    }
    return null;
}

function sanitizeSize(value: string): string | null {
    const cleaned = value.replace(/["']/g, "");
    if (/^[0-9]+(\.[0-9]+)?(px|em|rem|%)?$/.test(cleaned)) {
        return cleaned;
    }
    return null;
}

function parseSpeakerColors(raw: string): Record<string, string> {
    if (!raw || raw.trim() === "") {
        return {};
    }
    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
            return {};
        }
        const entries: Record<string, string> = {};
        for (const [name, color] of Object.entries(parsed)) {
            if (typeof color !== "string") {
                continue;
            }
            const sanitized = sanitizeColor(color);
            if (sanitized) {
                entries[name.toLowerCase()] = sanitized;
            }
        }
        return entries;
    } catch {
        return {};
    }
}

function createIconElement(svgContent: string) {
    const element = parser.parseFromString(svgContent, "image/svg+xml")
        .firstElementChild as SVGElement;
    element.style.width = "16px";
    element.style.height = "16px";
    return element;
}

function updateDynamicIcons() {
    for (const dynamicButton of dynamicIconButtons) {
        const newIcon = createIconElement(dynamicButton.iconProvider());
        dynamicButton.button.replaceChildren(newIcon);
    }
}

for (const config of buttonConfigs) {
    const button = document.createElement("vscode-button");
    button.id = `button-${config.id}`;
    button.setAttribute("appearance", "icon");
    button.title = config.title;
    button.ariaLabel = config.title;
    button.addEventListener("click", () => config.onClick());

    const iconString =
        typeof config.icon === "function" ? config.icon() : config.icon;
    const iconElement = createIconElement(iconString);
    button.appendChild(iconElement);
    alignmentButtonContainer.appendChild(button);

    if (typeof config.icon === "function") {
        dynamicIconButtons.push({
            button,
            iconProvider: config.icon,
        });
    }

    if (config.requiresSelection) {
        button.classList.add("disabled");
        button.setAttribute("disabled", "");
        selectionButtons.push(button);
    }
}

viewState.onSelectionChanged = (nodes) => {
    if (nodes.length <= 1) {
        // We can only align nodes if we have more than 1 selected.
        selectionButtons.forEach((b) => {
            b.classList.add("disabled");
            b.setAttribute("disabled", "");
        });
    } else {
        selectionButtons.forEach((b) => {
            b.classList.remove("disabled");
            b.removeAttribute("disabled");
        });
    }
};

// Script run within the webview itself.
(function () {
    // Get a reference to the VS Code webview api.
    // We use this API to post messages back to our extension.

    const addNodeButton = buttonsContainer.querySelector("#add-node");

    if (!addNodeButton) {
        throw new Error("Failed to find Add Node button");
    }

    addNodeButton.addEventListener("click", () => {
        let nodePosition = viewState.getPositionForNewNode();

        vscode.postMessage({
            type: "add",
            position: nodePosition,
        });
    });

    const addStickyNoteButton =
        buttonsContainer.querySelector("#add-stickynote");

    if (addStickyNoteButton) {
        addStickyNoteButton.addEventListener("click", () => {
            let nodePosition = viewState.getPositionForNewNode();
            vscode.postMessage({
                type: "add",
                position: nodePosition,
                headers: { style: "note" },
            });
        });
    }

    window.addEventListener("message", (e: any) => {
        const event = e.data as WebViewEvent;

        if (event.type == "update") {
            lastNodesEvent = event;
            nodesUpdated(event);
        } else if (event.type == "show-node") {
            showNode(event.node);
        } else if (event.type == "set-preview-options") {
            hideCommentsInPreview = event.hideComments;
            hideCommandsInPreview = event.hideCommands;
            renderTextEffectsInPreview = event.renderTextEffects;
            previewFontSize = event.previewFontSize;
            applyPreviewFontSize();
            applySpeakerColors(event.speakerColors);
            autoColorEnabled = event.autoSpeakerColors;
            autoSpeakerColors = {};
            if (lastNodesEvent) {
                nodesUpdated(lastNodesEvent);
            }
        }
    });

    /**
     * @param {NodesUpdatedEvent} data
     */
    function updateDropdownList(data: NodesUpdatedEvent) {
        const dropdown = document.querySelector("#node-jump");

        if (dropdown == null) {
            throw new Error("Failed to find node dropdown");
        }

        const icon = dropdown.querySelector("#icon");

        if (!icon) {
            throw new Error("Failed to find icon");
        }

        let placeholderOption = document.createElement("vscode-option");
        placeholderOption.innerText = "Jump to Node";

        let nodeOptions = data.nodes
            .map((node) => {
                if (!node.uniqueTitle || !node.sourceTitle) {
                    return undefined;
                }
                let option = document.createElement("vscode-option");
                option.nodeValue = node.uniqueTitle;
                option.innerText = node.sourceTitle;
                return option;
            })
            .filter((o) => o !== undefined) as HTMLElement[];

        dropdown.replaceChildren(icon, placeholderOption, ...nodeOptions);
    }

    const dropdown = document.querySelector("#node-jump") as HTMLSelectElement;

    if (!dropdown) {
        throw new Error("Failed to find node list dropdown");
    }

    dropdown.addEventListener("change", (evt) => {
        if (dropdown.selectedIndex > 0) {
            // We selected a node.
            console.log(`Jumping to ${dropdown.value}`);

            showNode(dropdown.value);
        }
        dropdown.selectedIndex = 0;
    });

    function showNode(nodeName: string) {
        const node = viewState.getNodeView(nodeName);
        if (node) {
            viewState.focusOnNode(node);
        }
    }

    /**
     * Called whenever the extension notifies us that the nodes in the
     * document have changed.
     * @param data {NodesUpdatedEvent} Information about the document's
     * nodes.
     */
    function nodesUpdated(data: NodesUpdatedEvent) {
        let nodesWithDefaultPosition = 0;
        const processedNodes = data.nodes.map((nodeInfo) => {
            const copy: NodeInfo = {
                ...nodeInfo,
                headers: nodeInfo.headers.map((h) => ({ ...h })),
                jumps: nodeInfo.jumps.map((j) => ({ ...j })),
                previewText: formatPreviewText(nodeInfo.previewText),
            };

            let position = getPositionFromNodeInfo(copy);

            if (!position) {
                const newPosition = {
                    x: newNodeOffset * nodesWithDefaultPosition,
                    y: newNodeOffset * nodesWithDefaultPosition,
                };
                copy.headers.push({
                    key: "position",
                    value: `${newPosition.x},${newPosition.y}`,
                });
                nodesWithDefaultPosition += 1;
            }

            return copy;
        });

        const processedEvent: NodesUpdatedEvent = {
            ...data,
            nodes: processedNodes,
        };

        viewState.nodes = processedNodes;

        updateDropdownList(processedEvent);
    }

    function formatPreviewText(text: string): string {
        let lines = text.split(/\r?\n/);
        if (hideCommentsInPreview) {
            lines = lines.filter(
                (line) => line.trim().startsWith("//") === false,
            );
        }

        lines = lines.filter((line) => line.trim() !== "===");

        if (hideCommandsInPreview) {
            lines = lines.map((line) =>
                stripBracketCommands(line).replace(/<<[^>]+>>/g, ""),
            );
        }

        if (lines.length === 0) {
            return "";
        }

        const formattedLines = lines.map((line) => {
            const trimmedStart = line.trimStart();
            if (trimmedStart.startsWith("->")) {
                const choiceText = trimmedStart.slice(2).trim();
                const renderedChoice = renderLineContent(choiceText);
                const choiceBody = renderedChoice || "&nbsp;";
                return `<span class="choice-line">${choiceBody}</span>`;
            }

            const rendered = renderDialogueLine(line);
            return rendered === "" ? "&nbsp;" : rendered;
        });

        const rendered = formattedLines.join("<br />");
        return collapseChoiceSpacing(rendered);
    }

    function renderLineContent(line: string): string {
        return convertMarkupToHtml(line);
    }

    function renderDialogueLine(line: string): string {
        const leading = line.match(/^\s*/)?.[0] ?? "";
        const rest = line.slice(leading.length);
        const speakerMatch = rest.match(/^([^:]+):\s*/);

        const leadingHtml = convertWhitespace(leading);

        if (speakerMatch) {
            const speakerName = speakerMatch[1].trim();
            const remainder = rest.slice(speakerMatch[0].length);
            const label = renderSpeakerLabel(speakerName);
            const remainderHtml = renderLineContent(remainder);
            const spacer = remainderHtml.length > 0 ? "&nbsp;" : "";
            return `${leadingHtml}${label}${
                remainderHtml ? `${spacer}${remainderHtml}` : ""
            }`;
        }

        const contentHtml = renderLineContent(rest);
        return `${leadingHtml}${contentHtml}`;
    }

    function escapeHtml(input: string): string {
        return input
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    type TagRenderer = {
        open: (rawArgs: string) => string | null;
        close: string;
    };

    const formattingTagRenderers: Record<string, TagRenderer> = {
        b: simpleTag("<strong>", "</strong>"),
        strong: simpleTag("<strong>", "</strong>"),
        bold: simpleTag("<strong>", "</strong>"),
        i: simpleTag("<em>", "</em>"),
        em: simpleTag("<em>", "</em>"),
        u: simpleTag('<span style="text-decoration:underline;">', "</span>"),
        underline: simpleTag(
            '<span style="text-decoration:underline;">',
            "</span>",
        ),
        s: simpleTag('<span style="text-decoration:line-through;">', "</span>"),
        strike: simpleTag(
            '<span style="text-decoration:line-through;">',
            "</span>",
        ),
        strikethrough: simpleTag(
            '<span style="text-decoration:line-through;">',
            "</span>",
        ),
        code: simpleTag("<code>", "</code>"),
        sup: simpleTag("<sup>", "</sup>"),
        sub: simpleTag("<sub>", "</sub>"),
        color: {
            open: (rawArgs) => {
                const value = extractAttributeValue(rawArgs);
                if (!value) {
                    return null;
                }
                const sanitized = sanitizeColor(value);
                if (!sanitized) {
                    return null;
                }
                return `<span style="color:${sanitized};">`;
            },
            close: "</span>",
        },
        size: {
            open: (rawArgs) => {
                const value = extractAttributeValue(rawArgs);
                if (!value) {
                    return null;
                }
                const sanitized = sanitizeSize(value);
                if (!sanitized) {
                    return null;
                }
                return `<span style="font-size:${sanitized};">`;
            },
            close: "</span>",
        },
    };

    const effectTagRenderers: Record<string, TagRenderer> = {
        wave: effectTag("wave"),
        bounce: effectTag("bounce"),
        shake: effectTag("shake"),
        rainbow: effectTag("rainbow"),
        glitch: effectTag("glitch"),
    };

    const formattingTags = new Set([
        "b",
        "bold",
        "strong",
        "i",
        "em",
        "italic",
        "u",
        "underline",
        "s",
        "strike",
        "strikethrough",
        "code",
        "sup",
        "sub",
        "color",
        "size",
    ]);

    function convertMarkupToHtml(line: string): string {
        const applyFormatting = renderTextEffectsInPreview;
        const parts: string[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        const regex = createTagPattern();

        while ((match = regex.exec(line)) !== null) {
            if (match.index > lastIndex) {
                parts.push(escapeHtml(line.slice(lastIndex, match.index)));
            }

            const tagName = match[2]?.toLowerCase() ?? "";
            const isClosing = match[1] === "/";
            const rawArgs = match[3] ?? "";
            const rendered = renderTag(
                tagName,
                isClosing,
                rawArgs,
                applyFormatting,
            );

            if (rendered !== null) {
                parts.push(rendered);
            } else {
                parts.push(escapeHtml(match[0]));
            }

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < line.length) {
            parts.push(escapeHtml(line.slice(lastIndex)));
        }

        return parts.join("");
    }

    function createTagPattern(): RegExp {
        return /\[(\/?)([a-zA-Z0-9_-]+)([^\]]*)\]/g;
    }

    function renderTag(
        tagName: string,
        isClosing: boolean,
        rawArgs: string,
        applyFormatting: boolean,
    ): string | null {
        const renderer =
            formattingTagRenderers[tagName] ?? effectTagRenderers[tagName];

        if (!renderer) {
            return null;
        }

        if (isClosing) {
            return renderer.close;
        }

        return applyFormatting ? renderer.open(rawArgs) : null;
    }

    function simpleTag(open: string, close: string): TagRenderer {
        return {
            open: () => open,
            close,
        };
    }

    function effectTag(name: string): TagRenderer {
        return {
            open: () => `<span class="text-effect text-effect-${name}">`,
            close: "</span>",
        };
    }

    function extractAttributeValue(rawArgs: string): string | null {
        if (!rawArgs) {
            return null;
        }
        const trimmed = rawArgs.trim();
        if (!trimmed) {
            return null;
        }
        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex >= 0) {
            return trimmed.slice(equalsIndex + 1).trim();
        }
        return trimmed;
    }

    function stripBracketCommands(line: string): string {
        const regex = createTagPattern();
        return line.replace(regex, (match, slash, name) => {
            const tag = (name as string).toLowerCase();
            if (formattingTags.has(tag)) {
                return match;
            }
            return "";
        });
    }

    function convertWhitespace(input: string): string {
        return input
            .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
            .replace(/ /g, "&nbsp;");
    }

    function renderSpeakerLabel(name: string): string {
        const key = name.toLowerCase();
        ensureAutoSpeakerColor(name);
        const color =
            explicitSpeakerColors[key] ??
            explicitSpeakerColors["*"] ??
            autoSpeakerColors[key] ??
            "";
        const style = color ? ` style="color:${escapeAttribute(color)};"` : "";
        return `<span class="speaker-label"${style}>${escapeHtml(name)}:</span>`;
    }

    function collapseChoiceSpacing(html: string): string {
        return html.replace(/<\/span><br \/>&nbsp;<br \/>/g, "</span><br />");
    }

    function escapeAttribute(value: string): string {
        return value
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }
})();
