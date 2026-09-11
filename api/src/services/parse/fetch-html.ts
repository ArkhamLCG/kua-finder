const CHARSET_ALIASES: Record<string, string> = {
  cp1251: "windows-1251",
  "windows-1251": "windows-1251",
  utf8: "utf-8",
  "utf-8": "utf-8",
};

/** Fetch HTML and decode using Content-Type charset (GaGa serves cp1251). */
export async function fetchHtml(
  url: string,
  init?: RequestInit,
): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; kua-finder/0.1; +https://github.com/)",
      accept: "text/html",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "";
  const raw =
    /charset=([^\s;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase() ??
    "utf-8";
  const charset = CHARSET_ALIASES[raw] ?? raw;

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
}
