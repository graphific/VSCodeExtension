# Graph Preview Formatting Options

The legacy Yarn graph editor now exposes a few configurable preview options so
you can keep nodes readable without having to see every markup token inline.
All settings live under `Settings → Yarn Spinner → Graph` (`yarnspinner.graph.*`).

## 1. `hideComments` (default: `false`)

Removes any preview line that begins with `//`. Example:

```
// narrator notes     → (hidden)
Character: Hello!     → Character: Hello!
```

## 2. `hideCommands` (default: `false`)

Strips non-formatting commands before rendering the preview. Formatting tags
like `[b]`, `[i]`, `[u]`, `[color=#ff0]`, etc. are preserved so they can still
render inline, but behavior-only tags are removed:

- Yarn commands / effects: `[wave]text[/wave]`, `[bounce speed=2]…[/bounce]`
- Dialogue commands: `<<set $foo = 1>>`, `<<jump Node>>`

Example:

```
[wave]hello[/wave] there <<set $foo = 1>>
→ hello there
```

## 3. `renderTextEffects` (default: `true`)

When enabled, the preview renders common Yarn formatting tags with simple HTML
styling (bold, italic, underline, etc.) and applies lightweight placeholders
for animated effects so you still see emphasis without raw markup:

| Tag                                   | Preview Rendering       |
| ------------------------------------- | ----------------------- |
| `[wave]text[/wave]`                   | `~text~` (decorator)    |
| `[bounce]text[/bounce]`               | `^text^` (decorator)    |
| `[shake]text[/shake]`                 | `!text!` (decorator)    |
| `[rainbow]text[/rainbow]`             | `*text*` (decorator)    |
| `[b]text[/b]` / `[strong]`            | **bold**                |
| `[i]text[/i]` / `[em]`                | _italic_                |
| `[u]text[/u]`                         | <u>underline</u>        |
| `[s]text[/s]`                         | ~~strikethrough~~       |
| `[color=#ff00ff]text[/color]`         | colored span            |
| `[size=150%]text[/size]`              | resized span            |
| `[sup]text[/sup]` / `[sub]text[/sub]` | superscript / subscript |

If you turn this setting off, previews show the original `[tag]…[/tag]` text
with no styling.

## 4. `previewFontSize` (default: `12`)

Controls the base font size (in px) for every node’s preview text. Increase this
if you prefer larger text or shrink it to fit more dialogue inside a node. The
value is clamped between 8 and 24 px.

## 5. `speakerColors` (default: _empty_)

Optional JSON map that sets custom colours per speaker label. Example:
`{"Narrator":"#8e8e8e","Maya":"#c2185b","Witness":"dodgerblue","*":"#999999"}`
(`*` acts as a fallback colour). Each line that starts with `Name:` gets its name
rendered with the matching colour and bold weight.

## 6. `autoSpeakerColors` (default: `true`)

If `speakerColors` is blank, the graph will automatically assign consistent
colours to every speaker it sees (one colour per unique name). Disable this if
you prefer completely uncoloured labels unless `speakerColors` is explicitly set.

### Yarn choices

Lines that begin with `->` are rendered as underlined choice rows with the arrow
removed, so multiple options display on separate lines:

```
-> Check phone      →  Check phone   (underlined)
-> Ignore it        →  Ignore it     (underlined)
```

> **Note:** These previews are intentionally simple; they don’t attempt to
> replicate TextMeshPro, Text Animator, or Godot RichText rendering. To see the
> final, engine-specific formatting and animations, preview your dialogue inside
> the game engine.
