// Copies the built plugin into a vault: VAULT=/path/to/vault npm run install-plugin
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vault = process.env.VAULT ?? process.argv[2];

if (!vault) {
	console.error("Set the vault path: VAULT=/path/to/vault npm run install-plugin");
	process.exit(1);
}

if (!fs.existsSync(path.join(vault, ".obsidian"))) {
	console.error(`Not an Obsidian vault (no .obsidian folder): ${vault}`);
	process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const dest = path.join(vault, ".obsidian", "plugins", manifest.id);
fs.mkdirSync(dest, { recursive: true });

for (const file of ["main.js", "manifest.json"]) {
	const src = path.join(root, file);
	if (!fs.existsSync(src)) {
		console.error(`Missing ${file} — run \`npm run build\` first.`);
		process.exit(1);
	}
	fs.copyFileSync(src, path.join(dest, file));
}

console.log(`Installed ${manifest.name} v${manifest.version} to ${dest}`);
console.log("In Obsidian: Settings → Community plugins → reload, then enable the plugin.");
