import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  parseProduct,
  parseProductAll,
} from "../../services/parse/hobbygames/product/product-parser.js";

const id = Number(process.argv[2]);
const regionArg = process.argv[3];

if (!Number.isFinite(id) || id <= 0) {
  console.error("Usage: npm run parse:product -- <product_id> [region_id|all]");
  process.exit(1);
}

const outDir = path.resolve("dist");
await mkdir(outDir, { recursive: true });

if (regionArg === "all") {
  const stock = await parseProductAll(id);
  const outFile = path.join(outDir, `product-${id}-all.json`);
  await writeFile(outFile, JSON.stringify(stock, null, 2));
  console.log(
    `Saved stock for ${id} across ${stock.regions.length} regions → ${outFile}`,
  );
  process.exit(0);
}

const regionId = regionArg ? Number(regionArg) : undefined;
if (regionId != null && (!Number.isFinite(regionId) || regionId <= 0)) {
  console.error("region_id must be a positive number or 'all'");
  process.exit(1);
}

const stock = await parseProduct(id, regionId);
const suffix = stock.regionId != null ? `-${stock.regionId}` : "";
const outFile = path.join(outDir, `product-${id}${suffix}.json`);
await writeFile(outFile, JSON.stringify(stock, null, 2));
console.log(`Saved stock for ${id} (region ${stock.regionId}) → ${outFile}`);
