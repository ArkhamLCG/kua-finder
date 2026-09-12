import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GAGA_CATEGORY_URL } from "../../services/parse/gaga/config.js";
import { parseGagaPage } from "../../services/parse/gaga/page-parser.js";

const url = process.argv[2] ?? GAGA_CATEGORY_URL;
const products = await parseGagaPage(url);

const outDir = path.resolve("dist/gaga");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });
await writeFile(
  outFile,
  JSON.stringify(
    {
      last_updated: new Date().toISOString(),
      source: "gaga",
      products,
    },
    null,
    2,
  ),
);

const available = products.filter((p) => p.available).length;
console.log(
  `Saved ${products.length} gaga products (${available} available) → ${outFile}`,
);
