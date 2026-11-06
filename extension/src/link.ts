export type PageInfo = { title: string; description: string };

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string) {
  return s
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (m, e: string) => {
      if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
      return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    })
    .replace(/\s+/g, " ")
    .trim();
}

// Title from <title>, then og:title. Description from the meta tags pages set for search results
// and link previews; empty when the page has none.
export function parsePage(html: string): PageInfo {
  const meta: Record<string, string> = {};
  for (const [tag] of html.matchAll(/<meta\s[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(([, k, d, s]) => [k.toLowerCase(), d ?? s]),
    );
    const key = (attrs.name ?? attrs.property)?.toLowerCase();
    if (key && attrs.content && !(key in meta)) meta[key] = decode(attrs.content);
  }
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return {
    title: title || meta["og:title"] || "",
    description: meta["description"] || meta["og:description"] || meta["twitter:description"] || "",
  };
}

export async function fetchPage(url: string): Promise<PageInfo> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { Accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return parsePage(await res.text());
}
