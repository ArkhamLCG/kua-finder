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

/**
 * Pack/index markers shops insert into titles (`№6`, `No.3`, bare `5`).
 * Stripped so template wording can differ without breaking matches.
 */
export function isNoiseToken(token: string): boolean {
  return token === "no" || token === "n" || /^(?:no|n)?\d+$/i.test(token);
}

/** Match key: normalized title without shop-specific noise tokens. */
export function matchKey(name: string): string {
  return normalizeName(name)
    .split(" ")
    .filter((token) => token.length > 0 && !isNoiseToken(token))
    .join(" ");
}

function tokensOf(name: string): string[] {
  return matchKey(name).split(" ").filter(Boolean);
}

/**
 * True when titles are equal after noise strip, or one is the other with a
 * single contiguous infix/prefix insertion (not a pure suffix — that would
 * wrongly merge a campaign box into its scenario packs).
 */
export function titlesLooselyEqual(a: string, b: string): boolean {
  const left = tokensOf(a);
  const right = tokensOf(b);
  if (left.length === 0 || right.length === 0) return false;
  if (left.length === right.length) {
    return left.every((token, index) => token === right[index]);
  }

  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];
  const gap = longer.length - shorter.length;
  if (gap < 1 || gap > 3) return false;
  if (shorter.length < 5) return false;

  for (let start = 0; start <= longer.length - gap; start++) {
    const end = start + gap;
    const without = [...longer.slice(0, start), ...longer.slice(end)];
    if (!without.every((token, index) => token === shorter[index])) continue;

    // Reject pure suffix extras: "… эпоха" ⊂ "… эпоха расколотая вечность"
    if (end === longer.length) continue;
    return true;
  }

  return false;
}

export function findMatchByName<T extends { name: string }>(
  needle: string,
  haystack: T[],
  index?: Map<string, T>,
): T | undefined {
  const key = matchKey(needle);
  if (!key) return undefined;

  if (index) {
    const exact = index.get(key);
    if (exact) return exact;
  } else {
    const exact = haystack.find((item) => matchKey(item.name) === key);
    if (exact) return exact;
  }

  const pool = index ? [...index.values()] : haystack;
  const hits = pool.filter(
    (item) => item.name !== needle && titlesLooselyEqual(needle, item.name),
  );
  return hits.length === 1 ? hits[0] : undefined;
}

export function buildNameIndex<T extends { name: string }>(
  items: T[],
): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) {
    const key = matchKey(item.name);
    if (!key || index.has(key)) continue;
    index.set(key, item);
  }
  return index;
}
