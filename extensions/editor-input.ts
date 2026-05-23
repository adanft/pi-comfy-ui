import {
	CustomEditor,
	type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { type BackgroundPainter, stripAnsi } from "./ansi.js";

function isHorizontalEditorBorder(line: string): boolean {
	if (!line.includes("─")) return false;

	const plain = stripAnsi(line);
	return plain.includes("─") && /^[─ ↑↓0-9more]+$/.test(plain);
}

export class PanelEditor extends CustomEditor {
	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		private paintBg: BackgroundPainter,
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
