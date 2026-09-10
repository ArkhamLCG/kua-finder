export type RegionRef = {
  id: number;
  name: string;
};

/** "Hobby Games – Калининград, на …" → "Калининград" */
export function extractCityFromStoreName(name: string): string | null {
  const match = /[–—-]\s*([^,]+)/.exec(name);
  const city = match?.[1]?.trim();
  return city && city.length > 0 ? city : null;
}

export function resolveRegionId(
  storeName: string,
  regions: RegionRef[],
  fallbackRegionId: number,
): number {
  const city = extractCityFromStoreName(storeName);
  if (!city) return fallbackRegionId;

  const exact = regions.find((region) => region.name === city);
  if (exact) return exact.id;

  const partial = regions.find(
    (region) =>
      city.includes(region.name) || region.name.includes(city),
  );
  if (partial) return partial.id;

  return fallbackRegionId;
}
