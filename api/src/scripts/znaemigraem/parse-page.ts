import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ZNAEMIGRAEM_CATEGORY_URL,
} from "../../services/parse/znaemigraem/config.js";
import { parseZnaemigraemPage } from "../../services/parse/znaemigraem/page-parser.js";

const url = process.argv[2] ?? ZNAEMIGRAEM_CATEGORY_URL;
const products = await parseZnaemigraemPage(url);

const outDir = path.resolve("dist/znaemigraem");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: new Date().toISOString(),
      source: "znaemigraem",
      products,
    },
    null,
    2,
  ),
);

const available = products.filter((p) => p.available).length;
console.log(
  `Saved ${products.length} znaemigraem products (${available} available) → ${outFile}`,
);
