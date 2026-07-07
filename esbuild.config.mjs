// esbuild configuration for bundling the plugin (JavaScript version)
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
Bookmark List File Generator Plugin - Bundled
*/
`;

let prod = process.argv[2] === "production";
let context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["main.js"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
