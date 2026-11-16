// Publieke menukaart (Pages Functions) tegen een lokale D1.
import { createPagesEventContext, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { onRequestGet as menuPage } from "../functions/index";
import { onRequestGet as qrPage } from "../functions/qr";
import { seed } from "./helpers";

const fakeAssets = (snapshot: unknown | null) =>
  ({
    fetch: async (input: RequestInfo | URL) =>
      String(input).endsWith("/snapshot.json") && snapshot
        ? new Response(JSON.stringify(snapshot), { headers: { "Content-Type": "application/json" } })
        : new Response("not found", { status: 404 })
  }) as unknown as Fetcher;

async function render(url = "https://bimola.pages.dev/", db: D1Database = env.DB, snapshot: unknown = null) {
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
    expect(html).toContain('data-bg="kraft"');
    expect(html).toContain("Sıcak Kahveler");
    expect(html).toContain("Vanilya Latte");
    expect(html).toMatch(/size-label">Küçük<\/span><span class="size-label">Büyük/);
    expect(html).toContain("180 ₺");
    expect(html).toContain("210 ₺");
    expect(html).toContain("30 ₺");
    expect(html).toContain("Alerjen: Süt");
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
    expect((await render("https://bimola.pages.dev/?bg=espresso")).html).toContain('data-bg="espresso"');
    expect((await render("https://bimola.pages.dev/?bg=<x>")).html).toContain('data-bg="kraft"');
  });

  it("valt terug op de momentopname als D1 faalt", async () => {
    const broken = { batch: async () => { throw new Error("D1 down"); } } as unknown as D1Database;
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

  it("QR-pagina gebruikt het vaste adres en het thema", async () => {
    const ctx = createPagesEventContext<typeof qrPage>({
      // Globale test-env heeft PUBLIC_MENU_URL uit wrangler.admin.jsonc.
      request: new Request("https://abc123.bimola.pages.dev/qr"),
      params: {},
      data: {}
    });
    const html = await (await qrPage(ctx)).text();
    expect(html).toContain('value="https://bimola.pages.dev/"');
    expect(html).toContain('data-name="Bi Mola"');
    expect(html).toContain('data-bg="kraft"');
  });
});
