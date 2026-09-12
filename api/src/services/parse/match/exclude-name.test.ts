import assert from "node:assert/strict";
import { test } from "node:test";
import { isExcludedProductName } from "./exclude-name.js";

test("isExcludedProductName drops bundles and Mansions of Madness", () => {
  assert.equal(
    isExcludedProductName('Набор дополнений "Жёлтые знаки"'),
    true,
  );
  assert.equal(
    isExcludedProductName("Особняки безумия. Вторая редакция: Путь змеи"),
    true,
  );
  assert.equal(
    isExcludedProductName("Ужас Аркхэма. Карточная игра"),
    false,
  );
});
