// Bundles the plugin against the mocked Obsidian API and runs the harness.
import esbuild from "esbuild";
import { fileURLToPath } from "url";
import path from "path";
import { execFileSync } from "child_process";

const dir = path.dirname(fileURLToPath(import.meta.url));
const outfile = path.join(dir, ".build", "harness.cjs");

await esbuild.build({
	entryPoints: [path.join(dir, "harness.ts")],
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "node18",
	outfile,
	alias: { obsidian: path.join(dir, "obsidian-mock.ts") },
	logLevel: "warning",
});

execFileSync(process.execPath, [outfile], {
	stdio: "inherit",
	env: { ...process.env, TZ: "UTC" },
});
