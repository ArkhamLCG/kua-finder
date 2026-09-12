import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePage } from "../../services/parse/hobbygames/page/page-parser.js";

const DEFAULT_BY =
  process.env.CATEGORY_URL_BY ??
  "https://hobbygames.by/kartochnij-uzhas-arkhjema";

const url = process.argv[2] ?? DEFAULT_BY;
const products = await parsePage(url, { priceScale: 100 });

const outDir = path.resolve("dist/hobbygames-by");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: new Date().toISOString(),
      source: "hobbygames_by",
      currency: "BYN",
      products,
    },
    null,
    2,
  ),
);

console.log(`Saved ${products.length} hobbygames.by products → ${outFile}`);
