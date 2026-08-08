import { strict as assert } from "node:assert";
import { createJiti } from "jiti";
import { visibleWidth } from "@earendil-works/pi-tui";

const jiti = createJiti(import.meta.url);
const { PanelEditor } = await jiti.import("../extensions/editor-input.ts");

const identity = (text) => text;
const editorTheme = {
	borderColor: identity,
	selectList: {
		selectedPrefix: identity,
		selectedText: identity,
		description: identity,
		scrollInfo: identity,
		noMatch: identity,
	},
};

const tui = { requestRender() {}, terminal: { rows: 24 } };
const editor = new PanelEditor(
	tui,
	editorTheme,
	{ matches: () => false },
	(line, width) => `${line}${".".repeat(Math.max(0, width - visibleWidth(line)))}`,
);

editor.setPaddingX(2);

assert.equal(editor.getPaddingX(), 2, "PanelEditor must use Pi's inherited padding setter");

const lines = editor.render(8);
const plainLines = lines.map((line) =>
	line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, ""),
);

assert.equal(lines.every((line) => visibleWidth(line) === 8), true);
assert.equal(plainLines.every((line) => line.startsWith("┃") && line.endsWith("┃")), true);
