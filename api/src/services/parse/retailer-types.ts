export type CatalogSource = "hobbygames" | "lavka" | "gaga";

export type ParsedRetailerProduct = {
  id: number;
  price: number;
  name: string;
  image: string | null;
  url: string;
  available: boolean;
};

export const LAVKA_ID_OFFSET = 1_000_000;
export const GAGA_ID_OFFSET = 2_000_000;

export function namespacedProductId(
  source: "lavka" | "gaga",
  retailerId: number,
): number {
  return retailerId + (source === "lavka" ? LAVKA_ID_OFFSET : GAGA_ID_OFFSET);
}
