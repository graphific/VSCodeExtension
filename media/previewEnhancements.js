(function () {
    const settings = window.yarnPreviewSettings || {};
    const renderTextEffects =
        settings.renderTextEffects === undefined
            ? true
            : Boolean(settings.renderTextEffects);
    const autoSpeakerColorsEnabled =
        settings.autoSpeakerColors === undefined
            ? true
            : Boolean(settings.autoSpeakerColors);
    const explicitSpeakerColors = parseSpeakerColors(
        typeof settings.speakerColors === "string"
            ? settings.speakerColors
            : "",
    );
    const autoSpeakerColors = {};
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

    const effectTagRenderers = {
        wave: effectTag("wave"),
        bounce: effectTag("bounce"),
        shake: effectTag("shake"),
        rainbow: effectTag("rainbow"),
        glitch: effectTag("glitch"),
    };

    const formattingTagRenderers = {
        b: simpleTag("<strong>", "</strong>"),
        bold: simpleTag("<strong>", "</strong>"),
        strong: simpleTag("<strong>", "</strong>"),
        i: simpleTag("<em>", "</em>"),
        em: simpleTag("<em>", "</em>"),
        italic: simpleTag("<em>", "</em>"),
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

    window.addEventListener("load", () => {
        const container = document.getElementById("dialogue-contents");
        if (!container) {
            return;
        }
        injectStyles();
        enhanceExisting(container);
        observeContainer(container);
    });

    function enhanceExisting(container) {
        container.querySelectorAll(".list-group-item").forEach((node) => {
            if (node instanceof HTMLElement) {
                enhanceLine(node);
            }
        });
    }

    function observeContainer(container) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement) {
                        enhanceLine(node);
                    }
                });
            }
        });
        observer.observe(container, { childList: true });
    }

    function injectStyles() {
        if (document.getElementById("dialogue-preview-enhancer")) {
            return;
        }
        const style = document.createElement("style");
        style.id = "dialogue-preview-enhancer";
        style.textContent = `
        #dialogue-contents .list-group-item {
            white-space: pre-wrap;
        }
        .preview-choice {
            display: block;
            text-decoration: underline;
            font-weight: 600;
            margin: 2px 0;
        }
        .preview-speaker {
            font-weight: 600;
            margin-right: 4px;
            display: inline-block;
        }
        `;
        document.head.appendChild(style);
    }

    function enhanceLine(element) {
        if (element.dataset.previewEnhanced === "true") {
            return;
        }
        element.dataset.previewEnhanced = "true";
        element.classList.add("preview-line");
        const html = renderDialogueLine(element.textContent || "");
        element.innerHTML = html || "&nbsp;";
    }

    function renderDialogueLine(line) {
        if (!line) {
            return "&nbsp;";
        }
        const leadingMatch = line.match(/^\s*/);
        const leading = leadingMatch ? leadingMatch[0] : "";
        const trimmedStart = line.slice(leading.length);

        if (!trimmedStart) {
            return convertWhitespace(leading);
        }

        if (trimmedStart.startsWith("->")) {
            const choiceText = trimmedStart.slice(2).trim();
            const html = renderContent(choiceText);
            return `<span class="preview-choice">${html || "&nbsp;"}</span>`;
        }

        const speakerMatch = trimmedStart.match(/^([^:]+):\s*/);
        if (speakerMatch) {
            const speakerName = speakerMatch[1].trim();
            const remainder = trimmedStart.slice(speakerMatch[0].length);
            const label = renderSpeakerLabel(speakerName);
            const remainderHtml = renderContent(remainder);
            const spacer = remainderHtml ? "&nbsp;" : "";
            return `${convertWhitespace(leading)}${label}${spacer}${remainderHtml}`;
        }

        return `${convertWhitespace(leading)}${renderContent(trimmedStart)}`;
    }

    function renderContent(text) {
        return renderTextEffects ? convertMarkupToHtml(text) : escapeHtml(text);
    }

    function convertMarkupToHtml(line) {
        if (!renderTextEffects) {
            return escapeHtml(line);
        }
        const parts = [];
        let lastIndex = 0;
        const regex = createTagPattern();
        let match = regex.exec(line);
        while (match) {
            if (match.index > lastIndex) {
                parts.push(escapeHtml(line.slice(lastIndex, match.index)));
            }
            const tagName = (match[2] || "").toLowerCase();
            const isClosing = match[1] === "/";
            const rawArgs = match[3] || "";
            const rendered = renderTag(tagName, isClosing, rawArgs);
            if (rendered !== null) {
                parts.push(rendered);
            } else {
                parts.push(escapeHtml(match[0]));
            }
            lastIndex = match.index + match[0].length;
            match = regex.exec(line);
        }
        if (lastIndex < line.length) {
            parts.push(escapeHtml(line.slice(lastIndex)));
        }
        return parts.join("");
    }

    function createTagPattern() {
        return /\[(\/?)([a-zA-Z0-9_-]+)([^\]]*)\]/g;
    }

    function renderTag(tagName, isClosing, rawArgs) {
        const renderer =
            formattingTagRenderers[tagName] ?? effectTagRenderers[tagName];
        if (!renderer) {
            return null;
        }
        if (isClosing) {
            return renderer.close;
        }
        if (typeof renderer.open === "function") {
            return renderer.open(rawArgs);
        }
        return null;
    }

    function simpleTag(open, close) {
        return {
            open: () => open,
            close,
        };
    }

    function effectTag(name) {
        return {
            open: () => `<span class="text-effect text-effect-${name}">`,
            close: "</span>",
        };
    }

    function extractAttributeValue(rawArgs) {
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

    function renderSpeakerLabel(name) {
        const key = name.toLowerCase();
        ensureAutoSpeakerColor(name);
        const color =
            explicitSpeakerColors[key] ??
            explicitSpeakerColors["*"] ??
            autoSpeakerColors[key] ??
            "";
        const style = color ? ` style="color:${escapeAttribute(color)};"` : "";
        return `<span class="preview-speaker"${style}>${escapeHtml(name)}:</span>`;
    }

    function ensureAutoSpeakerColor(name) {
        const key = name.toLowerCase();
        if (explicitSpeakerColors[key] || autoSpeakerColors[key]) {
            return;
        }
        if (!autoSpeakerColorsEnabled) {
            return;
        }
        const index = Math.abs(hashString(key)) % palette.length;
        autoSpeakerColors[key] = palette[index];
    }

    function hashString(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    function sanitizeColor(value) {
        const cleaned = value.replace(/["']/g, "");
        if (/^#[0-9a-fA-F]{3,8}$/.test(cleaned)) {
            return cleaned;
        }
        if (/^[a-zA-Z]+$/.test(cleaned)) {
            return cleaned;
        }
        if (
            /^(rgb|rgba|hsl|hsla)\([0-9.,%\s]+\)$/.test(
                cleaned.replace(/\s+/g, ""),
            )
        ) {
            return cleaned;
        }
        return null;
    }

    function sanitizeSize(value) {
        const cleaned = value.replace(/["']/g, "");
        if (/^[0-9]+(\.[0-9]+)?(px|em|rem|%)?$/.test(cleaned)) {
            return cleaned;
        }
        return null;
    }

    function parseSpeakerColors(raw) {
        if (!raw || typeof raw !== "string" || !raw.trim()) {
            return {};
        }
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed !== "object" || parsed === null) {
                return {};
            }
            const entries = {};
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

    function convertWhitespace(input) {
        return input
            .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;")
            .replace(/ /g, "&nbsp;");
    }

    function escapeHtml(value) {
        return value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
})();
