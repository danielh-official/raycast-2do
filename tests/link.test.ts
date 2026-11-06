import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPage, parsePage, readTab, samePage } from "../extension/src/link";

const browser = vi.hoisted(() => ({ canAccess: vi.fn(), getTabs: vi.fn(), getContent: vi.fn() }));
vi.mock("@raycast/api", () => ({
  environment: { canAccess: browser.canAccess },
  BrowserExtension: { getTabs: browser.getTabs, getContent: browser.getContent },
}));

describe("samePage", () => {
  it("ignores scheme, www, trailing slash, and fragment", () => {
    expect(samePage("https://www.a.test/book/1/#reviews", "http://a.test/book/1")).toBe(true);
  });

  it("tells different pages and queries apart", () => {
    expect(samePage("https://a.test/book/1", "https://a.test/book/2")).toBe(false);
    expect(samePage("https://a.test/b?x=1", "https://a.test/b?x=2")).toBe(false);
    expect(samePage("about:blank", "not a url")).toBe(false);
  });
});

describe("readTab", () => {
  const tab = { id: 7, url: "https://www.goodreads.com/book/show/1", title: "Tab Title", active: true };
  beforeEach(() => {
    browser.canAccess.mockReset().mockReturnValue(true);
    browser.getTabs.mockReset().mockResolvedValue([tab]);
    browser.getContent
      .mockReset()
      .mockResolvedValue(`<head><title>Book</title><meta name="description" content="About"></head>`);
  });

  it("reads the head of the tab showing the page", async () => {
    await expect(readTab("https://goodreads.com/book/show/1")).resolves.toEqual({
      title: "Book",
      description: "About",
    });
    expect(browser.getContent).toHaveBeenCalledWith({ tabId: 7, cssSelector: "head", format: "html" });
  });

  it("falls back to the tab title", async () => {
    browser.getContent.mockResolvedValue("<head></head>");
    await expect(readTab(tab.url)).resolves.toEqual({ title: "Tab Title", description: "" });
  });

  it("skips without the extension, without a matching tab, or when the browser is unreachable", async () => {
    browser.getTabs.mockResolvedValue([{ ...tab, url: "https://other.test" }]);
    await expect(readTab(tab.url)).resolves.toBeUndefined();
    browser.getTabs.mockRejectedValue(new Error("Could not connect to the Browser Extension"));
    await expect(readTab(tab.url)).resolves.toBeUndefined();
    browser.canAccess.mockReturnValue(false);
    await expect(readTab(tab.url)).resolves.toBeUndefined();
    expect(browser.getTabs).toHaveBeenCalledTimes(2);
  });
});

describe("fetchPage", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (body: string, init?: ResponseInit) =>
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, init)));

  it("returns the parsed page", async () => {
    respond(`<title>Hi</title><meta name="description" content="About">`);
    await expect(fetchPage("https://a.test")).resolves.toEqual({ title: "Hi", description: "About" });
  });

  it("says when the site refuses the request", async () => {
    respond("", { status: 403, statusText: "Forbidden" });
    await expect(fetchPage("https://a.test")).rejects.toThrow(
      "Site refused (403 Forbidden); it may block automated requests",
    );
  });

  it("reports other HTTP errors by status", async () => {
    respond("", { status: 404, statusText: "Not Found" });
    await expect(fetchPage("https://a.test")).rejects.toThrow("404 Not Found");
  });

  it("recognizes an AWS WAF bot check", async () => {
    respond(`<title></title><script>window.awsWafCookieDomainList = [];</script>`, { status: 202 });
    await expect(fetchPage("https://a.test")).rejects.toThrow("Site showed a bot check");
  });

  it("fails when the page has no title", async () => {
    respond(`<html><body><div id="app"></div></body></html>`);
    await expect(fetchPage("https://a.test")).rejects.toThrow("No page title");
  });

  it("explains network errors and timeouts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND a.test") })),
    );
    await expect(fetchPage("https://a.test")).rejects.toThrow("Could not reach site (getaddrinfo ENOTFOUND a.test)");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "TimeoutError")));
    await expect(fetchPage("https://a.test")).rejects.toThrow("Site took over 10 seconds to respond");
  });
});

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
