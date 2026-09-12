import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseRegions } from "../../services/parse/hobbygames/region/region-parser.js";

const regions = await parseRegions();

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "regions.json");

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(regions, null, 2));

console.log(`Saved ${regions.length} regions → ${outFile}`);
