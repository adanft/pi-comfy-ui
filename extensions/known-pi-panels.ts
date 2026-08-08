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

function componentName(component: unknown): string | undefined {
	return (component as { constructor?: { name?: string } } | null)?.constructor
		?.name;
}

export function isKnownExportedComponent(component: Component): boolean {
	return EXPORTED_STYLABLE_COMPONENTS.some(
		(componentClass) => component.constructor === componentClass,
	);
}
