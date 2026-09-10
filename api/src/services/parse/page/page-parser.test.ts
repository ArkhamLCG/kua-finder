import assert from "node:assert/strict";
import { test } from "node:test";
import { CATEGORY_URL } from "../../../config.js";
import { parsePage } from "./page-parser.js";

test("parsePage returns products with id, price, name, image, url", async () => {
  const products = await parsePage(CATEGORY_URL);

  assert.ok(products.length > 48, `expected multiple pages, got ${products.length}`);

  for (const product of products) {
    assert.equal(typeof product.id, "number");
    assert.ok(product.id > 0);
    assert.equal(typeof product.price, "number");
    assert.ok(product.price >= 0);
    assert.ok(product.name.length > 0);
    assert.ok(product.image === null || product.image.startsWith("http"));
    assert.ok(product.url.startsWith("http"));
  }

  const sample = products.find((product) => product.id === 197296);
  if (sample) {
    assert.equal(sample.price, 999);
    assert.ok(sample.image);
    assert.ok(sample.url.includes("hobbygames.ru"));
    assert.ok(sample.name.includes("Аркхэм") || sample.name.length > 0);
  }
});
