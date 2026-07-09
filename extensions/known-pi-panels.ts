import * as Pi from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";

export const EXPORTED_STYLABLE_COMPONENTS = [
	Pi.BashExecutionComponent,
	Pi.BorderedLoader,
	Pi.ExtensionEditorComponent,
	Pi.ExtensionInputComponent,
	Pi.ExtensionSelectorComponent,
	Pi.LoginDialogComponent,
	Pi.ModelSelectorComponent,
	Pi.OAuthSelectorComponent,
	Pi.SessionSelectorComponent,
	Pi.SettingsSelectorComponent,
	Pi.ShowImagesSelectorComponent,
	Pi.ThemeSelectorComponent,
	Pi.ThinkingSelectorComponent,
	Pi.ToolExecutionComponent,
	Pi.TreeSelectorComponent,
	Pi.UserMessageSelectorComponent,
];

export const CHAT_PANEL_METHODS = [
	"showStartupNoticesIfNeeded",
	"showNewVersionNotification",
	"showPackageUpdateNotification",
	"handleChangelogCommand",
	"handleHotkeysCommand",
	"handleDementedDelves",
];

const KNOWN_UNEXPORTED_PI_COMPONENT_ROUTES = new Map([
	["ScopedModelsSelectorComponent", "showModelsSelector"],
	["TrustSelectorComponent", "showTrustSelector"],
]);

function componentName(component: unknown): string | undefined {
	return (component as { constructor?: { name?: string } } | null)?.constructor
		?.name;
}

export function isKnownExportedComponent(component: Component): boolean {
	return EXPORTED_STYLABLE_COMPONENTS.some(
		(componentClass) => component.constructor === componentClass,
	);
}

export function needsPiCoreStack(component: Component): boolean {
	const name = componentName(component);
	return Boolean(name && KNOWN_UNEXPORTED_PI_COMPONENT_ROUTES.has(name));
}

export function shouldStyleKnownPiCoreComponent(
	component: Component,
	stack: string | undefined,
): boolean {
	const name = componentName(component);
	const route = name ? KNOWN_UNEXPORTED_PI_COMPONENT_ROUTES.get(name) : undefined;
	if (!route) return false;
	return Boolean(
		stack?.includes("@earendil-works/pi-coding-agent") && stack.includes(route),
	);
}
