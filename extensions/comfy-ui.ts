import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createBackgroundPainter, type ThemeBgToken } from "./ansi.js";
import { PanelEditor } from "./editor-input.js";
import {
	patchAskUserQuestionCustomUi,
	patchPanelRender,
} from "./interactive-panel-render.js";
import {
	configureInteractivePanelPainter,
	paintBorderedPanels,
} from "./panel-painter.js";

const EDITOR_BG_TOKEN: ThemeBgToken = "customMessageBg";
const PANEL_BG_TOKEN: ThemeBgToken = "userMessageBg";
const COMFY_EDITOR_FACTORY = Symbol.for("pi-comfy-ui.editor-factory");

type EditorFactory = NonNullable<
	ReturnType<ExtensionContext["ui"]["getEditorComponent"]>
>;

function isComfyEditorFactory(factory: EditorFactory): boolean {
	return Boolean(
		(factory as unknown as Record<PropertyKey, unknown>)[COMFY_EDITOR_FACTORY],
	);
}

function markComfyEditorFactory(factory: EditorFactory): EditorFactory {
	(factory as unknown as Record<PropertyKey, unknown>)[COMFY_EDITOR_FACTORY] = true;
	return factory;
}

export default function comfyUiExtension(pi: ExtensionAPI) {
	pi.on("session_start", (_event: unknown, ctx: ExtensionContext) => {
		if ("mode" in ctx && ctx.mode !== "tui") return;

		const patchedPanels = patchPanelRender(paintBorderedPanels);
		patchAskUserQuestionCustomUi(ctx.ui, paintBorderedPanels);
		if (!patchedPanels) {
			ctx.ui.notify?.(
				"pi-comfy-ui interactive panel styling is disabled: unsupported Pi TUI render API.",
				"warning",
			);
		}

		const editorBg = createBackgroundPainter(ctx.ui.theme, EDITOR_BG_TOKEN);
		configureInteractivePanelPainter(
			createBackgroundPainter(ctx.ui.theme, PANEL_BG_TOKEN),
		);
		const previousEditorComponent = ctx.ui.getEditorComponent?.();
		if (
			previousEditorComponent &&
			!isComfyEditorFactory(previousEditorComponent)
		) {
			ctx.ui.notify?.(
				"pi-comfy-ui detected another custom editor extension and will not replace it.",
				"warning",
			);
			return;
		}

		ctx.ui.setEditorComponent(
			markComfyEditorFactory(
				(tui, editorTheme, keybindings) =>
					new PanelEditor(tui, editorTheme, keybindings, editorBg),
			),
		);
	});
}
