// Builds dist/toy/ (the static package, entry index.html) and the zip to upload.
import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { bundle } from "./bundle.mjs";

const NAME = "hebi8-fx-replay-toy";
const root = fileURLToPath(new URL("../", import.meta.url));
await rm(`${root}dist`, { recursive: true, force: true });
await mkdir(`${root}dist`, { recursive: true });
await cp(`${root}public`, `${root}dist/toy`, { recursive: true });
await writeFile(`${root}dist/toy/app.js`, await bundle());
// Data source and the licences of what is bundled travel with the package.
await cp(`${root}NOTICE`, `${root}dist/toy/NOTICE.txt`);
await cp(`${root}node_modules/klinecharts/LICENSE`, `${root}dist/toy/LICENSE-klinecharts.txt`);
await cp(`${root}node_modules/klinecharts/NOTICE`, `${root}dist/toy/NOTICE-klinecharts.txt`);
await cp(`${root}node_modules/uqr/LICENSE`, `${root}dist/toy/LICENSE-uqr.txt`);
execFileSync("python3", ["-c", `
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path('dist/toy')
with ZipFile('dist/${NAME}.zip', 'w', ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(root))
`], { cwd: root });
const zip = await stat(`${root}dist/${NAME}.zip`);
console.log(`Built dist/toy/ and dist/${NAME}.zip (${Math.ceil(zip.size / 1024)} KB)`);
