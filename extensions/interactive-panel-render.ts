import { Container, TUI, type Component } from "@earendil-works/pi-tui";
import {
	patchKnownComponentPrototypes,
	patchMountedComponent,
} from "./component-render-patch.js";
import {
	patchChatPanelMethods,
	patchReloadCommandMethod,
} from "./chat-panel-patches.js";
import { resolvePanelPatchState } from "./panel-render-state.js";
import type { AddChild, PaintLines, ShowOverlay } from "./panel-render-types.js";

export { patchAskUserQuestionCustomUi } from "./ask-user-question-panel.js";

const TUI_ADD_CHILD_PATCH_FLAG = Symbol.for("pi-comfy-ui.tui-add-child-patched");
const OVERLAY_PATCH_FLAG = Symbol.for("pi-comfy-ui.panel-overlay-patched");
const CONTAINER_ADD_CHILD_PATCH_FLAG = Symbol.for(
	"pi-comfy-ui.panel-container-add-child-patched",
);

function patchAddChildMethod(
	record: Record<PropertyKey, unknown>,
	flag: symbol,
	state: ReturnType<typeof resolvePanelPatchState>,
): void {
	if (record[flag]) return;
	if (typeof record.addChild !== "function") return;

	const addChild = record.addChild as AddChild;
	record.addChild = function addChildWithPiComfyPanels(
		this: unknown,
		component: Component,
	): void {
		return addChild.call(
			this,
			patchMountedComponent(component, state, () => new Error().stack),
		);
	};
	record[flag] = true;
}

function patchTuiAddChild(proto: TUI & Record<PropertyKey, unknown>, state: ReturnType<typeof resolvePanelPatchState>): void {
	patchAddChildMethod(proto, TUI_ADD_CHILD_PATCH_FLAG, state);
}

function patchPiTuiContainerAddChild(state: ReturnType<typeof resolvePanelPatchState>): void {
	patchAddChildMethod(
		Container.prototype as unknown as Record<PropertyKey, unknown>,
		CONTAINER_ADD_CHILD_PATCH_FLAG,
		state,
	);
}

function patchOverlayRender(
	protoRecord: Record<PropertyKey, unknown>,
	state: ReturnType<typeof resolvePanelPatchState>,
): boolean {
	if (typeof protoRecord.showOverlay !== "function") return false;
	if (protoRecord[OVERLAY_PATCH_FLAG]) return true;

	const showOverlay = protoRecord.showOverlay as ShowOverlay;
	protoRecord.showOverlay = function showOverlayWithPiComfyPanels(
		this: TUI,
		component: Component,
		options?: unknown,
	): unknown {
		const componentWithChildren = component as Component & { children?: Component[] };
		return showOverlay.call(
			this,
			Array.isArray(componentWithChildren.children)
				? patchMountedComponent(component, state, () => new Error().stack)
				: component,
			options,
		);
	} as ShowOverlay;
	protoRecord[OVERLAY_PATCH_FLAG] = true;
	return true;
}

export function patchPanelRender(paintLines: PaintLines): boolean {
	const proto = TUI.prototype as TUI & Record<PropertyKey, unknown>;
	const protoRecord = proto as Record<PropertyKey, unknown>;
	const state = resolvePanelPatchState(protoRecord);
	state.paintLines = paintLines;

	patchKnownComponentPrototypes(state);
	patchTuiAddChild(proto, state);
	patchPiTuiContainerAddChild(state);
	patchChatPanelMethods(state);
	patchReloadCommandMethod(state);

	return patchOverlayRender(protoRecord, state);
}
