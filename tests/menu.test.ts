// Publieke menukaart (Pages Functions) tegen een lokale D1.
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestGet as menuPage } from "../functions/index";
import { onRequest as qrGone } from "../functions/qr";
import { onRequest as middleware } from "../functions/_middleware";
import { seed } from "./helpers";

// Roept de middleware aan zoals Pages dat doet; next() = "gewoon doorgaan" (hier een herkenbaar antwoord).
// Standaard-env = productie (geen PAGES_DEV_REDIRECT).
async function viaMiddleware(url: string, pagesEnv: Record<string, string> = {}) {
  let passed = false;
  const res = await middleware({
    request: new Request(url),
    env: pagesEnv,
    next: async () => {
      passed = true;
      return new Response("doorgelaten");
    }
  } as unknown as Parameters<typeof middleware>[0]);
  return { res, passed };
}

describe("oud adres bimola.pages.dev", () => {
  it("stuurt permanent door naar menu.bimolakafe.com, met pad en parameters", async () => {
    for (const [from, to] of [
      ["https://bimola.pages.dev/", "https://menu.bimolakafe.com/"],
      ["https://bimola.pages.dev/?bg=kahve", "https://menu.bimolakafe.com/?bg=kahve"],
      ["https://bimola.pages.dev/yonetim", "https://menu.bimolakafe.com/yonetim"],
      ["https://da6733e4.bimola.pages.dev/css/style.css", "https://menu.bimolakafe.com/css/style.css"]
    ] as const) {
      const { res, passed } = await viaMiddleware(from);
      expect(res.status, from).toBe(301);
      expect(res.headers.get("Location"), from).toBe(to);
      expect(passed).toBe(false);
    }
  });

  it("laat het eigen domein (en lokaal ontwikkelen) gewoon door", async () => {
    for (const url of ["https://menu.bimolakafe.com/", "http://localhost:8788/", "https://evil-bimola.pages.dev.example.com/"]) {
      const { res, passed } = await viaMiddleware(url);
      expect(passed, url).toBe(true);
      expect(await res.text()).toBe("doorgelaten");
    }
  });

  it("stuurt de testomgeving (preview, PAGES_DEV_REDIRECT=off) niet door naar het echte menu", async () => {
    for (const url of ["https://test.bimola.pages.dev/", "https://da6733e4.bimola.pages.dev/?bg=kahve", "https://test.bimolakafe.com/"]) {
      const { res, passed } = await viaMiddleware(url, { PAGES_DEV_REDIRECT: "off" });
      expect(passed, url).toBe(true);
      expect(await res.text()).toBe("doorgelaten");
    }
    // Elke andere waarde telt als "aan": alleen precies "off" zet het uit.
    expect((await viaMiddleware("https://bimola.pages.dev/", { PAGES_DEV_REDIRECT: "0" })).res.status).toBe(301);
  });
});

const fakeAssets = (snapshot: unknown | null) =>
  ({
    fetch: async (input: RequestInfo | URL) =>
      String(input).endsWith("/snapshot.json") && snapshot
        ? new Response(JSON.stringify(snapshot), { headers: { "Content-Type": "application/json" } })
        : new Response("not found", { status: 404 })
  }) as unknown as Fetcher;

async function render(url = "https://menu.bimolakafe.com/", db: D1Database = env.DB, snapshot: unknown = null) {
  // Eigen context: createPagesEventContext gebruikt altijd de globale env.
  const ctx = {
    request: new Request(url),
    env: { DB: db, ASSETS: fakeAssets(snapshot) },
    params: {},
    data: {},
    functionPath: "/",
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(null, { status: 404 })
  } as unknown as Parameters<typeof menuPage>[0];
  const res = await menuPage(ctx);
  return { res, html: await res.text() };
}

describe("menukaart", () => {
  beforeEach(seed);

  it("toont categorieën, producten en twee prijskolommen", async () => {
    const { res, html } = await render();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    // Geen scripts van buiten meer nodig sinds de QR-pagina in de beheer-Worker staat.
    expect(res.headers.get("Content-Security-Policy")).toContain("script-src 'self';");
    expect(html).toContain('data-bg="kraft"');
    expect(html).toContain("Sıcak Kahveler");
    expect(html).toContain("Vanilya Latte");
    expect(html).toMatch(/size-label">Küçük<\/span><span class="size-label">Orta/);
    expect(html).toContain("180 ₺");
    expect(html).toContain("210 ₺");
    expect(html).toContain("30 ₺");
    // De oude allergenenlijst (["Süt"] in de seed) wordt niet meer getoond; de allergeentekst is leeg.
    expect(html).not.toContain("Alerjen");
    expect(html).not.toContain('class="allergens"');
  });

  it("toont de allergeentekst per product zoals ingevuld, ge-escapet", async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE items SET allergen_text = 'Alerjen: Süt' WHERE id = 1"),
      env.DB.prepare("UPDATE items SET allergen_text = '<b>Gluten</b>' WHERE id = 3")
    ]);
    const { html } = await render();
    expect(html).toContain('<span class="allergens">Alerjen: Süt</span>');
    expect(html).toContain("&lt;b&gt;Gluten&lt;/b&gt;");
    expect(html.match(/class="allergens"/g)).toHaveLength(2);
  });

  it("laat uitverkochte producten, verborgen en verwijderde categorieën weg", async () => {
    await env.DB.batch([
      env.DB.prepare("UPDATE items SET available = 0 WHERE id = 2"),
      env.DB.prepare("UPDATE categories SET visible = 0 WHERE id = 2")
    ]);
    const { html } = await render();
    expect(html).not.toContain("Mocha");
    expect(html).not.toContain(">Çay<");
    await env.DB.prepare("UPDATE items SET deleted_at = 'x' WHERE id = 1").run();
    const after = await render();
    expect(after.html).not.toContain("Vanilya Latte");
    expect(after.html).not.toContain("Sıcak Kahveler"); // categorie zonder zichtbare producten
  });

  it("escapet tekst uit de database", async () => {
    await env.DB.prepare("UPDATE items SET name = ?, description = ? WHERE id = 3")
      .bind('<img src=x onerror="alert(1)">', "<script>evil()</script>")
      .run();
    const { html } = await render();
    expect(html).not.toContain("<script>evil");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("?bg= toont een ander thema zonder op te slaan; onzin wordt genegeerd", async () => {
    expect((await render("https://menu.bimolakafe.com/?bg=espresso")).html).toContain('data-bg="espresso"');
    expect((await render("https://menu.bimolakafe.com/?bg=<x>")).html).toContain('data-bg="kraft"');
  });

  it("valt terug op de momentopname als D1 faalt", async () => {
    const broken = { batch: async () => { throw new Error("D1 down"); } } as unknown as D1Database;
    // Oud formaat (allergens-lijst, geen allergenText) moet blijven werken tot de volgende nachtelijke backup.
    const snapshot = {
      settings: [{ key: "restaurant_name", value: "Bi Mola" }],
      categories: [{ id: 1, name: "Reserve", note: "", items: [{ id: 1, name: "Çay", description: "", price: 3000, priceSmall: null, priceLarge: null, tags: [], allergens: [] }] }]
    };
    const ok = await render(undefined, broken, snapshot);
    expect(ok.res.status).toBe(200);
    expect(ok.html).toContain("Reserve");
    const none = await render(undefined, broken, null);
    expect(none.res.status).toBe(503);
  });

  it("/qr is weg: 404 zonder caching (QR-kaartjes staan in de beheerpagina)", async () => {
    const res = await qrGone({} as Parameters<typeof qrGone>[0]);
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
