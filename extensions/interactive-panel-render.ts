import { TUI, type Component } from "@earendil-works/pi-tui";

type PaintLines = (lines: string[], width: number) => string[];
type ShowOverlay = (component: Component, options?: unknown) => unknown;
type PatchState = { paintLines: PaintLines };

const PATCH_STATE = Symbol.for("pi-comfy-ui.panel-render-state");
const RENDER_PATCH_FLAG = Symbol.for("pi-comfy-ui.panel-render-patched");
const OVERLAY_PATCH_FLAG = Symbol.for("pi-comfy-ui.panel-overlay-patched");
const COMPONENT_RENDER_PATCH_FLAG = Symbol.for(
	"pi-comfy-ui.panel-component-render-patched",
);

function resolvePatchState(record: Record<PropertyKey, unknown>): PatchState {
	const existing = record[PATCH_STATE] as PatchState | undefined;
	if (existing && typeof existing.paintLines === "function") return existing;

	const state: PatchState = { paintLines: (lines) => lines };
	record[PATCH_STATE] = state;
	return state;
}

function paintRenderedLines(
	width: number,
	render: (width: number) => string[],
	paintLines: PaintLines,
): string[] {
	return paintLines(render(width), width);
}

function patchComponentRender(component: Component, state: PatchState): Component {
	const record = component as Component & Record<PropertyKey, unknown>;
	if (record[COMPONENT_RENDER_PATCH_FLAG]) return component;

	const render = component.render.bind(component);
	component.render = (width: number) => paintRenderedLines(width, render, state.paintLines);
	record[COMPONENT_RENDER_PATCH_FLAG] = true;
	return component;
}

export function patchPanelRender(paintLines: PaintLines): boolean {
	const proto = TUI.prototype as TUI & Record<PropertyKey, unknown>;
	const protoRecord = proto as Record<PropertyKey, unknown>;
	const state = resolvePatchState(protoRecord);
	state.paintLines = paintLines;

	if (!protoRecord[RENDER_PATCH_FLAG]) {
		if (typeof proto.render !== "function") return false;

		const originalRender = proto.render as unknown as (width: number) => string[];
		proto.render = function renderWithPiComfyPanels(
			this: TUI,
			width: number,
		): string[] {
			return paintRenderedLines(
				width,
				(innerWidth) => originalRender.call(this, innerWidth),
				state.paintLines,
			);
		} as typeof proto.render;
		protoRecord[RENDER_PATCH_FLAG] = true;
	}

	if (!protoRecord[OVERLAY_PATCH_FLAG] && typeof protoRecord.showOverlay === "function") {
		const showOverlay = protoRecord.showOverlay as ShowOverlay;
		protoRecord.showOverlay = function showOverlayWithPiComfyPanels(
			this: TUI,
			component: Component,
			options?: unknown,
		): unknown {
			return showOverlay.call(this, patchComponentRender(component, state), options);
		} as ShowOverlay;
		protoRecord[OVERLAY_PATCH_FLAG] = true;
	}

	return true;
}
