/** Normalize product titles for cross-retailer matching. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/э/g, "е")
    .normalize("NFKC")
    .replace(/[''`´]/g, "")
    .replace(/[^a-z0-9а-я]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findMatchByName<T extends { name: string }>(
  needle: string,
  haystack: T[],
  index?: Map<string, T>,
): T | undefined {
  const key = normalizeName(needle);
  if (!key) return undefined;

  if (index) return index.get(key);

  return haystack.find((item) => normalizeName(item.name) === key);
}

export function buildNameIndex<T extends { name: string }>(
  items: T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    const key = normalizeName(item.name);
    if (!key || index.has(key)) continue;
    index.set(key, item);
  }
  return index;
}
