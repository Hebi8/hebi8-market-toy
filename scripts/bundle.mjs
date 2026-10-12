// The game's own modules and KLineChart become one self-contained app.js.
// Shared by the preview server, the checks and the package build.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

/** Returns the bundled script as text. No source map: it would carry paths of this machine. */
export async function bundle({ minify = true } = {}) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["src/main.js"],
    bundle: true,
    format: "esm",
    // Older in-app WebViews: no optional chaining or nullish coalescing left in the output.
    target: "es2019",
    minify,
    legalComments: "none",
    sourcemap: false,
    write: false,
    logLevel: "silent",
  });
  return result.outputFiles[0].text;
}
