// Beheer-Worker: login/witte lijst, CSRF, menuwijzigingen, versieconflicten, terugdraaien.
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair } from "jose";
import { clearDirectoryCache } from "../src/admin/auth";
import { OWNER, call, json, seed, token } from "./helpers";

beforeEach(async () => {
  await seed();
  clearDirectoryCache();
});

const item = (id: number, state: any) => state.items.find((i: any) => i.id === id);
const state = async (email = OWNER) => json(await call("/api/state", { email }));

describe("toegang", () => {
  it("zonder token: 401", async () => {
    expect((await call("/api/state", { jwt: null })).status).toBe(401);
    expect((await call("/", { jwt: null })).status).toBe(401);
  });

  it("vervalst, verlopen, verkeerde app of uitgever, geen e-mail: 401", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const other = JSON.stringify({ ...(await exportJWK(privateKey)), kid: "test-key" });
    const bad = [
      await token(OWNER, { key: other }),
      await token(OWNER, { expiresIn: Math.floor(Date.now() / 1000) - 60 }),
      await token(OWNER, { aud: "andere-app" }),
      await token(OWNER, { iss: "https://iemand.cloudflareaccess.com" }),
      await token(null),
      "niet.een.token"
    ];
    for (const jwt of bad) expect((await call("/api/state", { jwt })).status).toBe(401);
  });

  it("geldig token maar niet op de lijst: 403, ook voor de pagina", async () => {
    expect((await call("/api/state", { email: "vreemde@gmail.com" })).status).toBe(403);
    const page = await call("/", { email: "vreemde@gmail.com" });
    expect(page.status).toBe(403);
    expect(await page.text()).toContain("erişim izni yok");
  });

  it("eigenaar mag erin, ook via het Access-cookie; e-mail is hoofdletterongevoelig", async () => {
    expect((await call("/api/state", { email: "Owner@Example.com" })).status).toBe(200);
    expect((await call("/api/state", { viaCookie: true })).status).toBe(200);
  });

  it("witte lijst: toevoegen geeft toegang, verwijderen neemt die weg; eigenaar blijft", async () => {
    let r = await call("/api/access/add", { body: { email: " Emre@Gmail.com " } });
    expect(r.status).toBe(200);
    expect((await json(r)).access.admins).toEqual(["emre@gmail.com"]);
    expect((await call("/api/state", { email: "emre@gmail.com" })).status).toBe(200);

    for (const bad of ["", "geen-email", "a@b", "x@y.com, z@q.com", OWNER, "emre@gmail.com"]) {
      expect((await call("/api/access/add", { body: { email: bad } })).status, bad).toBe(400);
    }
    expect((await call("/api/access/remove", { body: { email: OWNER }, email: "emre@gmail.com" })).status).toBe(400);

    r = await call("/api/access/remove", { body: { email: "emre@gmail.com" }, email: "emre@gmail.com" });
    expect(r.status).toBe(200);
    clearDirectoryCache();
    expect((await call("/api/state", { email: "emre@gmail.com" })).status).toBe(403);

    const log = (await state()).log;
    expect(log.map((e: any) => e.summary)).toContain("Erişim eklendi: emre@gmail.com");
    expect(log.find((e: any) => e.entity === "access").revertible).toBe(false);
  });
});

describe("CSRF", () => {
  it("weigert schrijfacties van een ander domein of zonder JSON", async () => {
    const body = { version: 1, available: false };
    expect((await call("/api/items/1/available", { body, origin: "https://kwaad.example" })).status).toBe(403);
    expect((await call("/api/items/1/available", { body, origin: null })).status).toBe(403);
    expect((await call("/api/items/1/available", { body, contentType: "text/plain" })).status).toBe(403);
    expect((await call("/api/items/1/available", { body })).status).toBe(200);
  });
});

describe("menu bewerken", () => {
  it("prijs wijzigen bumpt de versie en logt wie wat deed", async () => {
    const r = await call("/api/items/1", {
      body: { version: 1, categoryId: 1, name: "Vanilya Latte", priceSmall: "185", priceLarge: "215" }
    });
    expect(r.status).toBe(200);
    const s = await json(r);
    expect(item(1, s)).toMatchObject({ price_small: 18500, price_large: 21500, version: 2 });
    expect(s.log[0]).toMatchObject({ actor: OWNER, action: "update", revertible: true });
    expect(s.log[0].summary).toContain("küçük 180 → 185");
    expect(s.log[0].summary).toContain("orta 210 → 215"); // tweede maat heet Orta, niet Büyük
  });

  it("allergeentekst: standaard leeg, per product te zetten, te wissen en terug te draaien", async () => {
    // Oude allergenenlijst in de seed (["Süt"]) telt niet meer mee.
    expect(item(1, await state()).allergen_text).toBe("");
    const base = { categoryId: 1, name: "Vanilya Latte", priceSmall: "180", priceLarge: "210" };

    let s = await json(await call("/api/items/1", { body: { ...base, version: 1, allergenText: "  Alerjen:   Süt " } }));
    expect(item(1, s)).toMatchObject({ allergen_text: "Alerjen: Süt", version: 2 });
    expect(s.log[0].summary).toContain("alerjen metni");

    // De beschikbaarheid-schakelaar laat de tekst staan.
    s = await json(await call("/api/items/1/available", { body: { version: 2, available: false } }));
    expect(item(1, s).allergen_text).toBe("Alerjen: Süt");

    s = await json(await call("/api/items/1", { body: { ...base, version: 3, allergenText: "" } }));
    expect(item(1, s).allergen_text).toBe("");
    await call(`/api/audit/${s.log[0].id}/revert`, { body: {} });
    expect(item(1, await state()).allergen_text).toBe("Alerjen: Süt");

    expect((await call("/api/items/2", { body: { version: 1, categoryId: 1, name: "Mocha", price: "1", allergenText: "x".repeat(401) } })).status).toBe(400);
  });

  it("verouderde versie: 409 en niets gewijzigd", async () => {
    await call("/api/items/2/available", { body: { version: 1, available: false } });
    const r = await call("/api/items/2", { body: { version: 1, categoryId: 1, name: "Mocha X", price: "1" } });
    expect(r.status).toBe(409);
    const s = await state();
    expect(item(2, s)).toMatchObject({ name: "Mocha", available: 0, version: 2 });
    expect(s.log).toHaveLength(1);
  });

  it("valideert invoer", async () => {
    const bad = [
      { version: 1, categoryId: 1, name: "  ", price: "10" },
      { version: 1, categoryId: 1, name: "X" },
      { version: 1, categoryId: 1, name: "X", price: "abc" },
      { version: 1, categoryId: 99, name: "X", price: "10" },
      { version: "1", categoryId: 1, name: "X", price: "10" }
    ];
    for (const b of bad) expect([400, 404], JSON.stringify(b)).toContain((await call("/api/items/3", { body: b })).status);
  });

  it("toevoegen komt onderaan de categorie; verplaatsen blijft binnen de categorie", async () => {
    let s = await json(await call("/api/items", { body: { categoryId: 1, name: "Flat White", priceSmall: "170", priceLarge: "200" } }));
    const fw = s.items.find((i: any) => i.name === "Flat White");
    const order = (st: any) => st.items.filter((i: any) => i.category_id === 1).map((i: any) => i.name);
    expect(order(s)).toEqual(["Vanilya Latte", "Mocha", "Flat White"]);

    s = await json(await call(`/api/items/${fw.id}/move`, { body: { version: fw.version, direction: -1 } }));
    expect(order(s)).toEqual(["Vanilya Latte", "Flat White", "Mocha"]);

    const top = item(1, s);
    s = await json(await call("/api/items/1/move", { body: { version: top.version, direction: -1 } }));
    expect(order(s)).toEqual(["Vanilya Latte", "Flat White", "Mocha"]); // stond al bovenaan
  });

  it("verwijderen gaat naar de prullenbak en kan terug", async () => {
    let s = await json(await call("/api/items/3/delete", { body: { version: 1 } }));
    expect(item(3, s)).toBeUndefined();
    expect(s.trash.map((t: any) => t.id)).toContain(3);
    s = await json(await call("/api/items/3/restore", { body: { version: 2 } }));
    expect(item(3, s)).toMatchObject({ name: "Çay", version: 3 });
  });

  it("categorie met producten kan niet weg; lege wel", async () => {
    expect((await call("/api/categories/2/delete", { body: { version: 1 } })).status).toBe(400);
    await call("/api/items/3/delete", { body: { version: 1 } });
    expect((await call("/api/categories/2/delete", { body: { version: 1 } })).status).toBe(200);
  });

  it("instellingen: alleen bekende sleutels, met versie", async () => {
    let r = await call("/api/settings/phone", { body: { version: 0, value: "0216 000 00 00" } });
    expect(r.status).toBe(200);
    expect((await json(r)).settings.phone).toEqual({ value: "0216 000 00 00", version: 1 });
    expect((await call("/api/settings/phone", { body: { version: 0, value: "x" } })).status).toBe(409);
    expect((await call("/api/settings/hacker", { body: { version: 0, value: "x" } })).status).toBe(400);
  });
});

describe("terugdraaien", () => {
  it("draait een prijswijziging terug, maar niet twee keer", async () => {
    await call("/api/items/3", { body: { version: 1, categoryId: 2, name: "Çay", price: "35" } });
    let s = await state();
    const entry = s.log[0];
    s = await json(await call(`/api/audit/${entry.id}/revert`, { body: {} }));
    expect(item(3, s)).toMatchObject({ price: 3000, version: 3 });
    expect(s.log[0]).toMatchObject({ action: "revert", revertible: false });
    expect(s.log.find((e: any) => e.id === entry.id).revertible).toBe(false);
    expect((await call(`/api/audit/${entry.id}/revert`, { body: {} })).status).toBe(409);
  });

  it("weigert terugdraaien als het product sindsdien opnieuw is gewijzigd", async () => {
    await call("/api/items/3", { body: { version: 1, categoryId: 2, name: "Çay", price: "35" } });
    const first = (await state()).log[0];
    await call("/api/items/3", { body: { version: 2, categoryId: 2, name: "Çay", price: "40" } });
    expect((await call(`/api/audit/${first.id}/revert`, { body: {} })).status).toBe(409);
    expect(item(3, await state()).price).toBe(4000);
  });

  it("toevoegen, verwijderen, verplaatsen en instellingen terugdraaien", async () => {
    await call("/api/items", { body: { categoryId: 2, name: "Bitki Çayı", price: "40" } });
    let s = await state();
    await call(`/api/audit/${s.log[0].id}/revert`, { body: {} });
    expect((await state()).items.some((i: any) => i.name === "Bitki Çayı")).toBe(false);

    await call("/api/items/3/delete", { body: { version: 1 } });
    s = await state();
    await call(`/api/audit/${s.log[0].id}/revert`, { body: {} });
    expect(item(3, await state())).toBeDefined();

    await call("/api/items/2/move", { body: { version: 1, direction: -1 } });
    s = await state();
    expect(s.items.filter((i: any) => i.category_id === 1)[0].name).toBe("Mocha");
    await call(`/api/audit/${s.log[0].id}/revert`, { body: {} });
    expect((await state()).items.filter((i: any) => i.category_id === 1)[0].name).toBe("Vanilya Latte");

    await call("/api/settings/theme", { body: { version: 1, value: "espresso" } });
    s = await state();
    await call(`/api/audit/${s.log[0].id}/revert`, { body: {} });
    expect((await state()).settings.theme.value).toBe("kraft");
  });
});

describe("QR-tabblad", () => {
  it("alleen de eigenaar mag de menulink op de kaartjes wijzigen", async () => {
    let s = await state();
    expect(s.isOwner).toBe(true);
    expect(s.publicMenuUrl).toBe("https://menu.bimolakafe.com/");
    await call("/api/access/add", { body: { email: "emre@gmail.com" } });
    s = await state("emre@gmail.com");
    expect(s.isOwner).toBe(false);
    expect(s.publicMenuUrl).toBe("https://menu.bimolakafe.com/");
  });

  it("geen aparte QR-pagina meer; de beheerpagina mag alleen het vastgepinde QR-script laden", async () => {
    expect((await call("/qr")).status).toBe(404);
    const page = await call("/");
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('data-tab="qr"');
    expect(html).toContain('id="qr-sheet"');
    const csp = page.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js;");
    expect(csp).not.toMatch(/script-src[^;]*https:\/\/cdnjs\.cloudflare\.com[;\s]/); // niet de hele CDN
  });
});

describe("taal (cookie admin_lang)", () => {
  it("foutmeldingen in het Engels, standaard Turks", async () => {
    const body = { version: 1, categoryId: 1, name: "  ", price: "10" };
    expect((await json(await call("/api/items/3", { body }))).error).toBe("Ürün adını yazın.");
    expect((await json(await call("/api/items/3", { body, lang: "en" }))).error).toBe("Enter the item name.");
    const conflict = await call("/api/items/3", { body: { ...body, name: "Çay", version: 9 }, lang: "en" });
    expect(conflict.status).toBe(409);
    expect((await json(conflict)).error).toMatch(/^This record changed in the meantime/);
  });

  it("weigerpagina volgt de taal", async () => {
    const denied = await call("/", { email: "vreemde@gmail.com", lang: "en" });
    expect(denied.status).toBe(403);
    const html = await denied.text();
    expect(html).toContain('<html lang="en"');
    expect(html).toContain("This Google account / e-mail address has no access: vreemde@gmail.com");
    expect(await (await call("/", { email: "vreemde@gmail.com" })).text()).toContain("erişim izni yok");
  });
});
