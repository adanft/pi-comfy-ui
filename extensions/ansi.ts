import type { Theme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";

export type BackgroundPainter = (line: string, width: number) => string;
export type ThemeBgToken = Parameters<Theme["getBgAnsi"]>[0];

const RESET_BG_ANSI = "\u001b[49m";

export function stripAnsi(text: string): string {
	return text.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "");
}

export function createBackgroundPainter(
	theme: Theme,
	token: ThemeBgToken,
): BackgroundPainter {
	const bgAnsi = theme.getBgAnsi(token);
	if (typeof bgAnsi !== "string" || bgAnsi.length === 0) {
		return (line: string) => line;
	}

	return (line: string, width: number) => {
		const padded = `${line}${" ".repeat(Math.max(0, width - visibleWidth(line)))}`;
		const repainted = padded
			.replaceAll("\u001b[0m", `\u001b[0m${bgAnsi}`)
			.replaceAll(RESET_BG_ANSI, `${RESET_BG_ANSI}${bgAnsi}`);
		return `${bgAnsi}${repainted}${RESET_BG_ANSI}`;
	};
}
