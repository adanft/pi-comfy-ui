import type { Component } from "@earendil-works/pi-tui";
import {
	EXPORTED_STYLABLE_COMPONENTS,
	isKnownExportedComponent,
} from "./known-pi-panels.js";
import type { PatchState, PaintLines } from "./panel-render-types.js";

const COMPONENT_RENDER_PATCH_FLAG = Symbol.for(
	"pi-comfy-ui.panel-component-render-patched",
);

function paintRenderedLines(
	width: number,
	render: (width: number) => string[],
	paintLines: PaintLines,
): string[] {
	return paintLines(render(width), width);
}

function hasOwnPatchFlag(record: Record<PropertyKey, unknown>): boolean {
	return Object.hasOwn(record, COMPONENT_RENDER_PATCH_FLAG);
}

export function isPromiseLikeComponent<T>(
	value: T | Promise<T>,
): value is Promise<T> {
	return typeof (value as { then?: unknown }).then === "function";
}

export function patchComponentRender(
	component: Component,
	state: PatchState,
): Component {
	const record = component as Component & Record<PropertyKey, unknown>;
	if (hasOwnPatchFlag(record)) return component;

	const render = component.render.bind(component);
	component.render = (width: number) =>
		paintRenderedLines(width, render, state.paintLines);
	record[COMPONENT_RENDER_PATCH_FLAG] = true;
	return component;
}

function patchComponentPrototype(
	componentClass: { prototype: Component },
	state: PatchState,
): void {
	const proto = componentClass.prototype as Component &
		Record<PropertyKey, unknown>;
	if (hasOwnPatchFlag(proto)) return;

	const render = proto.render;
	proto.render = function renderWithPiComfyPanels(
		this: Component,
		width: number,
	): string[] {
		if (this.constructor !== componentClass) return render.call(this, width);
		return paintRenderedLines(
			width,
			(innerWidth) => render.call(this, innerWidth),
			state.paintLines,
		);
	};
	proto[COMPONENT_RENDER_PATCH_FLAG] = true;
}

export function patchKnownComponentPrototypes(state: PatchState): void {
	for (const componentClass of EXPORTED_STYLABLE_COMPONENTS) {
		patchComponentPrototype(componentClass, state);
	}
}

export function patchMountedComponent(
	component: Component,
	state: PatchState,
): Component {
	const record = component as Component & Record<PropertyKey, unknown>;
	const componentProto = Object.getPrototypeOf(component) as
		| Record<PropertyKey, unknown>
		| undefined;
	const hasOwnPrototypePatch = Boolean(
		componentProto && hasOwnPatchFlag(componentProto),
	);
	const stylableComponent = isKnownExportedComponent(component);
	if (stylableComponent && !hasOwnPatchFlag(record) && !hasOwnPrototypePatch) {
		return patchComponentRender(component, state);
	}

	return component;
}
