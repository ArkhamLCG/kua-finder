import { CATEGORY_URL } from "../../../config.js";
import { MAP_PATH } from "./config.js";

const MAP_URL = `${new URL(CATEGORY_URL).origin}${MAP_PATH}`;

export type ParsedRegion = {
  id: number;
  name: string;
};

type MapPoint = {
  name: string;
  hidden?: {
    method?: number;
    address?: string;
  };
};

type MapResponse = {
  points?: MapPoint[];
};

function regionName(point: MapPoint): string {
  const match = /[–—-]\s*([^,]+)/.exec(point.name);
  return (match?.[1] ?? point.name).trim();
}

export async function parseRegions(): Promise<ParsedRegion[]> {
  const res = await fetch(MAP_URL, {
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch regions map: ${res.status}`);
  }

  const data = (await res.json()) as MapResponse;
  const byId = new Map<number, ParsedRegion>();

  for (const point of data.points ?? []) {
    const id = Number(point.hidden?.method);
    if (!id || byId.has(id)) continue;

    byId.set(id, {
      id,
      name: regionName(point),
    });
  }

  return [...byId.values()].sort((a, b) => a.id - b.id);
}
