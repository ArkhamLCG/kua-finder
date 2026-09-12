import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseShops } from "../../services/parse/hobbygames/shop/shop-parser.js";

const shops = await parseShops();

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "shops.json");

await mkdir(outDir, { recursive: true });
await writeFile(outFile, JSON.stringify(shops, null, 2));

console.log(`Saved ${shops.length} shops → ${outFile}`);
