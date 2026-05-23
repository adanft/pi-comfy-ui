import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { type BackgroundPainter, stripAnsi } from "./ansi.js";

let paintPanelBg: BackgroundPainter | undefined;

export function configureInteractivePanelPainter(
	painter: BackgroundPainter,
): void {
	paintPanelBg = painter;
}

function isDynamicBorder(line: string): boolean {
	if (!line.includes("─")) return false;

	const plain = stripAnsi(line);
	return plain.length > 0 && /^─+$/.test(plain);
}

function createSideBorderFromLine(line: string): string {
	const sideBorder = truncateToWidth(line.replace("─", "┃"), 1, "");
	return visibleWidth(sideBorder) === 1 ? sideBorder : "┃";
}

export function paintBorderedPanels(lines: string[], width: number): string[] {
	const painter = paintPanelBg;
	if (!painter) return lines;

	const painted: string[] = [];
	for (let index = 0; index < lines.length; index++) {
		if (!isDynamicBorder(lines[index])) {
			painted.push(lines[index]);
			continue;
		}

		let end = -1;
		for (let endIndex = index + 1; endIndex < lines.length; endIndex++) {
			if (isDynamicBorder(lines[endIndex])) {
				end = endIndex;
				break;
			}
		}
		if (end === -1) {
			painted.push(lines[index]);
			continue;
		}

		const panelWidth = Math.min(
			width,
			visibleWidth(lines[index]),
			visibleWidth(lines[end]),
		);
		const contentWidth = Math.max(0, panelWidth - 2);
		const sideBorder = createSideBorderFromLine(lines[index]);
		const frame = (line: string) =>
			`${sideBorder}${painter(
				truncateToWidth(line, contentWidth, ""),
				contentWidth,
			)}${sideBorder}`;

		painted.push(frame(""));
		for (let panelIndex = index + 1; panelIndex < end; panelIndex++) {
			painted.push(frame(lines[panelIndex]));
		}
		painted.push(frame(""));
		index = end;
	}

	return painted;
}
