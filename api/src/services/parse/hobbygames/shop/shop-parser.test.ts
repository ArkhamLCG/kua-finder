import assert from "node:assert/strict";
import { test } from "node:test";
import { buildShopPhoneMap, parseShops } from "./shop-parser.js";

test("parseShops returns shops with phones", async () => {
  const shops = await parseShops();

  assert.ok(shops.length > 50);

  const withPhone = shops.filter((shop) => shop.phone.length > 0);
  assert.ok(withPhone.length > 50);

  const sample = withPhone.find((shop) => shop.name.includes("Бауманская"));
  assert.ok(sample);
  assert.match(sample.phone, /\+7/);
  assert.ok(sample.address.length > 0);

  const phones = buildShopPhoneMap(shops);
  assert.ok(phones.size > 50);
  if (sample) {
    assert.equal(phones.get(sample.name), sample.phone);
  }
});
