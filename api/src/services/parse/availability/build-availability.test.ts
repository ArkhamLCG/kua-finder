import assert from "node:assert/strict";
import test from "node:test";
import { buildAvailability, buildCatalogCities } from "./build-availability.js";

test("buildAvailability groups country → city → stores and online", () => {
  const locationsById = new Map([
    [
      1,
      {
        id: 1,
        regionId: 10,
        name: "Hobby Games – Москва",
        address: "ул. 1",
        phone: "+7",
        delivery: false,
        source: "hobbygames" as const,
        country: "RU" as const,
        currency: "RUB" as const,
      },
    ],
    [
      2,
      {
        id: 2,
        regionId: 1_000_015,
        name: "Hobby Games – Минск",
        address: "ул. 2",
        phone: "",
        delivery: false,
        source: "hobbygames_by" as const,
        country: "BY" as const,
        currency: "BYN" as const,
      },
    ],
    [
      3,
      {
        id: 3,
        regionId: 0,
        name: "Лавка игр",
        address: "online",
        phone: "",
        delivery: true,
        source: "lavka" as const,
        country: "RU" as const,
        currency: "RUB" as const,
      },
    ],
  ]);

  const built = buildAvailability({
    stock: [
      { locationId: 1, status: 2, statusText: "2" },
      { locationId: 2, status: 1, statusText: "1", url: "https://by/x" },
      { locationId: 3, status: 1, statusText: "1", url: "https://lavka/x" },
    ],
    locationsById,
    regionNames: new Map([
      [10, "Москва"],
      [1_000_015, "Минск"],
    ]),
    product: {
      price: 1000,
      currency: "RUB",
      url: "https://hobbygames.ru/x",
      priceOffers: [
        {
          source: "hobbygames_by",
          country: "BY",
          currency: "BYN",
          amount: 50,
          url: "https://by/x",
        },
        {
          source: "lavka",
          country: "RU",
          currency: "RUB",
          amount: 1100,
          url: "https://lavka/x",
        },
      ],
    },
  });

  assert.equal(built.countries.length, 2);
  assert.equal(built.countries[0]?.country, "RU");
  assert.equal(built.countries[0]?.cities[0]?.regionName, "Москва");
  assert.equal(built.countries[0]?.cities[0]?.stores[0]?.price, 1000);
  assert.equal(built.countries[1]?.country, "BY");
  assert.equal(built.countries[1]?.cities[0]?.stores[0]?.price, 50);
  assert.equal(built.online.length, 1);
  assert.equal(built.online[0]?.name, "Лавка игр");
  assert.deepEqual(built.summary.onlineCountries, ["RU"]);
  assert.equal(built.summary.hasRub, true);
  assert.equal(built.summary.storeCountByRegion["10"], 1);
});

test("buildCatalogCities skips delivery locations", () => {
  const cities = buildCatalogCities(
    [
      {
        id: 1,
        regionId: 10,
        name: "Shop",
        address: "a",
        phone: "",
        delivery: false,
        country: "RU",
      },
      {
        id: 2,
        regionId: 0,
        name: "Online",
        address: "",
        phone: "",
        delivery: true,
        country: "RU",
      },
    ],
    new Map([[10, "Москва"]]),
  );

  assert.deepEqual(cities, [{ id: 10, name: "Москва", country: "RU" }]);
});
