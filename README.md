# pi-comfy-ui

Comfortable spacing and panel styling for Pi's interactive TUI.

![pi-comfy-ui preview](assets/preview.png)

## Install

```bash
pi install npm:pi-comfy-ui
```

Project-local install only:

```bash
pi install -l npm:pi-comfy-ui
```

Then restart Pi, or run `/reload` if Pi is already open.

For project-local installs, Pi loads this extension only after the project is approved/trusted. The first trust prompt itself uses Pi's default styling; pi-comfy-ui applies after approval.

## Configure

The package defaults to comfortable internal padding without modifying global settings:

```json
{
  "editorPaddingX": 1,
  "contentPaddingX": 1
}
```

Override either value in Pi settings when you want different spacing:

- Global/user settings: `~/.pi/agent/settings.json`
- Project/local settings: `.pi/settings.json` (overrides global)

- `editorPaddingX` is Pi's native inner input/editor padding. If unset, this package uses `1` internally for its custom editor.
- `contentPaddingX` is this package's outer layout padding for transcript, widgets, footer, input panel alignment, and interactive prompt overlays. If unset, this package uses `1` internally.
- The input/editor background is painted from the active theme token `customMessageBg`.
- Interactive prompt panels, such as settings, model selection, confirms, selects, and structured questions, are painted from the active theme token `userMessageBg`.
- The input/editor keeps Pi's original editor border color, but renders that border on the left and right sides only; Pi's native top/bottom editor border is hidden.
- Interactive prompt panels keep Pi's original border line color, but replace the top/bottom border shape with left/right side rails.

Supported aliases for outer layout padding:

- `contentPaddingX`
- `layoutPaddingX`
- `PI_CONTENT_PADDING_X` environment variable

The extension clamps editor and content padding to safe ranges and reduces content padding automatically on narrow terminals.

## How it works

Pi does not currently expose a public root-layout wrapper hook for extensions. This package uses a narrow monkey patch on root `TUI.render()` to apply outer padding to the rendered frame. It also patches overlay component rendering so interactive prompt overlays stay inside the same `contentPaddingX` boundary.

This keeps the change package-local, avoids editing the globally installed Pi files, and keeps Pi's native `editorPaddingX` responsible for input padding.

The input background uses Pi's theme palette through `customMessageBg`; there is no separate extension color setting. Interactive prompt panel backgrounds use `userMessageBg`. In both cases, pi-comfy-ui preserves the original border color and only changes the border shape plus the painted background.

Because this extension monkey-patches shared TUI rendering, it may conflict with another extension that patches the same render surfaces. The patch is guarded with global `Symbol`s to avoid double-patching itself.

`contentPaddingX` is an outer margin. `editorPaddingX` remains the inner padding inside the input panel.
