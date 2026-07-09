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
import { Text, TUI, visibleWidth } from "@earendil-works/pi-tui";

initTheme(undefined, false);

const jiti = createJiti(import.meta.url);
const { patchPanelRender } = await jiti.import(
	"../extensions/interactive-panel-render.ts",
);
const {
	patchAskUserQuestionCustomUi,
	shouldStyleAskUserQuestionCustomCall,
} = await jiti.import("../extensions/ask-user-question-panel.ts");
const { shouldStyleKnownPiCoreComponent } = await jiti.import(
	"../extensions/known-pi-panels.ts",
);
const { configureInteractivePanelPainter, paintBorderedPanels } = await jiti.import(
	"../extensions/panel-painter.ts",
);

configureInteractivePanelPainter((line, width) =>
	`${line}${".".repeat(Math.max(0, width - visibleWidth(line)))}`,
);

assert.equal(patchPanelRender(paintBorderedPanels), true);

function plain(lines) {
	return lines.map((line) => line.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, ""));
}

const renderWidths = [];
const tui = new TUI({ hideCursor() {}, write() {} });
tui.addChild({
	render(width) {
		renderWidths.push(width);
		return ["────", "hi", "────"];
	},
	invalidate() {},
});

const lines = tui.render(10);

assert.deepEqual(renderWidths, [10], "child render must receive unchanged width");
assert.deepEqual(
	plain(lines),
	["────", "hi", "────"],
	"root render content must stay unchanged",
);

const overlayRenderWidths = [];
const overlay = {
	render(width) {
		overlayRenderWidths.push(width);
		return ["────", "hi", "────"];
	},
	invalidate() {},
};

tui.showOverlay(overlay, { width: 10 });
const overlayLines = overlay.render(10);

assert.deepEqual(overlayRenderWidths, [10], "overlay render must receive unchanged width");
assert.deepEqual(
	plain(overlayLines),
	["────", "hi", "────"],
	"unknown overlays must stay unchanged without fallback styling",
);
assert.deepEqual(overlayLines.map((line) => visibleWidth(line)), [4, 2, 4]);

const rootMountedSelector = new ShowImagesSelectorComponent(true, () => {}, () => {});
const selectorLines = rootMountedSelector.render(30);
const plainSelectorLines = plain(selectorLines);

assert.deepEqual(
	plainSelectorLines,
	[
		"┃............................┃",
		"┃→ Yes.......................┃",
		"┃  No........................┃",
		"┃............................┃",
	],
	"exported root-mounted selectors such as settings must be styled",
);
assert.deepEqual(
	selectorLines.map((line) => visibleWidth(line)),
	[30, 30, 30, 30],
	"root-mounted selector styling must preserve component width",
);

const PiContainer = Object.getPrototypeOf(ShowImagesSelectorComponent.prototype)
	.constructor;

const exportedSelectorContainer = new PiContainer();
exportedSelectorContainer.addChild(rootMountedSelector);
assert.deepEqual(
	plain(rootMountedSelector.render(30)),
	plainSelectorLines,
	"mounting exported selectors must preserve their styled output",
);

const selectorContainer = new PiContainer();

const dynamicPanelContainer = new PiContainer();
dynamicPanelContainer.addChild(new DynamicBorder());
dynamicPanelContainer.addChild(new Text("Keyboard Shortcuts", 0, 0));
dynamicPanelContainer.addChild(new DynamicBorder());
selectorContainer.addChild(dynamicPanelContainer);
assert.equal(
	selectorContainer.children.at(-1),
	dynamicPanelContainer,
	"unknown DynamicBorder containers must not be replaced by fallback styling",
);
assert.deepEqual(
	plain(dynamicPanelContainer.render(20)),
	["────────────────────", "Keyboard Shortcuts  ", "────────────────────"],
	"unknown DynamicBorder containers must stay unchanged without fallback styling",
);

const unmatchedBorderContainer = new PiContainer();
unmatchedBorderContainer.addChild(new DynamicBorder());
unmatchedBorderContainer.addChild(new Text("unmatched", 0, 0));
selectorContainer.addChild(unmatchedBorderContainer);
assert.deepEqual(
	plain(unmatchedBorderContainer.render(12)),
	["────────────", "unmatched   "],
	"unmatched DynamicBorder children must stay unchanged",
);
class UnknownSelectorComponent extends PiContainer {
	constructor() {
		super();
		this.addChild(new DynamicBorder());
		this.addChild(new Text("trust", 0, 0));
		this.addChild(new DynamicBorder());
	}
}
const unexportedSelector = new UnknownSelectorComponent();
selectorContainer.addChild(unexportedSelector);

class BashExecutionComponent extends PiContainer {
	constructor() {
		super();
		this.addChild(new DynamicBorder());
		this.addChild(new Text("bash", 0, 0));
		this.addChild(new DynamicBorder());
	}
}
const bashComponent = new BashExecutionComponent();
selectorContainer.addChild(bashComponent);
assert.equal(
	selectorContainer.children.at(-1),
	bashComponent,
	"unknown DynamicBorder panels must not be replaced with cached static groups",
);

assert.deepEqual(
	plain(unexportedSelector.render(12)),
	["────────────", "trust       ", "────────────"],
	"unexported root-mounted DynamicBorder panels must stay unchanged without fallback styling",
);

class TrustSelectorComponent extends PiContainer {
	constructor() {
		super();
		this.addChild(new DynamicBorder());
		this.addChild(new Text("known trust", 0, 0));
		this.addChild(new DynamicBorder());
	}
}
const knownUnexportedSelector = new TrustSelectorComponent();
const knownUnexportedTui = new TUI({ hideCursor() {}, write() {} });
knownUnexportedTui.addChild(knownUnexportedSelector);
assert.deepEqual(
	plain(knownUnexportedSelector.render(16)),
	["────────────────", "known trust     ", "────────────────"],
	"known-name custom components outside Pi core stacks must stay unchanged",
);
assert.equal(
	shouldStyleKnownPiCoreComponent(
		knownUnexportedSelector,
		"at InteractiveMode.showTrustSelector (/x/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:3517:14)",
	),
	true,
	"known Pi core selector routes must be recognized by component name and Pi stack",
);
assert.equal(
	shouldStyleKnownPiCoreComponent(
		knownUnexportedSelector,
		"at custom (/x/node_modules/some-extension/index.js:1:1)",
	),
	false,
	"constructor-name collisions outside Pi core stacks must not be styled",
);

class ScopedModelsSelectorComponent extends PiContainer {
	constructor() {
		super();
		this.addChild(new DynamicBorder());
		this.addChild(new Text("models", 0, 0));
		this.addChild(new DynamicBorder());
	}
}
class EarendilAnnouncementComponent extends PiContainer {
	constructor() {
		super();
		this.addChild(new DynamicBorder());
		this.addChild(new Text("earendil", 0, 0));
		this.addChild(new DynamicBorder());
	}
}
const knownPiCoreComponents = [
	new ScopedModelsSelectorComponent(),
	new EarendilAnnouncementComponent(),
];
const knownPiCoreStacks = [
	"at InteractiveMode.showModelsSelector (/x/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:3600:14)",
	"at InteractiveMode.handleDementedDelves (/x/node_modules/@earendil-works/pi-coding-agent/dist/modes/interactive/interactive-mode.js:4676:31)",
];
for (const [index, component] of knownPiCoreComponents.entries()) {
	assert.equal(
		shouldStyleKnownPiCoreComponent(component, knownPiCoreStacks[index]),
		component.constructor.name !== "EarendilAnnouncementComponent",
		`${component.constructor.name} route recognition must stay explicit`,
	);
}

const fakeMode = {
	chatContainer: new PiContainer(),
	ui: { requestRender() {} },
};
InteractiveMode.prototype.showPackageUpdateNotification.call(fakeMode, ["pkg-a"]);
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
const originalReloadAddChild = reloadEditorContainer.addChild.bind(reloadEditorContainer);
const capturingReloadAddChild = (component) => {
	if (!reloadBox) reloadBox = component;
	return originalReloadAddChild(component);
};
reloadEditorContainer.addChild = capturingReloadAddChild;
await InteractiveMode.prototype.handleReloadCommand.call(reloadMode);
assert.deepEqual(
	plain(reloadBox.render(24)).slice(0, 3),
	["┃......................┃", "┃......................┃", "┃ Reloading keybindings┃"],
	"reload command panel must be styled through its explicit route wrapper",
);
assert.equal(
	reloadEditorContainer.addChild,
	capturingReloadAddChild,
	"reload command wrapper must restore editorContainer.addChild after failures",
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
	plain(extensionSelector.render(30)).every((line) => line.startsWith("┃") && line.endsWith("┃")),
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
	plain(extensionInput.render(20)).every((line) => line.startsWith("┃") && line.endsWith("┃")),
	true,
	"actual extension input panels must be styled",
);

const loginDialog = new LoginDialogComponent(
	new TUI({ hideCursor() {}, write() {} }),
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
const askUserQuestionUi = {
	custom(factory) {
		capturedCustomFactory = factory;
		return Promise.resolve("done");
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
await askUserQuestionUi.custom(() => ({
	render() {
		return ["────", "question", "────"];
	},
	invalidate() {},
}));
const askUserQuestionComponent = capturedCustomFactory(
	new TUI({ hideCursor() {}, write() {} }),
	{},
	{},
	() => {},
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
);
const asyncAskUserQuestionComponent = await capturedCustomFactory(
	new TUI({ hideCursor() {}, write() {} }),
	{},
	{},
	() => {},
);
assert.deepEqual(
	plain(asyncAskUserQuestionComponent.render(12)),
	["┃..┃", "┃as┃", "┃..┃"],
	"async ask_user_question custom components must be explicitly styled",
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
	() => "at Object.handler (/home/user/.pi/agent/npm/node_modules/other-package/index.ts:1:1)",
);
await otherCustomUi.custom(() => ({
	render() {
		return ["────", "custom", "────"];
	},
	invalidate() {},
}));
const otherCustomComponent = capturedOtherFactory(
	new TUI({ hideCursor() {}, write() {} }),
	{},
	{},
	() => {},
);
assert.deepEqual(
	plain(otherCustomComponent.render(12)),
	["────", "custom", "────"],
	"non-ask_user_question custom components must stay unchanged",
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
