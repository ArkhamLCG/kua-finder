import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CATEGORY_URL } from "../config.js";
import { parsePage, type ParsedProduct } from "../services/parse/page/page-parser.js";
import { parseProductAll } from "../services/parse/product/product-parser.js";
import { parseRegions } from "../services/parse/region/region-parser.js";

export type ProductWithStock = ParsedProduct & {
  stock: Array<{
    regionId: number;
    regionName: string;
    locations: Array<{
      name: string;
      address: string;
      status: number;
      statusText: string;
      delivery: boolean;
    }>;
  }>;
};

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`;
}

function setProgress(text: string): void {
  const width = process.stdout.columns || 100;
  const line = text.length > width - 1 ? `${text.slice(0, width - 2)}…` : text;
  process.stdout.write(`\r\x1b[2K${line}`);
}

function clearProgress(): void {
  process.stdout.write("\r\x1b[2K");
}

const url = process.argv[2] ?? CATEGORY_URL;
const outDir = path.resolve("dist");
const outFile = path.join(outDir, "products.json");

await mkdir(outDir, { recursive: true });

console.log("1/3 Catalog…");
const products = await parsePage(url);
console.log(`   ${products.length} products`);

console.log("2/3 Regions…");
const regions = await parseRegions();
console.log(`   ${regions.length} regions`);

console.log("3/3 Stock…");
const result: ProductWithStock[] = [];
const startedAt = Date.now();
let ok = 0;
let fail = 0;

for (const [index, product] of products.entries()) {
  const productNo = index + 1;
  const productStartedAt = Date.now();
  let active = true;

  try {
    const stock = await parseProductAll(
      product.id,
      4,
      regions,
      (done, total) => {
        if (!active) return;

        const finished = index;
        const fraction = finished + done / total;
        const elapsed = Date.now() - startedAt;
        const avgMs =
          finished > 0 ? elapsed / finished : Date.now() - productStartedAt;
        const etaMs = avgMs * (products.length - fraction);

        setProgress(
          [
            `${productNo}/${products.length}`,
            `reg ${done}/${total}`,
            `${Math.round((fraction / products.length) * 100)}%`,
            `eta ${formatDuration(etaMs)}`,
            `ok ${ok}`,
            `fail ${fail}`,
            product.name,
          ].join(" | "),
        );
      },
    );

    active = false;
    result.push({
      ...product,
      stock: stock.regions.map((region) => ({
        regionId: region.regionId ?? 0,
        regionName: region.regionName ?? "",
        locations: region.locations,
      })),
    });
    ok += 1;
  } catch (error) {
    active = false;
    fail += 1;
    result.push({
      ...product,
      stock: [],
    });
    setProgress(
      [
        `${productNo}/${products.length}`,
        "fail",
        error instanceof Error ? error.message : String(error),
        `ok ${ok}`,
        `fail ${fail}`,
        product.name,
      ].join(" | "),
    );
  }

  await writeFile(
    outFile,
    JSON.stringify(
      {
        last_updated: new Date().toISOString(),
        products: result,
      },
      null,
      2,
    ),
  );
}

clearProgress();
console.log(
  `Done: ${ok} ok, ${fail} fail, ${formatDuration(Date.now() - startedAt)} → ${outFile}`,
);
