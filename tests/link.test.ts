import { describe, expect, it } from "vitest";
import { parsePage } from "../extension/src/link";

describe("parsePage", () => {
  it("reads the title and meta description", () => {
    const html = `<html><head><title>Example Domain</title><meta name="description" content="An example page."></head></html>`;
    expect(parsePage(html)).toEqual({ title: "Example Domain", description: "An example page." });
  });

  it("matches attributes in any order, case, and quote style", () => {
    const html = `<TITLE>T</TITLE><META content='From content first' NAME='Description'>`;
    expect(parsePage(html).description).toBe("From content first");
  });

  it("falls back to Open Graph, then Twitter tags", () => {
    expect(
      parsePage(`<meta property="og:title" content="OG"><meta property="og:description" content="OG desc">`),
    ).toEqual({ title: "OG", description: "OG desc" });
    expect(parsePage(`<meta name="twitter:description" content="Tw">`).description).toBe("Tw");
  });

  it("prefers the plain description over Open Graph", () => {
    const html = `<meta property="og:description" content="OG"><meta name="description" content="Plain">`;
    expect(parsePage(html).description).toBe("Plain");
  });

  it("decodes entities and collapses whitespace", () => {
    const html = `<title>\n  Tom &amp; Jerry &#8211; &#x1F600;\n</title><meta name="description" content="&quot;Hi&quot;   there">`;
    expect(parsePage(html)).toEqual({ title: "Tom & Jerry – 😀", description: '"Hi" there' });
  });

  it("returns empty strings when the page has neither", () => {
    expect(parsePage("<html><body>Hello</body></html>")).toEqual({ title: "", description: "" });
  });
});
