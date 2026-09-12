import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProduct, parseProductAll } from "./product-parser.js";

test("parseProduct returns stock locations", async () => {
  const stock = await parseProduct(185140);

  assert.equal(stock.id, 185140);
  assert.ok(stock.locations.length > 0);

  const delivery = stock.locations.find((location) => location.delivery);
  assert.ok(delivery);
  assert.equal(delivery.name, "Доставка");
  assert.ok(delivery.status > 0);

  const shop = stock.locations.find((location) => !location.delivery);
  assert.ok(shop);
  assert.ok(shop.name.length > 0);
  assert.ok(shop.address.length > 0);
});

test("parseProduct respects regionId", async () => {
  const stock = await parseProduct(185140, 1);

  assert.equal(stock.id, 185140);
  assert.equal(stock.regionId, 1);
  assert.ok(stock.locations.some((location) => location.name.includes("Москва")));
  assert.ok(stock.locations.length > 5);
});

test("parseProductAll returns stock for multiple regions", async () => {
  const stock = await parseProductAll(185140, 4);

  assert.equal(stock.id, 185140);
  assert.ok(stock.regions.length > 20);

  const moscow = stock.regions.find((region) => region.regionId === 1);
  assert.ok(moscow);
  assert.ok(moscow.locations.some((location) => location.name.includes("Москва")));
});
