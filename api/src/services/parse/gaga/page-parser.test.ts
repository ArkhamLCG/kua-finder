import assert from "node:assert/strict";
import { test } from "node:test";
import { GAGA_CATEGORY_URL } from "./config.js";
import { parseGagaPage } from "./page-parser.js";

test("parseGagaPage returns products with buy-button availability", async () => {
  const products = await parseGagaPage(GAGA_CATEGORY_URL);

  assert.ok(products.length >= 1, `expected products, got ${products.length}`);

  for (const product of products) {
    assert.equal(typeof product.id, "number");
    assert.ok(product.id > 0);
    assert.equal(typeof product.price, "number");
    assert.ok(product.price >= 0);
    assert.ok(product.name.length > 0);
    assert.ok(product.url.startsWith("http"));
    assert.equal(typeof product.available, "boolean");
  }

  assert.ok(products.some((p) => p.available));
  assert.ok(products.some((p) => p.url.includes("gaga.ru")));
});
