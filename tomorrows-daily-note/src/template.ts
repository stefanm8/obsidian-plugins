import type { moment } from "obsidian";
import type { TemplateFormats } from "./settings";

/** Dates are relative to the note; time is the time at which it is created. */
export function renderTemplate(
	template: string,
	date: moment.Moment,
	title: string,
	formats: TemplateFormats,
	now: moment.Moment
): string {
	return template.replace(
		/{{\s*(date|time|title|yesterday|tomorrow)\s*(?::\s*([^}]*?)\s*)?}}/gi,
		(match, rawName: string, rawFormat?: string) => {
			const format = rawFormat?.trim();
			switch (rawName.toLowerCase()) {
				case "title":
					return title;
				case "time":
					return now.format(format || formats.timeFormat);
				case "date":
					return date.format(format || formats.dateFormat);
				case "yesterday":
					return date.clone().subtract(1, "day").format(format || formats.dateFormat);
				case "tomorrow":
					return date.clone().add(1, "day").format(format || formats.dateFormat);
				default:
					return match;
			}
		}
	);
}
