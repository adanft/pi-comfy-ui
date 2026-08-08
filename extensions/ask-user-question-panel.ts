import type { TUI } from "@earendil-works/pi-tui";
import {
	isPromiseLikeComponent,
	patchComponentRender,
} from "./component-render-patch.js";
import type {
	CustomComponent,
	CustomFactory,
	CustomOverlayOptions,
	CustomUi,
	PaintLines,
	PatchableCustomUi,
} from "./panel-render-types.js";
import { resolvePanelPatchState } from "./panel-render-state.js";

const ASK_USER_QUESTION_CUSTOM_PATCH_FLAG = Symbol.for(
	"pi-comfy-ui.ask-user-question-custom-patched",
);
const ASK_USER_QUESTION_PACKAGE_SEGMENT = "@juicesharp/rpiv-ask-user-question";

export function shouldStyleAskUserQuestionCustomCall(
	stack: string | undefined,
): boolean {
	return Boolean(stack?.includes(ASK_USER_QUESTION_PACKAGE_SEGMENT));
}

export function patchAskUserQuestionCustomUi(
	ui: CustomUi,
	paintLines: PaintLines,
	stackProvider: () => string | undefined = () => new Error().stack,
): boolean {
	const record = ui as PatchableCustomUi;
	const state = resolvePanelPatchState(record);
	state.paintLines = paintLines;
	if (record[ASK_USER_QUESTION_CUSTOM_PATCH_FLAG]) return true;
	if (typeof ui.custom !== "function") return false;

	const custom = ui.custom.bind(ui);
	ui.custom = function customWithPiComfyAskUserQuestion<T>(
		factory: CustomFactory<T>,
		options?: CustomOverlayOptions,
	): Promise<T> {
		const shouldStyle = shouldStyleAskUserQuestionCustomCall(stackProvider());
		if (!shouldStyle) return custom(factory, options);

		return custom(
			(
				tui: TUI,
				theme: unknown,
				keybindings: unknown,
				done: (result: T) => void,
			) => {
				const component = factory(tui, theme, keybindings, done);
				if (isPromiseLikeComponent(component)) {
					return component.then(
						(resolved) =>
							patchComponentRender(resolved, state) as CustomComponent,
					);
				}
				return patchComponentRender(component, state) as CustomComponent;
			},
			options,
		);
	};
	record[ASK_USER_QUESTION_CUSTOM_PATCH_FLAG] = true;
	return true;
}
