import { TUI, type Component } from "@earendil-works/pi-tui";

export type PaintLines = (lines: string[], width: number) => string[];
export type ShowOverlay = (component: Component, options?: unknown) => unknown;
export type AddChild = (component: Component) => void;
export type PatchState = { paintLines: PaintLines };
export type ChatPanelMethod = (...args: unknown[]) => unknown;

export type CustomOverlayOptions = {
	overlay?: boolean;
	overlayOptions?: unknown;
	onHandle?: unknown;
};

export type CustomComponent = Component & { dispose?(): void };
export type CustomFactory<T> = (
	tui: TUI,
	theme: unknown,
	keybindings: unknown,
	done: (result: T) => void,
) => CustomComponent | Promise<CustomComponent>;

export type CustomUi = {
	custom?<T>(factory: CustomFactory<T>, options?: CustomOverlayOptions): Promise<T>;
};

export type PatchableCustomUi = CustomUi & Record<PropertyKey, unknown>;
