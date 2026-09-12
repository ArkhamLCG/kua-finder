import type { CatalogRates, ExchangeRate } from "../retailer-types.js";

const CBR_DAILY_URL = "https://www.cbr-xml-daily.ru/daily_json.js";

type CbrValute = {
  CharCode: string;
  Nominal: number;
  Value: number;
};

type CbrDaily = {
  Date?: string;
  Valute?: Record<string, CbrValute>;
};

function toRate(valute: CbrValute, date: string): ExchangeRate {
  return {
    nominal: valute.Nominal,
    value: valute.Value,
    date,
  };
}

/** Fetch CBR rates needed for foreign-currency display (BYN, KZT). */
export async function fetchCbrRates(): Promise<CatalogRates> {
  const res = await fetch(CBR_DAILY_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch CBR rates: ${res.status}`);
  }

  const data = (await res.json()) as CbrDaily;
  const date = data.Date ?? new Date().toISOString();
  const rates: CatalogRates = {};

  const byn = data.Valute?.BYN;
  if (byn) rates.BYN = toRate(byn, date);

  const kzt = data.Valute?.KZT;
  if (kzt) rates.KZT = toRate(kzt, date);

  return rates;
}

export function convertToRub(
  amount: number,
  rate: ExchangeRate | undefined,
): number | null {
  if (!rate || rate.nominal <= 0) return null;
  return (amount * rate.value) / rate.nominal;
}
