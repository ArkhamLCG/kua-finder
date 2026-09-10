import { access, cp, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDist = path.resolve(root, "../api/dist");
const outDir = path.join(root, "public/data");

const files = ["products.json", "regions.json"];

await mkdir(outDir, { recursive: true });

for (const file of files) {
  const src = path.join(apiDist, file);
  try {
    await access(src);
  } catch {
    console.error(
      `Missing ${src}. Run \`npm run parse:page\` and \`npm run update:products\` first.`,
    );
    process.exit(1);
  }
  await copyFile(src, path.join(outDir, file));
  console.log(`copied ${file} → public/data/${file}`);
}

const productsSrc = path.join(apiDist, "products");
const productsOut = path.join(outDir, "products");
await rm(productsOut, { recursive: true, force: true });
try {
  await access(productsSrc);
  await cp(productsSrc, productsOut, { recursive: true });
  console.log(`copied products/ → public/data/products/`);
} catch {
  await mkdir(productsOut, { recursive: true });
  console.warn(
    `warn: ${productsSrc} missing — created empty public/data/products/. Run \`npm run update:products\` for stock details.`,
  );
}
