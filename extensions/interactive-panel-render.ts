import { patchKnownComponentPrototypes } from "./component-render-patch.js";
import {
	patchChatPanelMethods,
	patchReloadCommandMethod,
} from "./chat-panel-patches.js";
import { resolvePanelPatchState } from "./panel-render-state.js";
import type { PaintLines } from "./panel-render-types.js";

export { patchAskUserQuestionCustomUi } from "./ask-user-question-panel.js";

// Pi 0.84 no longer exposes its runtime TUI class to extensions. In particular,
// the package-local pi-tui dependency may be a second module instance, so patching
// its prototype cannot affect Pi's live TUI. Styling therefore stays on public
// component instances/prototypes and the extension-owned InteractiveMode hooks.
const PANEL_PATCH_STATE = Symbol.for("pi-comfy-ui.panel-render-state-owner");
const panelStateOwner: Record<PropertyKey, unknown> = {
	[PANEL_PATCH_STATE]: true,
};

export function patchPanelRender(paintLines: PaintLines): void {
	const state = resolvePanelPatchState(panelStateOwner);
	state.paintLines = paintLines;

	patchKnownComponentPrototypes(state);
	patchChatPanelMethods(state);
	patchReloadCommandMethod(state);
}
