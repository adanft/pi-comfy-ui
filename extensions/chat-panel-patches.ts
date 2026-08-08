import {
	DynamicBorder,
	InteractiveMode,
} from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import { patchComponentRender } from "./component-render-patch.js";
import { CHAT_PANEL_METHODS } from "./known-pi-panels.js";
import type {
	ChatPanelMethod,
	PaintLines,
	PatchState,
} from "./panel-render-types.js";

const CHAT_METHOD_PATCH_FLAG = Symbol.for("pi-comfy-ui.chat-methods-patched");
const RELOAD_METHOD_PATCH_FLAG = Symbol.for(
	"pi-comfy-ui.reload-method-patched",
);

class PiComfyPanelGroup implements Component {
	private cachedWidth: number | undefined;
	private cachedLines: string[] | undefined;

	constructor(
		private readonly children: Component[],
		private readonly paintLines: PaintLines,
	) {}

	render(width: number): string[] {
		if (this.cachedWidth === width && this.cachedLines) {
			return [...this.cachedLines];
		}

		const lines = this.paintLines(
			this.children.flatMap((child) => child.render(width)),
			width,
		);
		this.cachedWidth = width;
		this.cachedLines = lines;
		return [...lines];
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
		for (const child of this.children) child.invalidate?.();
	}
}

function wrapAppendedChatPanel(
	target: unknown,
	start: number,
	state: PatchState,
): void {
	const chatContainer = (
		target as { chatContainer?: { children?: Component[] } }
	).chatContainer;
	const children = chatContainer?.children;
	if (!Array.isArray(children) || start >= children.length) return;

	const appended = children.slice(start);
	if (appended.length === 0) return;
	children.splice(
		start,
		appended.length,
		new PiComfyPanelGroup(appended, state.paintLines),
	);
}

function isReloadStatusPanel(component: Component): boolean {
	const children = (component as Component & { children?: Component[] })
		.children;
	return (
		component.constructor?.name === "Container" &&
		Array.isArray(children) &&
		children[0]?.constructor === DynamicBorder &&
		children.at(-1)?.constructor === DynamicBorder &&
		children.some((child) => {
			const text = (child as { text?: unknown }).text;
			return (
				typeof text === "string" &&
				text.includes(
					"Reloading keybindings, extensions, skills, prompts, themes",
				)
			);
		})
	);
}

export function patchChatPanelMethods(state: PatchState): void {
	const proto = InteractiveMode.prototype as unknown as Record<
		PropertyKey,
		unknown
	>;
	if (proto[CHAT_METHOD_PATCH_FLAG]) return;

	for (const methodName of CHAT_PANEL_METHODS) {
		const original = proto[methodName];
		if (typeof original !== "function") continue;

		proto[methodName] = function piComfyChatPanelWrapper(
			this: { chatContainer?: { children?: Component[] } },
			...args: unknown[]
		): unknown {
			const start = this.chatContainer?.children?.length ?? 0;
			const result = (original as ChatPanelMethod).apply(this, args);
			wrapAppendedChatPanel(this, start, state);
			return result;
		};
	}

	proto[CHAT_METHOD_PATCH_FLAG] = true;
}

export function patchReloadCommandMethod(state: PatchState): void {
	const proto = InteractiveMode.prototype as unknown as Record<
		PropertyKey,
		unknown
	>;
	if (proto[RELOAD_METHOD_PATCH_FLAG]) return;

	const original = proto.handleReloadCommand;
	if (typeof original !== "function") return;

	proto.handleReloadCommand = function piComfyReloadPanelWrapper(
		this: {
			editorContainer?: { addChild?: (component: Component) => void };
		},
		...args: unknown[]
	): unknown {
		const editorContainer = this.editorContainer;
		if (!editorContainer || typeof editorContainer.addChild !== "function") {
			return (original as ChatPanelMethod).apply(this, args);
		}

		const originalAddChild = editorContainer.addChild;
		const addChild = originalAddChild.bind(editorContainer);
		editorContainer.addChild = ((component: Component) =>
			addChild(
				isReloadStatusPanel(component)
					? patchComponentRender(component, state)
					: component,
			)) as (component: Component) => void;
		try {
			const result = (original as ChatPanelMethod).apply(this, args);
			if (typeof (result as { finally?: unknown })?.finally === "function") {
				return (result as Promise<unknown>).finally(() => {
					editorContainer.addChild = originalAddChild;
				});
			}
			editorContainer.addChild = originalAddChild;
			return result;
		} catch (error) {
			editorContainer.addChild = originalAddChild;
			throw error;
		}
	};
	proto[RELOAD_METHOD_PATCH_FLAG] = true;
}
