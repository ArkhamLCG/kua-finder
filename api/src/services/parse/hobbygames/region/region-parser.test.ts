import assert from "node:assert/strict";
import { test } from "node:test";
import { parseRegions } from "./region-parser.js";

test("parseRegions returns unique regions from contact map", async () => {
  const regions = await parseRegions();

  assert.ok(regions.length > 20);

  const ids = new Set<number>();
  for (const region of regions) {
    assert.ok(region.id > 0);
    assert.ok(region.name.length > 0);
    assert.ok(!ids.has(region.id));
    ids.add(region.id);
  }

  assert.ok(regions.some((region) => region.name.includes("Москва")));
  assert.ok(regions.some((region) => region.id === 28));
});
