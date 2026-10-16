import {
	Keymap,
	Notice,
	type PaneType,
	Plugin,
	TFile,
	TFolder,
	moment,
	normalizePath,
} from "obsidian";
import { getDailyNoteSettings, getTemplateFormats } from "./settings";
import { renderTemplate } from "./template";

const RIBBON_ICON = "calendar-plus";

export default class TomorrowsDailyNotePlugin extends Plugin {
	async onload() {
		this.addRibbonIcon(RIBBON_ICON, "Open tomorrow's daily note", (evt: MouseEvent) =>
			// Mod-click opens in a new tab, mod-alt-click in a split — as elsewhere in Obsidian.
			this.openTomorrowsNote(Keymap.isModEvent(evt))
		);

		this.addCommand({
			id: "open-tomorrows-daily-note",
			name: "Open tomorrow's daily note",
			callback: () => this.openTomorrowsNote(false),
		});

		this.addCommand({
			id: "open-tomorrows-daily-note-new-tab",
			name: "Open tomorrow's daily note in a new tab",
			callback: () => this.openTomorrowsNote("tab"),
		});
	}

	async openTomorrowsNote(where: PaneType | boolean) {
		try {
			const tomorrow = moment().add(1, "day").startOf("day");
			const file = await this.getOrCreateDailyNote(tomorrow);
			const leaf = this.app.workspace.getLeaf(where);
			await leaf.openFile(file, { active: true });
		} catch (err) {
			console.error("Tomorrow's Daily Note:", err);
			new Notice(`Couldn't open tomorrow's note: ${errorMessage(err)}`);
		}
	}

	/** Returns tomorrow's note, creating it (folders + template) if missing. */
	private async getOrCreateDailyNote(date: moment.Moment): Promise<TFile> {
		const settings = getDailyNoteSettings(this.app);
		const path = normalizePath(
			joinPath(settings.folder, `${date.format(settings.format)}.md`)
		);

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) return existing;
		if (existing instanceof TFolder) {
			throw new Error(`"${path}" is a folder, not a note`);
		}

		await this.ensureFolderExists(parentPath(path));

		const template = await this.readTemplate(settings.template);
		const contents = template
			? renderTemplate(
					template,
					date,
					basename(path),
					getTemplateFormats(this.app, settings.format),
					moment()
				)
			: "";

		try {
			const created = await this.app.vault.create(path, contents);
			new Notice(`Created ${basename(path)}`);
			return created;
		} catch (err) {
			// Another process (e.g. Sync, or a double click) may have won the race.
			const raced = this.app.vault.getAbstractFileByPath(path);
			if (raced instanceof TFile) return raced;
			throw err;
		}
	}

	/** Creates `folder` and any missing ancestors. */
	private async ensureFolderExists(folder: string) {
		if (!folder) return;

		const segments = folder.split("/").filter(Boolean);
		let current = "";
		for (const segment of segments) {
			current = current ? `${current}/${segment}` : segment;
			const existing = this.app.vault.getAbstractFileByPath(current);
			if (existing instanceof TFolder) continue;
			if (existing) throw new Error(`"${current}" exists but is not a folder`);
			try {
				await this.app.vault.createFolder(current);
			} catch (err) {
				// Tolerate a folder that appeared between the check and the create.
				if (!(this.app.vault.getAbstractFileByPath(current) instanceof TFolder)) {
					throw err;
				}
			}
		}
	}

	/** Reads the configured template, tolerating a path with or without `.md`. */
	private async readTemplate(templatePath: string): Promise<string | null> {
		if (!templatePath) return null;

		const normalized = normalizePath(templatePath);
		const file =
			this.app.metadataCache.getFirstLinkpathDest(normalized, "") ??
			this.app.vault.getAbstractFileByPath(
				normalized.endsWith(".md") ? normalized : `${normalized}.md`
			);

		if (!(file instanceof TFile)) {
			new Notice(`Daily note template not found: ${templatePath}`);
			return null;
		}

		return this.app.vault.cachedRead(file);
	}
}

function joinPath(folder: string, name: string): string {
	const trimmed = folder.replace(/^\/+|\/+$/g, "");
	return trimmed ? `${trimmed}/${name}` : name;
}

function parentPath(path: string): string {
	const index = path.lastIndexOf("/");
	return index === -1 ? "" : path.slice(0, index);
}

function basename(path: string): string {
	return path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, "");
}

function errorMessage(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}
