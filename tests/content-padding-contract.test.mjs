import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { strict as assert } from "node:assert";

const extensionFiles = readdirSync("extensions")
	.filter((file) => file.endsWith(".ts"))
	.sort();

const runtimeText = extensionFiles
	.map((file) => readFileSync(join("extensions", file), "utf8"))
	.join("\n");

const readme = readFileSync("README.md", "utf8");
const packageJson = readFileSync("package.json", "utf8");

for (const forbidden of [
	"contentPaddingX",
	"layoutPaddingX",
	"PI_CONTENT_PADDING_X",
	"resolveEditorPaddingX",
	"resolvePaddingX",
	"readPaddingSettings",
	"DEFAULT_EDITOR_PADDING_X",
	"patchTuiRender",
	"refreshActiveTui",
	"__piComfyUi",
]) {
	assert.equal(
		runtimeText.includes(forbidden),
		false,
		`runtime must not include ${forbidden}`,
	);
}

assert.match(readme, /does not read, set, or override Pi padding settings/);
assert.match(readme, /"editorPaddingX": 1/);
assert.match(readme, /"outputPad": 1/);
assert.match(readme, /no longer supports/);
assert.match(packageJson, /@earendil-works\/pi-coding-agent": ">=0\.80\.3 <1"/);
assert.match(packageJson, /@earendil-works\/pi-tui": ">=0\.80\.3 <1"/);
