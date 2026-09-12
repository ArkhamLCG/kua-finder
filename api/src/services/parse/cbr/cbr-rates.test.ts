import assert from "node:assert/strict";
import { test } from "node:test";
import { convertToRub } from "./cbr-rates.js";

test("convertToRub uses Value/Nominal", () => {
  assert.equal(
    convertToRub(100, { nominal: 100, value: 18.69, date: "2026-01-01" }),
    18.69,
  );
  assert.equal(
    convertToRub(1, { nominal: 1, value: 27.8, date: "2026-01-01" }),
    27.8,
  );
  assert.equal(convertToRub(10, undefined), null);
});
