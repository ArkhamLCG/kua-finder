/** Names that are not Arkham Horror LCG SKUs we want in the catalog. */
export function isExcludedProductName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes("особняк")) return true;
  if (normalized.includes("набор")) return true;
  return false;
}
