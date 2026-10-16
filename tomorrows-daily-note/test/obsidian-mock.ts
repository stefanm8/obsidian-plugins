// Minimal stand-in for the parts of the Obsidian API the plugin touches, so the
// plugin logic can be exercised outside of Obsidian.
import momentImpl from "moment";

export const moment = momentImpl;

export type PaneType = "tab" | "split" | "window";

export const notices: string[] = [];

export class Notice {
	constructor(public message: string) {
		notices.push(message);
	}
}

export abstract class TAbstractFile {
	constructor(public path: string) {}
}

export class TFile extends TAbstractFile {
	get basename() {
		return this.path.slice(this.path.lastIndexOf("/") + 1).replace(/\.md$/, "");
	}
}

export class TFolder extends TAbstractFile {}

export class Plugin {
	app: any;
	ribbons: Array<{ icon: string; title: string; cb: (evt: MouseEvent) => any }> = [];
	commands: Array<{ id: string; name: string; callback?: () => any }> = [];

	addRibbonIcon(icon: string, title: string, cb: (evt: MouseEvent) => any) {
		this.ribbons.push({ icon, title, cb });
		return {} as any;
	}

	addCommand(cmd: { id: string; name: string; callback?: () => any }) {
		this.commands.push(cmd);
		return cmd as any;
	}
}

export const Keymap = {
	// Mirrors Obsidian: mod-click -> new tab, mod-alt-click -> split.
	isModEvent: (evt: MouseEvent): PaneType | boolean => {
		if (!evt?.metaKey && !evt?.ctrlKey) return false;
		return evt.altKey ? "split" : "tab";
	},
};

export function normalizePath(path: string): string {
	return path
		.replace(/\\/g, "/")
		.replace(/\/{2,}/g, "/")
		.replace(/^\/+|\/+$/g, "");
}
