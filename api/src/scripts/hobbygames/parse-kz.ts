import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePage } from "../../services/parse/hobbygames/page/page-parser.js";

const DEFAULT_KZ =
  process.env.CATEGORY_URL_KZ ??
  "https://hobbygames.kz/arkham-horror-card-game";

const url = process.argv[2] ?? DEFAULT_KZ;
const products = await parsePage(url);

const outDir = path.resolve("dist/hobbygames-kz");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: new Date().toISOString(),
      source: "hobbygames_kz",
      currency: "KZT",
      products,
    },
    null,
    2,
  ),
);

console.log(`Saved ${products.length} hobbygames.kz products → ${outFile}`);
