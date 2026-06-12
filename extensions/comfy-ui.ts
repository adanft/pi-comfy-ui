import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createBackgroundPainter, type ThemeBgToken } from "./ansi.js";
import {
	patchTuiRender,
	refreshActiveTui,
	resolveEditorPaddingX,
} from "./content-padding.js";
import { PanelEditor } from "./editor-input.js";
import {
	configureInteractivePanelPainter,
	paintBorderedPanels,
} from "./interactive-input.js";

const EDITOR_BG_TOKEN: ThemeBgToken = "customMessageBg";
const PANEL_BG_TOKEN: ThemeBgToken = "userMessageBg";

export default function comfyUiExtension(pi: ExtensionAPI) {
	const patchedTui = patchTuiRender(paintBorderedPanels);

	pi.on("session_start", (_event: unknown, ctx: ExtensionContext) => {
		if ("mode" in ctx && ctx.mode !== "tui") return;

		if (!patchedTui) {
			ctx.ui.notify?.(
				"pi-comfy-ui is disabled: unsupported Pi TUI render API.",
				"warning",
			);
			return;
		}

		const editorBg = createBackgroundPainter(ctx.ui.theme, EDITOR_BG_TOKEN);
		configureInteractivePanelPainter(
			createBackgroundPainter(ctx.ui.theme, PANEL_BG_TOKEN),
		);
		const editorPadding = resolveEditorPaddingX(ctx.cwd);
		ctx.ui.setEditorComponent(
			(tui, editorTheme, keybindings) =>
				new PanelEditor(
					tui,
					editorTheme,
					keybindings,
					editorBg,
					editorPadding.value,
					editorPadding.configured,
				),
		);
		refreshActiveTui(ctx);
	});
}
