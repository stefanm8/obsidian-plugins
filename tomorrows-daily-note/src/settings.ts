import type { App } from "obsidian";

export interface DailyNoteSettings {
	folder: string;
	format: string;
	template: string;
}

export interface TemplateFormats {
	dateFormat: string;
	timeFormat: string;
}

// Obsidian does not expose these plugin settings in its public App types.
// Keep the compatibility boundary here instead of spreading casts through the plugin.
interface SettingsAccess {
	internalPlugins?: {
		getPluginById?: (id: string) => {
			instance?: { options?: Record<string, unknown> };
		} | null | undefined;
	};
	plugins?: {
		getPlugin?: (id: string) => {
			settings?: { daily?: Record<string, unknown> };
		} | null | undefined;
	};
}

function option(value: unknown, fallback = ""): string {
	return typeof value === "string" ? value.trim() || fallback : fallback;
}

/** Prefer Daily Notes, then Periodic Notes, then the default daily-note format. */
export function getDailyNoteSettings(app: App): DailyNoteSettings {
	const access = app as unknown as SettingsAccess;
	const core = access.internalPlugins?.getPluginById?.("daily-notes");
	const periodic = access.plugins?.getPlugin?.("periodic-notes");
	const options = core?.instance?.options ?? periodic?.settings?.daily ?? {};

	return {
		folder: option(options.folder),
		format: option(options.format, "YYYY-MM-DD"),
		template: option(options.template),
	};
}

export function getTemplateFormats(app: App, dailyDateFormat: string): TemplateFormats {
	const access = app as unknown as SettingsAccess;
	const templates = access.internalPlugins?.getPluginById?.("templates");
	const options = templates?.instance?.options ?? {};

	return {
		dateFormat: option(options.dateFormat, dailyDateFormat),
		timeFormat: option(options.timeFormat, "HH:mm"),
	};
}
