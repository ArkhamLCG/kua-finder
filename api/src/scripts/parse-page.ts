import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_URL } from "../config.js";
import { parsePage } from "../services/parse/page/page-parser.js";

const url = process.argv[2] ?? CATEGORY_URL;
const products = await parsePage(url);

const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: new Date().toISOString(),
      products,
    },
    null,
    2,
  ),
);

console.log(`Saved ${products.length} products → ${outFile}`);
