import type { PatchState } from "./panel-render-types.js";

const PATCH_STATE = Symbol.for("pi-comfy-ui.panel-render-state");

export function resolvePanelPatchState(
	record: Record<PropertyKey, unknown>,
): PatchState {
	const existing = record[PATCH_STATE] as PatchState | undefined;
	if (existing && typeof existing.paintLines === "function") return existing;

	const state: PatchState = { paintLines: (lines) => lines };
	record[PATCH_STATE] = state;
	return state;
}
