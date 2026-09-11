import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNameIndex,
  findMatchByName,
  normalizeName,
} from "./normalize-name.js";

test("normalizeName collapses punctuation and ё/э", () => {
  assert.equal(
    normalizeName("Ужас Аркхэма. Карточная игра: Наследие Данвича"),
    "ужас аркхема карточная игра наследие данвича",
  );
  assert.equal(
    normalizeName("Ужас Аркхэма — Кампания"),
    normalizeName("Ужас Аркхема - Кампания"),
  );
});

test("findMatchByName matches across retailers", () => {
  const catalog = [
    { id: 1, name: "Ужас Аркхэма. Карточная игра: Забытая эпоха" },
    { id: 2, name: "Другая игра" },
  ];
  const index = buildNameIndex(catalog);

  const hit = findMatchByName(
    "Ужас Аркхема. Карточная игра: Забытая эпоха",
    catalog,
    index,
  );
  assert.ok(hit);
  assert.equal(hit.id, 1);

  assert.equal(
    findMatchByName("Несуществующий товар", catalog, index),
    undefined,
  );
});
