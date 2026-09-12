import assert from "node:assert/strict";
import { test } from "node:test";
import { ZNAEMIGRAEM_CATEGORY_URL } from "./config.js";
import { parseZnaemigraemPage } from "./page-parser.js";

test("parseZnaemigraemPage returns products with availability", async () => {
  const products = await parseZnaemigraemPage(ZNAEMIGRAEM_CATEGORY_URL);
  assert.ok(products.length > 10, `expected many products, got ${products.length}`);

  for (const product of products) {
    assert.ok(product.id > 0);
    assert.ok(product.name.length > 0);
    assert.ok(product.url.includes("znaemigraem.ru"));
    assert.equal(typeof product.available, "boolean");
    assert.ok(product.price >= 0);
  }

  assert.ok(
    products.some((p) => p.available),
    "expected at least one available product",
  );
});
