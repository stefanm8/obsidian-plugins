# Tomorrow's Daily Note

An Obsidian plugin that adds a single item to the left sidebar (ribbon): click it and you get
**tomorrow's** daily note — created if it doesn't exist yet, opened either way.

It deliberately has no settings of its own. Folder, date format and template are read from your
existing **Daily Notes** core plugin settings (falling back to **Periodic Notes** if you use that
instead).

## What it does

- Adds a `calendar-plus` ribbon icon: **Open tomorrow's daily note**
- Creates the note at `<daily notes folder>/<date format>.md` for tomorrow's date
- Creates any missing folders, including date formats that nest (`YYYY/MM/YYYY-MM-DD`)
- Applies your daily note template, resolving `{{title}}`, `{{date}}`, `{{time}}`, `{{yesterday}}`
  and `{{tomorrow}}` — with optional formats like `{{date:dddd}}`. Dates are **relative to tomorrow**,
  so `{{date}}` is tomorrow and `{{yesterday}}` is today; `{{time}}` uses the current time
- Never overwrites an existing note; it just opens it
- Mod-click the ribbon icon to open in a new tab, mod-alt-click to open in a split

It also registers two commands for the command palette / hotkeys:

- `Tomorrow's Daily Note: Open tomorrow's daily note`
- `Tomorrow's Daily Note: Open tomorrow's daily note in a new tab`

## Build

```bash
npm ci
npm run build     # type-check + bundle to main.js
npm test          # run the logic tests against a mocked Obsidian API
npm run dev       # rebuild on change
```

Run these commands from this plugin's directory. The repository CI uses Node.js 22.

## Install into a vault

```bash
npm run build
VAULT="/path/to/your/vault" npm run install-plugin
```

Then in Obsidian: **Settings → Community plugins**, turn off Restricted Mode if it's on, hit the
reload button, and enable **Tomorrow's Daily Note**.

You can also copy `main.js` and `manifest.json` into
`<vault>/.obsidian/plugins/tomorrows-daily-note/` manually. The repository's GitHub Actions
build artifacts contain these two files. After installing an update, disable and re-enable
the plugin or restart Obsidian.

This repository contains the source for manual installation; it does not automatically
publish the plugin to Obsidian's community directory. Building alone does not update an
installed copy: run the install command again after making changes.

## Code layout

- `src/main.ts`: ribbon and commands, note creation, folders, and template loading.
- `src/settings.ts`: typed access to Daily Notes, Periodic Notes, and Templates settings.
- `src/template.ts`: template rendering with explicit note and creation dates.

Settings access uses Obsidian's internal plugin interfaces, which may change between app versions.
Template rendering supports the variables listed above; it does not execute Templater scripts.

## Tests

`npm test` bundles `src/main.ts` against a mock of the Obsidian API (`test/obsidian-mock.ts`) and an
in-memory vault. It checks note creation, template substitution, nested folders, existing-note
reuse, missing templates, settings fallbacks, concurrent clicks, and ribbon/command callbacks.
The clock is fixed in UTC at a year boundary so dates are repeatable.

## License

[MIT](../LICENSE).
