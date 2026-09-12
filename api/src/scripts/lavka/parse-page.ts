import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LAVKA_CATEGORY_URL } from "../../services/parse/lavka/config.js";
import { parseLavkaPage } from "../../services/parse/lavka/page-parser.js";

const url = process.argv[2] ?? LAVKA_CATEGORY_URL;
const products = await parseLavkaPage(url);

const outDir = path.resolve("dist/lavka");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: new Date().toISOString(),
      source: "lavka",
      products,
    },
    null,
    2,
  ),
);

const available = products.filter((p) => p.available).length;
console.log(
  `Saved ${products.length} lavka products (${available} available) → ${outFile}`,
);
