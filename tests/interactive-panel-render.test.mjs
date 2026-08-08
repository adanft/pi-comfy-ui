import { strict as assert } from "node:assert";
import { createJiti } from "jiti";
import {
	DynamicBorder,
	ExtensionInputComponent,
	ExtensionSelectorComponent,
	initTheme,
	InteractiveMode,
	LoginDialogComponent,
	ShowImagesSelectorComponent,
} from "@earendil-works/pi-coding-agent";
import { Text, visibleWidth } from "@earendil-works/pi-tui";

initTheme(undefined, false);
const TestContainer = Object.getPrototypeOf(
	ShowImagesSelectorComponent.prototype,
).constructor;

const jiti = createJiti(import.meta.url);
const { patchPanelRender } = await jiti.import(
	"../extensions/interactive-panel-render.ts",
);
const { patchAskUserQuestionCustomUi, shouldStyleAskUserQuestionCustomCall } =
	await jiti.import("../extensions/ask-user-question-panel.ts");
const { configureInteractivePanelPainter, paintBorderedPanels } =
	await jiti.import("../extensions/panel-painter.ts");

configureInteractivePanelPainter(
	(line, width) =>
		`${line}${".".repeat(Math.max(0, width - visibleWidth(line)))}`,
);

patchPanelRender(paintBorderedPanels);

function plain(lines) {
	return lines.map((line) => line.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, ""));
}

const PiContainer = Object.getPrototypeOf(
	ShowImagesSelectorComponent.prototype,
).constructor;

const dynamicPanelContainer = new PiContainer();
dynamicPanelContainer.addChild(new DynamicBorder());
dynamicPanelContainer.addChild(new Text("Keyboard Shortcuts", 0, 0));
dynamicPanelContainer.addChild(new DynamicBorder());
assert.deepEqual(
	plain(dynamicPanelContainer.render(20)),
	["────────────────────", "Keyboard Shortcuts  ", "────────────────────"],
	"unknown DynamicBorder containers must stay unchanged without fallback styling",
);

const unmatchedBorderContainer = new PiContainer();
unmatchedBorderContainer.addChild(new DynamicBorder());
unmatchedBorderContainer.addChild(new Text("unmatched", 0, 0));

assert.deepEqual(
	plain(unmatchedBorderContainer.render(12)),
	["────────────", "unmatched   "],
	"unmatched DynamicBorder children must stay unchanged",
);

const fakeMode = {
	chatContainer: new PiContainer(),
	ui: { requestRender() {} },
};
InteractiveMode.prototype.showPackageUpdateNotification.call(fakeMode, [
	"pkg-a",
]);
assert.equal(
	fakeMode.chatContainer.children.length,
	1,
	"chat panel method patches must wrap only the appended panel range",
);
assert.equal(
	plain(fakeMode.chatContainer.render(30))
		.filter((line) => line.length > 0)
		.every((line) => line.startsWith("┃") && line.endsWith("┃")),
	true,
	"chat panels appended by patched InteractiveMode methods must be styled",
);

const wrappedChatPanel = fakeMode.chatContainer.children[0];
const wrappedChild = wrappedChatPanel.children[0];
const renderWrappedChild = wrappedChild.render.bind(wrappedChild);
let wrappedChildRenderCount = 0;
wrappedChild.render = (width) => {
	wrappedChildRenderCount++;
	return renderWrappedChild(width);
};
wrappedChatPanel.invalidate();

const firstCachedRender = wrappedChatPanel.render(30);
firstCachedRender[0] = "mutated cached render result";
const secondCachedRender = wrappedChatPanel.render(30);
assert.equal(
	wrappedChildRenderCount,
	1,
	"static chat panel groups must reuse cached styled lines for the same width",
);
assert.notEqual(
	secondCachedRender[0],
	"mutated cached render result",
	"static chat panel groups must return copies of cached styled lines",
);
wrappedChatPanel.invalidate();
wrappedChatPanel.render(30);
assert.equal(
	wrappedChildRenderCount,
	2,
	"invalidating a static chat panel group must clear its styled-line cache",
);

const reloadEditorContainer = new PiContainer();
let reloadBox;
const previousEditor = new PiContainer();
previousEditor.addChild(new DynamicBorder());
previousEditor.addChild(new Text("editor", 0, 0));
previousEditor.addChild(new DynamicBorder());
const reloadMode = {
	session: {
		isStreaming: false,
		isCompacting: false,
		reload: async () => {
			throw new Error("reload failed for test");
		},
	},
	resetExtensionUI() {},
	editorContainer: reloadEditorContainer,
	editor: previousEditor,
	ui: {
		setFocus() {},
		requestRender() {},
	},
	showWarning() {},
	showError() {},
};
const originalReloadAddChild = reloadEditorContainer.addChild.bind(
	reloadEditorContainer,
);
const capturingReloadAddChild = (component) => {
	if (!reloadBox) reloadBox = component;
	return originalReloadAddChild(component);
};
reloadEditorContainer.addChild = capturingReloadAddChild;
await InteractiveMode.prototype.handleReloadCommand.call(reloadMode);
assert.deepEqual(
	plain(reloadBox.render(24)).slice(0, 3),
	[
		"┃......................┃",
		"┃......................┃",
		"┃ Reloading keybindings┃",
	],
	"reload command panel must be styled through its explicit route wrapper",
);
assert.equal(
	reloadEditorContainer.addChild,
	capturingReloadAddChild,
	"reload command wrapper must restore editorContainer.addChild after failures",
);

const successfulReloadEditorContainer = new PiContainer();
const successfulReloadAddChild = successfulReloadEditorContainer.addChild;
const successfulReloadMode = {
	session: {
		isStreaming: false,
		isCompacting: false,
		reload: async () => {},
	},
	resetExtensionUI() {},
	editorContainer: successfulReloadEditorContainer,
	editor: new PiContainer(),
	ui: { setFocus() {}, requestRender() {} },
	showWarning() {},
	showError() {},
};
await InteractiveMode.prototype.handleReloadCommand.call(successfulReloadMode);
assert.equal(
	successfulReloadEditorContainer.addChild,
	successfulReloadAddChild,
	"reload command wrapper must restore editorContainer.addChild after async success",
);
assert.equal(
	Object.prototype.toString.call(
		InteractiveMode.prototype.showPackageUpdateNotification.call(fakeMode, [
			"pkg-b",
		]),
	),
	"[object Undefined]",
	"selected chat panel methods are synchronous in Pi 0.84.1",
);
assert.deepEqual(
	plain(previousEditor.render(16)),
	["────────────────", "editor          ", "────────────────"],
	"reload command wrapper must not style unrelated DynamicBorder containers",
);

const extensionSelector = new ExtensionSelectorComponent(
	"Confirm?\nAre you sure?",
	["Yes", "No"],
	() => {},
	() => {},
);
assert.equal(
	plain(extensionSelector.render(30)).every(
		(line) => line.startsWith("┃") && line.endsWith("┃"),
	),
	true,
	"actual extension selectors used by confirm/select must be styled",
);

const extensionInput = new ExtensionInputComponent(
	"Extension Title",
	undefined,
	() => {},
	() => {},
);
assert.equal(
	plain(extensionInput.render(20)).every(
		(line) => line.startsWith("┃") && line.endsWith("┃"),
	),
	true,
	"actual extension input panels must be styled",
);

const loginDialog = new LoginDialogComponent(
	new TestContainer(),
	"provider",
	() => {},
);
assert.deepEqual(
	plain(loginDialog.render(20)),
	["┃..................┃", "┃ Login to provider┃", "┃..................┃"],
	"actual login dialogs must be styled",
);

assert.equal(
	shouldStyleAskUserQuestionCustomCall(
		"at Object.handler (/home/user/.pi/agent/npm/node_modules/@juicesharp/rpiv-ask-user-question/ask-user-question.ts:108:28)",
	),
	true,
	"ask_user_question custom UI calls must be recognized by their package stack",
);
assert.equal(
	shouldStyleAskUserQuestionCustomCall(
		"at Object.handler (/home/user/.pi/agent/npm/node_modules/other-package/index.ts:1:1)",
	),
	false,
	"unrelated custom UI calls must not be recognized as ask_user_question",
);

let capturedCustomFactory;
let capturedCustomOptions;
const customResult = { accepted: true };
const askUserQuestionUi = {
	custom(factory, options) {
		capturedCustomFactory = factory;
		capturedCustomOptions = options;
		return Promise.resolve(customResult);
	},
};
assert.equal(
	patchAskUserQuestionCustomUi(
		askUserQuestionUi,
		paintBorderedPanels,
		() =>
			"at Object.handler (/home/user/.pi/agent/npm/node_modules/@juicesharp/rpiv-ask-user-question/ask-user-question.ts:108:28)",
	),
	true,
	"ask_user_question custom UI patch must install when ui.custom exists",
);
const customOptions = { overlay: true };
const syncDoneResults = [];
const syncResult = await askUserQuestionUi.custom(
	(tui, theme, keybindings, done) => {
		syncDoneResults.push([tui, theme, keybindings]);
		done("sync-done");
		return {
			render() {
				return ["────", "question", "────"];
			},
			invalidate() {},
		};
	},
	customOptions,
);
assert.equal(
	syncResult,
	customResult,
	"ask_user_question custom wrapper must preserve the returned result",
);
assert.equal(
	capturedCustomOptions,
	customOptions,
	"ask_user_question custom wrapper must forward options",
);
assert.equal(
	syncDoneResults.length,
	0,
	"ask_user_question custom wrapper must not invoke the factory before Pi does",
);
const askUserQuestionComponent = capturedCustomFactory(
	new TestContainer(),
	{},
	{},
	(result) => syncDoneResults.push(result),
);
assert.deepEqual(
	syncDoneResults.at(-1),
	"sync-done",
	"ask_user_question custom wrapper must preserve done propagation",
);
assert.deepEqual(
	plain(askUserQuestionComponent.render(12)),
	["┃..┃", "┃qu┃", "┃..┃"],
	"ask_user_question custom components must be explicitly styled",
);

await askUserQuestionUi.custom(
	() =>
		new Promise((resolve) =>
			resolve({
				render() {
					return ["────", "async", "────"];
				},
				invalidate() {},
			}),
		),
	customOptions,
);
const asyncAskUserQuestionComponent = await capturedCustomFactory(
	new TestContainer(),
	{},
	{},
	() => {},
);
assert.deepEqual(
	plain(asyncAskUserQuestionComponent.render(12)),
	["┃..┃", "┃as┃", "┃..┃"],
	"async ask_user_question custom components must be explicitly styled",
);

await askUserQuestionUi.custom(
	() => Promise.reject(new Error("async factory failed")),
	customOptions,
);
await assert.rejects(
	() => capturedCustomFactory(new TestContainer(), {}, {}, () => {}),
	"ask_user_question custom wrapper must preserve async factory rejection",
);
capturedCustomFactory = undefined;
await askUserQuestionUi.custom(() => {
	throw new Error("sync factory failed");
}, customOptions);
assert.throws(
	() => capturedCustomFactory(new TestContainer(), {}, {}, () => {}),
	/sync factory failed/,
	"ask_user_question custom wrapper must preserve sync factory rejection",
);

let capturedOtherFactory;
const otherCustomUi = {
	custom(factory) {
		capturedOtherFactory = factory;
		return Promise.resolve("done");
	},
};
patchAskUserQuestionCustomUi(
	otherCustomUi,
	paintBorderedPanels,
	() =>
		"at Object.handler (/home/user/.pi/agent/npm/node_modules/other-package/index.ts:1:1)",
);
await otherCustomUi.custom(() => ({
	render() {
		return ["────", "custom", "────"];
	},
	invalidate() {},
}));
const otherCustomComponent = capturedOtherFactory(
	new TestContainer(),
	{},
	{},
	() => {},
);
assert.deepEqual(
	plain(otherCustomComponent.render(12)),
	["────", "custom", "────"],
	"non-ask_user_question custom components must stay unchanged",
);

const nonPanelTui = new TestContainer();
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
