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

const parser = new DOMParser();

const selectionButtons: HTMLElement[] = [];
const dynamicIconButtons: Array<{
    button: HTMLElement;
    iconProvider: () => string;
}> = [];

let hideCommentsInPreview = false;
let hideCommandsInPreview = false;
let renderTextEffectsInPreview = true;
let lastNodesEvent: NodesUpdatedEvent | null = null;

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
        let processedText = renderTextEffectsInPreview
            ? applyTextEffects(text)
            : text;
        let lines = processedText.split(/\r?\n/);
        if (hideCommentsInPreview) {
            lines = lines.filter(
                (line) => line.trim().startsWith("//") === false,
            );
        }
        if (hideCommandsInPreview) {
            lines = lines
                .map((line) =>
                    line
                        .replace(/\[[^\]]+\]/g, "")
                        .replace(/<<[^>]+>>/g, "")
                        .replace(/\s+/g, " ")
                        .trim(),
                )
                .filter((line) => line.length > 0);
        }
        return lines.join("\n");
    }

    const textEffectDecorators: Record<
        string,
        { prefix: string; suffix: string }
    > = {
        wave: { prefix: "~", suffix: "~" },
        bounce: { prefix: "^", suffix: "^" },
        shake: { prefix: "!", suffix: "!" },
        rainbow: { prefix: "*", suffix: "*" },
        glitch: { prefix: "#", suffix: "#" },
        bold: { prefix: "**", suffix: "**" },
        italic: { prefix: "_", suffix: "_" },
        underline: { prefix: "__", suffix: "__" },
        color: { prefix: "", suffix: "" },
    };

    function applyTextEffects(input: string): string {
        const regex = /\[(\w+)[^\]]*\]([\s\S]*?)\[\/\1\]/g;
        return input.replace(regex, (_, tag: string, content: string) => {
            const formattedInner = applyTextEffects(content);
            const decorator = textEffectDecorators[tag.toLowerCase()] ?? {
                prefix: "",
                suffix: "",
            };
            return `${decorator.prefix}${formattedInner}${decorator.suffix}`;
        });
    }
})();
