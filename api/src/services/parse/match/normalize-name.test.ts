import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildNameIndex,
  findMatchByName,
  matchKey,
  normalizeName,
  titlesLooselyEqual,
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

test("matchKey drops pack number markers like №6", () => {
  assert.equal(
    matchKey(
      "Ужас Аркхэма. Карточная игра: Забытая эпоха №6. Расколотая вечность",
    ),
    matchKey(
      "Ужас Аркхэма. Карточная игра: Забытая эпоха. Расколотая вечность",
    ),
  );
  assert.equal(
    matchKey("Забытая эпоха No.5 Глубины Йота"),
    matchKey("Забытая эпоха Глубины Йота"),
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

test("findMatchByName ignores №N inserted by another shop", () => {
  const catalog = [
    {
      id: 76166,
      name: "Ужас Аркхэма. Карточная игра: Забытая эпоха. Расколотая вечность",
    },
  ];
  const index = buildNameIndex(catalog);
  const hit = findMatchByName(
    "Ужас Аркхэма. Карточная игра: Забытая эпоха №6. Расколотая вечность",
    catalog,
    index,
  );
  assert.ok(hit);
  assert.equal(hit.id, 76166);
});

test("titlesLooselyEqual allows missing cycle prefix, not campaign⊂scenario", () => {
  assert.equal(
    titlesLooselyEqual(
      "Ужас Аркхэма. Карточная игра: Потерянные во времени и пространстве",
      "Ужас Аркхэма. Карточная игра: Наследие Данвича. Потерянные во времени и пространстве",
    ),
    true,
  );

  assert.equal(
    titlesLooselyEqual(
      "Ужас Аркхэма. Карточная игра: Забытая эпоха",
      "Ужас Аркхэма. Карточная игра: Забытая эпоха. Расколотая вечность",
    ),
    false,
  );
});
