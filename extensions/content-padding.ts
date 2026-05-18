import {
	CustomEditor,
	type ExtensionAPI,
	type ExtensionContext,
	type ExtensionUIContext,
	type KeybindingsManager,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import {
	TUI,
	visibleWidth,
	type Component,
	type EditorTheme,
} from "@earendil-works/pi-tui";
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

const PATCH_FLAG = Symbol.for("pi-comfy-ui.tui-render-patched");
const INPUT_BG_TOKEN: Parameters<Theme["getBgAnsi"]>[0] = "customMessageBg";
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

function resolvePaddingX(cwd?: string): number {
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

function resolveEditorPaddingX(cwd?: string): ResolvedPadding {
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

function clampPadding(requested: number, width: number): number {
	const maxForWidth = Math.max(0, Math.floor((width - MIN_INNER_WIDTH) / 2));
	return Math.min(requested, maxForWidth);
}

function padLine(line: string, padding: number): string {
	const pad = " ".repeat(padding);
	return `${pad}${line}${pad}`;
}

function stripAnsi(text: string): string {
	// Generic ANSI CSI stripper. Needed because Pi colors editor borders before we filter them.
	return text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

function isHorizontalEditorBorder(line: string): boolean {
	const plain = stripAnsi(line);
	// Matches Pi editor's horizontal border and scroll indicators like "─── ↑ 2 more".
	return plain.includes("─") && /^[─ ↑↓0-9more]+$/.test(plain);
}

function createBackgroundPainter(theme: Theme) {
	const bgAnsi = theme.getBgAnsi(INPUT_BG_TOKEN);
	if (typeof bgAnsi !== "string" || bgAnsi.length === 0) {
		return (line: string) => line;
	}

	return (line: string, width: number) => {
		const padded = `${line}${" ".repeat(Math.max(0, width - visibleWidth(line)))}`;
		// The cursor uses ANSI reset. Re-apply the background after resets so the panel stays solid.
		return `${bgAnsi}${padded.replaceAll("\u001b[0m", `\u001b[0m${bgAnsi}`)}\u001b[49m`;
	};
}

class PanelEditor extends CustomEditor {
	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private paintBg: (line: string, width: number) => string,
		private defaultEditorPaddingX: number,
		private hasConfiguredEditorPaddingX: boolean,
	) {
		super(tui, theme, keybindings, { paddingX: defaultEditorPaddingX });
	}

	setPaddingX(padding: number): void {
		super.setPaddingX(
			this.hasConfiguredEditorPaddingX ? padding : this.defaultEditorPaddingX,
		);
	}

	render(width: number): string[] {
		if (width < 3) {
			return this.renderEditorContent(width).map((line) =>
				this.paintBg(line, width),
			);
		}

		const sideRail = this.borderColor?.("┃") ?? "┃";
		const innerWidth = width - 2;
		const frame = (line: string) =>
			`${sideRail}${this.paintBg(line, innerWidth)}${sideRail}`;

		return [
			frame(""),
			...this.renderEditorContent(innerWidth).map(frame),
			frame(""),
		];
	}

	private renderEditorContent(width: number): string[] {
		return super
			.render(width)
			.filter((line: string) => !isHorizontalEditorBorder(line));
	}
}

function patchTuiRender(): boolean {
	const proto = TUI.prototype as TUI & Record<PropertyKey, unknown>;
	if (proto[PATCH_FLAG]) return true;
	if (typeof proto.render !== "function") return false;

	const originalRender = proto.render as unknown as (width: number) => string[];
	proto.render = function renderWithComfyPadding(
		this: PiComfyTui,
		width: number,
	): string[] {
		const padding = clampPadding(this.__piComfyUi?.paddingX ?? 0, width);
		if (padding <= 0) return originalRender.call(this, width);

		const innerWidth = Math.max(1, width - padding * 2);
		return originalRender
			.call(this, innerWidth)
			.map((line) => padLine(line, padding));
	} as typeof proto.render;

	proto[PATCH_FLAG] = true;
	return true;
}

function refreshRootPadding(tui: PiComfyTui, cwd: string): void {
	tui.__piComfyUi = { paddingX: resolvePaddingX(cwd) };
	tui.requestRender?.(true);
}

function refreshActiveTui(ctx: {
	cwd: string;
	ui: Pick<ExtensionUIContext, "custom" | "notify">;
}) {
	// ctx.ui does not expose the root TUI directly. A temporary non-overlay custom
	// component is the smallest supported way to access and refresh it.
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

export default function contentPaddingExtension(pi: ExtensionAPI) {
	const patched = patchTuiRender();

	pi.on("session_start", (_event: unknown, ctx: ExtensionContext) => {
		if (!patched) {
			ctx.ui.notify?.(
				"pi-comfy-ui is disabled: unsupported Pi TUI render API.",
				"warning",
			);
			return;
		}

		const editorPadding = resolveEditorPaddingX(ctx.cwd);
		ctx.ui.setEditorComponent(
			(tui, editorTheme, keybindings) =>
				new PanelEditor(
					tui,
					editorTheme,
					keybindings,
					createBackgroundPainter(ctx.ui.theme),
					editorPadding.value,
					editorPadding.configured,
				),
		);
		refreshActiveTui(ctx);
	});
}
