import { strict as assert } from "node:assert";
import { createJiti } from "jiti";
import { TUI, visibleWidth } from "@earendil-works/pi-tui";

const jiti = createJiti(import.meta.url);
const { patchPanelRender } = await jiti.import(
	"../extensions/interactive-panel-render.ts",
);
const { configureInteractivePanelPainter, paintBorderedPanels } = await jiti.import(
	"../extensions/interactive-input.ts",
);

configureInteractivePanelPainter((line, width) =>
	`${line}${".".repeat(Math.max(0, width - visibleWidth(line)))}`,
);

assert.equal(patchPanelRender(paintBorderedPanels), true);

function plain(lines) {
	return lines.map((line) => line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, ""));
}

const renderWidths = [];
const tui = new TUI({});
tui.addChild({
	render(width) {
		renderWidths.push(width);
		return ["────", "hi", "────"];
	},
	invalidate() {},
});

const lines = tui.render(10);

assert.deepEqual(renderWidths, [10], "child render must receive unchanged width");
assert.deepEqual(plain(lines), ["┃..┃", "┃hi┃", "┃..┃"]);
assert.deepEqual(
	lines.map((line) => visibleWidth(line)),
	[4, 4, 4],
	"panel styling must not add root/content padding",
);

const nonPanelTui = new TUI({});
nonPanelTui.addChild({
	render() {
		return ["hello", "world"];
	},
	invalidate() {},
});

assert.deepEqual(
	plain(nonPanelTui.render(10)),
	["hello", "world"],
	"non-panel content must stay unchanged",
);
