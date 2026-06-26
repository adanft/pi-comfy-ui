import type {
	ExtensionUIContext,
	KeybindingsManager,
	Theme,
} from "@earendil-works/pi-coding-agent";
import { TUI, type Component } from "@earendil-works/pi-tui";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

type PaddingSettings = {
	contentPaddingX?: unknown;
	layoutPaddingX?: unknown;
	editorPaddingX?: unknown;
};

type ResolvedPadding = {
	value: number;
	configured: boolean;
};

type PiComfyTui = TUI & {
	__piComfyUi?: { paddingX: number };
};

type PaintLines = (lines: string[], width: number) => string[];
type ShowOverlay = (component: Component, options?: unknown) => unknown;
type PatchState = { paintLines: PaintLines };

const PATCH_STATE = Symbol.for("pi-comfy-ui.tui-render-state");
const PATCH_FLAG = Symbol.for("pi-comfy-ui.tui-render-patched");
const OVERLAY_PATCH_FLAG = Symbol.for("pi-comfy-ui.tui-overlay-patched");
const OVERLAY_RENDER_PATCH_FLAG = Symbol.for(
	"pi-comfy-ui.overlay-render-patched",
);
const DEFAULT_CONTENT_PADDING_X = 1;
const DEFAULT_EDITOR_PADDING_X = 1;
const MAX_PADDING_X = 12;
const MAX_EDITOR_PADDING_X = 3;
const MIN_INNER_WIDTH = 40;

function readSettings(path: string): PaddingSettings {
	if (!existsSync(path)) return {};
	try {
		return JSON.parse(readFileSync(path, "utf8")) as PaddingSettings;
	} catch {
		return {};
	}
}

function numberSetting(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string" || value.trim() === "") return undefined;

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function readPaddingSettings(cwd?: string): {
	globalSettings: PaddingSettings;
	projectSettings: PaddingSettings;
} {
	return {
		globalSettings: readSettings(
			join(homedir(), ".pi", "agent", "settings.json"),
		),
		projectSettings: cwd
			? readSettings(resolve(cwd, ".pi", "settings.json"))
			: {},
	};
}

function clampInteger(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, Math.floor(value)));
}

export function resolvePaddingX(cwd?: string): number {
	const { globalSettings, projectSettings } = readPaddingSettings(cwd);
	const raw =
		numberSetting(projectSettings.contentPaddingX) ??
		numberSetting(projectSettings.layoutPaddingX) ??
		numberSetting(globalSettings.contentPaddingX) ??
		numberSetting(globalSettings.layoutPaddingX) ??
		numberSetting(process.env.PI_CONTENT_PADDING_X) ??
		DEFAULT_CONTENT_PADDING_X;

	return clampInteger(raw, 0, MAX_PADDING_X);
}

export function resolveEditorPaddingX(cwd?: string): ResolvedPadding {
	const { globalSettings, projectSettings } = readPaddingSettings(cwd);
	const configured =
		numberSetting(projectSettings.editorPaddingX) ??
		numberSetting(globalSettings.editorPaddingX);

	return {
		value: clampInteger(
			configured ?? DEFAULT_EDITOR_PADDING_X,
			0,
			MAX_EDITOR_PADDING_X,
		),
		configured: configured !== undefined,
	};
}

function clampPaddingX(requested: number, width: number): number {
	const maxForWidth = Math.max(0, Math.floor((width - MIN_INNER_WIDTH) / 2));
	return Math.min(requested, maxForWidth);
}

function padLineX(line: string, pad: string): string {
	return `${pad}${line}${pad}`;
}

function renderWithComfyPadding(
	tui: PiComfyTui,
	width: number,
	render: (width: number) => string[],
	paintLines: (lines: string[], width: number) => string[],
): string[] {
	const paddingX = clampPaddingX(tui.__piComfyUi?.paddingX ?? 0, width);
	const innerWidth = paddingX > 0 ? Math.max(1, width - paddingX * 2) : width;
	const lines = paintLines(render(innerWidth), innerWidth);

	if (paddingX <= 0) return lines;

	const pad = " ".repeat(paddingX);
	return lines.map((line) => padLineX(line, pad));
}

function resolvePatchState(record: Record<PropertyKey, unknown>): PatchState {
	const existing = record[PATCH_STATE] as PatchState | undefined;
	if (existing && typeof existing.paintLines === "function") return existing;

	const state: PatchState = { paintLines: (lines) => lines };
	record[PATCH_STATE] = state;
	return state;
}

function patchOverlayRender(
	tui: PiComfyTui,
	component: Component,
	state: PatchState,
): Component {
	const record = component as Component & Record<PropertyKey, unknown>;
	if (record[OVERLAY_RENDER_PATCH_FLAG]) return component;

	const render = component.render.bind(component);
	component.render = (width: number) =>
		renderWithComfyPadding(tui, width, render, state.paintLines);
	record[OVERLAY_RENDER_PATCH_FLAG] = true;
	return component;
}

export function patchTuiRender(paintLines: PaintLines): boolean {
	const proto = TUI.prototype as TUI & Record<PropertyKey, unknown>;
	const protoRecord = proto as Record<PropertyKey, unknown>;
	const state = resolvePatchState(protoRecord);
	state.paintLines = paintLines;

	if (!proto[PATCH_FLAG]) {
		if (typeof proto.render !== "function") return false;

		const originalRender = proto.render as unknown as (width: number) => string[];
		proto.render = function renderWithComfyPaddingX(
			this: PiComfyTui,
			width: number,
		): string[] {
			return renderWithComfyPadding(
				this,
				width,
				(innerWidth) => originalRender.call(this, innerWidth),
				state.paintLines,
			);
		} as typeof proto.render;
		proto[PATCH_FLAG] = true;
	}

	if (!protoRecord[OVERLAY_PATCH_FLAG] && typeof protoRecord.showOverlay === "function") {
		const showOverlay = protoRecord.showOverlay as ShowOverlay;
		protoRecord.showOverlay = function showOverlayWithComfyRender(
			this: PiComfyTui,
			component: Component,
			options?: unknown,
		): unknown {
			return showOverlay.call(
				this,
				patchOverlayRender(this, component, state),
				options,
			);
		} as ShowOverlay;
		protoRecord[OVERLAY_PATCH_FLAG] = true;
	}

	return true;
}

function refreshRootPadding(tui: PiComfyTui, cwd: string): void {
	tui.__piComfyUi = { paddingX: resolvePaddingX(cwd) };
	tui.requestRender?.(true);
}

export function refreshActiveTui(ctx: {
	cwd: string;
	ui: Pick<ExtensionUIContext, "custom" | "notify">;
}) {
	void ctx.ui
		.custom<void>(
			(
				tui: TUI,
				_theme: Theme,
				_keybindings: KeybindingsManager,
				done: (value: void) => void,
			): Component => {
				refreshRootPadding(tui, ctx.cwd);
				queueMicrotask(() => done());
				return { render: () => [], invalidate: () => {} };
			},
			{ overlay: false },
		)
		.catch((error: unknown) => {
			ctx.ui.notify?.(
				`pi-comfy-ui failed to refresh layout padding: ${String(error)}`,
				"warning",
			);
		});
}
