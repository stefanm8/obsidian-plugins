// A tiny in-memory vault + app, plus assertions, exercising the real plugin code
// against the mocked Obsidian API.
import { TFile, TFolder, notices, moment } from "obsidian";
import TomorrowsDailyNotePlugin from "../src/main";
import { getDailyNoteSettings, getTemplateFormats } from "../src/settings";
import { renderTemplate } from "../src/template";

class FakeVault {
	files = new Map<string, TFile | TFolder>();
	contents = new Map<string, string>();

	addFile(path: string, content = "") {
		this.files.set(path, new TFile(path));
		this.contents.set(path, content);
	}

	addFolder(path: string) {
		this.files.set(path, new TFolder(path));
	}

	getAbstractFileByPath(path: string) {
		return this.files.get(path) ?? null;
	}

	async create(path: string, data: string) {
		if (this.files.has(path)) throw new Error(`File already exists: ${path}`);
		const file = new TFile(path);
		this.files.set(path, file);
		this.contents.set(path, data);
		return file;
	}

	async createFolder(path: string) {
		if (this.files.has(path)) throw new Error(`Folder already exists: ${path}`);
		this.files.set(path, new TFolder(path));
	}

	async cachedRead(file: TFile) {
		return this.contents.get(file.path) ?? "";
	}
}

interface AppOptions {
	dailyNotes?: Record<string, unknown> | null;
	periodicNotes?: Record<string, unknown>;
	templates?: Record<string, unknown>;
}

function makeApp(vault: FakeVault, options: AppOptions = {}) {
	const opened: Array<{ path: string; where: unknown }> = [];

	const app = {
		vault,
		opened,
		metadataCache: {
			getFirstLinkpathDest(linkpath: string) {
				const direct = vault.files.get(linkpath);
				if (direct instanceof TFile) return direct;
				const withExt = vault.files.get(`${linkpath}.md`);
				return withExt instanceof TFile ? withExt : null;
			},
		},
		internalPlugins: {
			getPluginById(id: string) {
				if (id === "daily-notes") {
					return options.dailyNotes === null
						? null
						: { instance: { options: options.dailyNotes ?? {} } };
				}
				if (id === "templates") {
					return { instance: { options: options.templates ?? {} } };
				}
				return null;
			},
		},
		plugins: {
			getPlugin: (id: string) =>
				id === "periodic-notes" && options.periodicNotes
					? { settings: { daily: options.periodicNotes } }
					: null,
		},
		workspace: {
			getLeaf(where: unknown) {
				return {
					async openFile(file: TFile) {
						opened.push({ path: file.path, where });
					},
				};
			},
		},
	};

	return app;
}

function makePlugin(vault: FakeVault, options: AppOptions = {}) {
	const plugin = new TomorrowsDailyNotePlugin();
	plugin.app = makeApp(vault, options) as any;
	return plugin;
}

// --- assertions ------------------------------------------------------------

let failures = 0;
let passes = 0;

function check(name: string, condition: boolean, detail = "") {
	if (condition) {
		passes++;
		console.log(`  ok   ${name}`);
	} else {
		failures++;
		console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
	}
}

function equal(name: string, actual: unknown, expected: unknown) {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	check(name, a === e, `expected ${e}, got ${a}`);
}

// --- tests -----------------------------------------------------------------

// Freeze time across a year boundary; the runner sets UTC for repeatable results.
moment.now = () => Date.UTC(2026, 11, 31, 12, 34, 56);
const tomorrow = moment().add(1, "day").startOf("day");

async function testCreatesTomorrowsNoteWithTemplate() {
	console.log("\ncreates tomorrow's note in the configured folder, from the template");
	const vault = new FakeVault();
	vault.addFolder("Dailies");
	vault.addFile(
		"Dailies/Template.md",
		"# {{title}}\n\nplanning {{date}} (after {{yesterday}})\nweekday: {{date:dddd}}\n"
	);

	const plugin = makePlugin(vault, {
		dailyNotes: { folder: "Dailies", template: "Dailies/Template" },
	});
	await plugin.openTomorrowsNote(false);

	const expectedPath = `Dailies/${tomorrow.format("YYYY-MM-DD")}.md`;
	check("note is created at the expected path", vault.files.has(expectedPath), expectedPath);

	const content = vault.contents.get(expectedPath) ?? "";
	equal(
		"template variables are resolved against tomorrow",
		content,
		`# ${tomorrow.format("YYYY-MM-DD")}\n\n` +
			`planning ${tomorrow.format("YYYY-MM-DD")} ` +
			`(after ${tomorrow.clone().subtract(1, "day").format("YYYY-MM-DD")})\n` +
			`weekday: ${tomorrow.format("dddd")}\n`
	);
	equal("the new note is opened", (plugin.app as any).opened, [
		{ path: expectedPath, where: false },
	]);
}

async function testOpensExistingNoteWithoutOverwriting() {
	console.log("\nopens an existing note instead of overwriting it");
	const vault = new FakeVault();
	vault.addFolder("Dailies");
	const path = `Dailies/${tomorrow.format("YYYY-MM-DD")}.md`;
	vault.addFile(path, "already written by hand");
	vault.addFile("Dailies/Template.md", "TEMPLATE");

	const plugin = makePlugin(vault, {
		dailyNotes: { folder: "Dailies", template: "Dailies/Template" },
	});
	await plugin.openTomorrowsNote(false);

	equal("existing content is untouched", vault.contents.get(path), "already written by hand");
	equal("the existing note is opened", (plugin.app as any).opened, [{ path, where: false }]);
}

async function testCustomFormatCreatesNestedFolders() {
	console.log("\nhonours a date format containing folders, creating them as needed");
	const vault = new FakeVault();
	const plugin = makePlugin(vault, {
		dailyNotes: { folder: "Journal", format: "YYYY/MM/YYYY-MM-DD" },
	});
	await plugin.openTomorrowsNote("tab");

	const expectedPath = `Journal/${tomorrow.format("YYYY/MM/YYYY-MM-DD")}.md`;
	check("nested note is created", vault.files.has(expectedPath), expectedPath);
	check(
		"intermediate folders are created",
		vault.files.get(`Journal/${tomorrow.format("YYYY")}`) instanceof TFolder &&
			vault.files.get(`Journal/${tomorrow.format("YYYY/MM")}`) instanceof TFolder
	);
	equal("empty note when no template is configured", vault.contents.get(expectedPath), "");
	equal("opens in the requested pane", (plugin.app as any).opened, [
		{ path: expectedPath, where: "tab" },
	]);
}

async function testDefaultsWhenDailyNotesUnconfigured() {
	console.log("\nfalls back to vault root + YYYY-MM-DD when Daily Notes is unavailable");
	const vault = new FakeVault();
	const plugin = makePlugin(vault, { dailyNotes: null });
	await plugin.openTomorrowsNote(false);

	const expectedPath = `${tomorrow.format("YYYY-MM-DD")}.md`;
	check("note is created at the vault root", vault.files.has(expectedPath), expectedPath);
}

async function testMissingTemplateStillCreatesNote() {
	console.log("\nstill creates the note when the configured template is missing");
	const vault = new FakeVault();
	notices.length = 0;
	const plugin = makePlugin(vault, {
		dailyNotes: { folder: "Dailies", template: "Dailies/Nope" },
	});
	await plugin.openTomorrowsNote(false);

	const expectedPath = `Dailies/${tomorrow.format("YYYY-MM-DD")}.md`;
	check("note is created anyway", vault.files.has(expectedPath), expectedPath);
	check(
		"user is warned about the missing template",
		notices.some((n) => n.includes("template not found")),
		notices.join(" | ")
	);
}

async function testRibbonAndCommandsRegistered() {
	console.log("\nregisters the sidebar item and commands");
	const vault = new FakeVault();
	const plugin = makePlugin(vault, { dailyNotes: {} });
	await plugin.onload();

	equal("one ribbon item is added", plugin.ribbons.length, 1);
	equal("ribbon tooltip", plugin.ribbons[0]?.title, "Open tomorrow's daily note");
	equal("ribbon icon", plugin.ribbons[0]?.icon, "calendar-plus");
	equal("two commands are added", plugin.commands.length, 2);
}

/**
 * Drives the ribbon and command callbacks themselves, rather than calling
 * openTomorrowsNote directly — this is what actually runs when the user clicks.
 * It also pins down that the callbacks return their promise, so a click can be
 * awaited and its failures observed.
 */
async function testClickingTheSidebarItem() {
	console.log("\nclicking the sidebar item creates and opens the note");
	const vault = new FakeVault();
	vault.addFolder("Dailies");
	const plugin = makePlugin(vault, { dailyNotes: { folder: "Dailies" } });
	await plugin.onload();

	const clicked = plugin.ribbons[0].cb({ metaKey: false } as MouseEvent);
	check("the ribbon callback returns a promise", clicked instanceof Promise);
	await clicked;

	const expectedPath = `Dailies/${tomorrow.format("YYYY-MM-DD")}.md`;
	check("click creates the note", vault.files.has(expectedPath), expectedPath);
	equal("click opens it in the current pane", (plugin.app as any).opened, [
		{ path: expectedPath, where: false },
	]);

	// A second, mod-click must reuse the note and open it in a new tab.
	vault.contents.set(expectedPath, "edited by hand");
	await plugin.ribbons[0].cb({ metaKey: true } as MouseEvent);
	equal("re-click preserves content", vault.contents.get(expectedPath), "edited by hand");
	equal("mod-click opens a new tab", (plugin.app as any).opened[1], {
		path: expectedPath,
		where: "tab",
	});

	// And the command palette entry must work too.
	await plugin.commands[0].callback?.();
	equal("command opens the note", (plugin.app as any).opened.length, 3);

	await plugin.ribbons[0].cb({ metaKey: true, altKey: true } as MouseEvent);
	equal("mod-alt-click opens a split", (plugin.app as any).opened[3], {
		path: expectedPath,
		where: "split",
	});
	await plugin.commands[1].callback?.();
	equal("new-tab command opens a tab", (plugin.app as any).opened[4], {
		path: expectedPath,
		where: "tab",
	});
}

async function testSettingsCompatibility() {
	console.log("\nreads core and community settings with safe defaults");
	const vault = new FakeVault();
	const plugin = makePlugin(vault, {
		dailyNotes: null,
		periodicNotes: { folder: " Journal ", format: " YYYY/MM/DD ", template: " " },
	});
	await plugin.openTomorrowsNote(false);
	check("Periodic Notes settings are used when core settings are absent", vault.files.has("Journal/2027/01/01.md"));

	const core = makePlugin(vault, {
		dailyNotes: { folder: " Core ", format: " " },
		periodicNotes: { folder: "Periodic", format: "YYYY/MM/DD" },
	});
	equal("core settings take precedence and blank formats use the default", getDailyNoteSettings(core.app), {
		folder: "Core", format: "YYYY-MM-DD", template: "",
	});

	const malformed = makePlugin(vault, {
		dailyNotes: { folder: {}, format: 42, template: false },
		templates: { dateFormat: [], timeFormat: null },
	});
	equal("non-string daily settings use defaults", getDailyNoteSettings(malformed.app), {
		folder: "", format: "YYYY-MM-DD", template: "",
	});
	equal("invalid template formats use defaults", getTemplateFormats(malformed.app, "YYYY/MM/DD"), {
		dateFormat: "YYYY/MM/DD", timeFormat: "HH:mm",
	});
}

async function testTemplateFormatsAndDateBoundaries() {
	console.log("\nrenders templates across year boundaries without mutating the note date");
	const before = tomorrow.toISOString();
	equal("date, relative dates, and creation time resolve independently", renderTemplate(
		"{{title}}|{{date}}|{{yesterday}}|{{tomorrow}}|{{time}}|{{ DATE:YYYY }}|{{time:HH:mm:ss}}|{{unknown}}",
		tomorrow,
		"2027-01-01",
		{ dateFormat: "DD/MM/YYYY", timeFormat: "HH:mm" },
		moment()
	), "2027-01-01|01/01/2027|31/12/2026|02/01/2027|12:34|2027|12:34:56|{{unknown}}");
	equal("relative variables do not mutate the note date", tomorrow.toISOString(), before);

	const vault = new FakeVault();
	vault.addFile("Templates/Daily.md", "{{date}} at {{time}}");
	const plugin = makePlugin(vault, {
		dailyNotes: { folder: "Journal", template: "Templates/Daily.md" },
		templates: { dateFormat: " DD/MM/YYYY ", timeFormat: " HH:mm:ss " },
	});
	await plugin.openTomorrowsNote(false);
	equal("template settings are passed through when creating the note", vault.contents.get("Journal/2027-01-01.md"), "01/01/2027 at 12:34:56");
}

async function testConcurrentCreation() {
	console.log("\nconcurrent clicks share the same note");
	const vault = new FakeVault();
	const plugin = makePlugin(vault, { dailyNotes: { folder: "Journal/Nested" } });
	notices.length = 0;
	await Promise.all([plugin.openTomorrowsNote(false), plugin.openTomorrowsNote("tab")]);
	equal("only one note is created", [...vault.contents.keys()], ["Journal/Nested/2027-01-01.md"]);
	equal("both clicks open the note", (plugin.app as any).opened.length, 2);
	equal("only one creation notice is shown", notices, ["Created 2027-01-01"]);
}

async function main() {
	await testCreatesTomorrowsNoteWithTemplate();
	await testOpensExistingNoteWithoutOverwriting();
	await testCustomFormatCreatesNestedFolders();
	await testDefaultsWhenDailyNotesUnconfigured();
	await testMissingTemplateStillCreatesNote();
	await testRibbonAndCommandsRegistered();
	await testClickingTheSidebarItem();
	await testSettingsCompatibility();
	await testTemplateFormatsAndDateBoundaries();
	await testConcurrentCreation();

	console.log(`\n${passes} passed, ${failures} failed`);
	if (failures > 0) process.exit(1);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
