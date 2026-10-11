/** Shop badges that are not part of the product title. */
const STATUS_TOKENS = new Set(["предзаказ", "новинка", "хит", "скоро"]);

/** Normalize product titles for cross-retailer matching. */
export function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.replace(/ё/g, "е")
		.replace(/э/g, "е")
		.normalize("NFKC")
		.replace(/\[[^\]]*\]/g, " ")
		.replace(/[''`´]/g, "")
		.replace(/[^a-z0-9а-я]+/gi, " ")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Shop-specific noise: pack indexes (`№6`, `No.3`), edition years (`2026`),
 * and availability badges (`предзаказ`).
 * Any pure number token is treated as noise so title templates can drift.
 */
export function isNoiseToken(token: string): boolean {
	return (
		token === "no" ||
		token === "n" ||
		STATUS_TOKENS.has(token) ||
		/^(?:no|n)?\d+$/i.test(token)
	);
}

/** Lower = better display title (prefer without edition year). */
export function editionNoiseScore(name: string): number {
	let score = 0;
	if (/\(\s*(?:19|20)\d{2}\s*\)/.test(name)) score += 2;
	if (/(?:^|[\s.,;:–—-])(?:19|20)\d{2}(?:$|[\s.,;:–—-])/.test(name)) {
		score += 1;
	}
	return score;
}

function withoutShopBadge(name: string): string {
	return name
		.replace(/\s*\[[^\]]*\]/g, " ")
		.replace(/\s{2,}/g, " ")
		.trim();
}

function rememberMerge<T extends { id: number; name: string }>(
	preferred: T,
	dropped: T,
	merges: DedupeMerge<T>[],
): void {
	const cleaned = withoutShopBadge(preferred.name);
	if (cleaned && cleaned !== preferred.name) preferred.name = cleaned;
	merges.push({ kept: preferred, dropped });
}

export function pickPreferredProduct<T extends { id: number; name: string }>(
	a: T,
	b: T,
): T {
	const scoreA = editionNoiseScore(a.name);
	const scoreB = editionNoiseScore(b.name);
	if (scoreA !== scoreB) return scoreA < scoreB ? a : b;
	const lenA = tokensOf(a.name).length;
	const lenB = tokensOf(b.name).length;
	if (lenA !== lenB) return lenA > lenB ? a : b;
	return a.id >= b.id ? a : b;
}

export type DedupeMerge<T> = { kept: T; dropped: T };

/** Collapse products that only differ by noise (№N, year, shop badge, infix). */
export function dedupeByMatchKey<T extends { id: number; name: string }>(
	items: T[],
): { products: T[]; merges: DedupeMerge<T>[] } {
	const byKey = new Map<string, T>();
	const keyOrder: string[] = [];
	const merges: DedupeMerge<T>[] = [];
	const passthrough: T[] = [];

	for (const item of items) {
		const key = matchKey(item.name);
		if (!key) {
			passthrough.push(item);
			continue;
		}

		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, item);
			keyOrder.push(key);
			continue;
		}

		const preferred = pickPreferredProduct(existing, item);
		const dropped = preferred.id === existing.id ? item : existing;
		byKey.set(key, preferred);
		rememberMerge(preferred, dropped, merges);
	}

	const exact = keyOrder.map((key) => byKey.get(key)!);
	const loose = collapseLooseDuplicates(exact);
	merges.push(...loose.merges);

	return {
		products: [...loose.products, ...passthrough],
		merges,
	};
}

/**
 * Merge titles that are the same product with a shop-specific infix
 * (`Второй сезон`), but only when the pair is unambiguous.
 */
function collapseLooseDuplicates<T extends { id: number; name: string }>(
	items: T[],
): { products: T[]; merges: DedupeMerge<T>[] } {
	const partners = new Map<number, number[]>();
	for (let i = 0; i < items.length; i++) {
		for (let j = i + 1; j < items.length; j++) {
			if (!titlesLooselyEqual(items[i]!.name, items[j]!.name)) continue;
			const left = partners.get(i) ?? [];
			left.push(j);
			partners.set(i, left);
			const right = partners.get(j) ?? [];
			right.push(i);
			partners.set(j, right);
		}
	}

	const used = new Set<number>();
	const merges: DedupeMerge<T>[] = [];
	for (let i = 0; i < items.length; i++) {
		const peers = partners.get(i) ?? [];
		if (peers.length !== 1 || used.has(i)) continue;
		const j = peers[0]!;
		const back = partners.get(j) ?? [];
		if (back.length !== 1 || back[0] !== i || used.has(j)) continue;
		used.add(i);
		used.add(j);
		const preferred = pickPreferredProduct(items[i]!, items[j]!);
		const dropped = preferred.id === items[i]!.id ? items[j]! : items[i]!;
		rememberMerge(preferred, dropped, merges);
	}

	if (merges.length === 0) return { products: items, merges };

	const droppedIds = new Set(merges.map((merge) => merge.dropped.id));
	const keptById = new Map(merges.map((merge) => [merge.kept.id, merge.kept]));
	const products = items
		.filter((item) => !droppedIds.has(item.id))
		.map((item) => keptById.get(item.id) ?? item);

	return { products, merges };
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

	const hits = haystack.filter(
		(item) =>
			matchKey(item.name) !== key && titlesLooselyEqual(needle, item.name),
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
