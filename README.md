# Obsidian plugins

A collection of small plugins for [Obsidian](https://obsidian.md).

| Plugin | Description |
| --- | --- |
| [Tomorrow's Daily Note](tomorrows-daily-note/) | Create or open tomorrow's daily note from the sidebar, using the configured daily-note folder and template. |

Each plugin is an independent project with its own build, tests, and installation instructions.

## Development

Use Node.js 22 and npm. From the repository root:

```sh
cd tomorrows-daily-note
npm ci
npm test
npm run build
```

GitHub Actions runs the tests and production build and uploads the installable plugin files
as an artifact. See the plugin's README for installation instructions.

## License

[MIT](LICENSE).
