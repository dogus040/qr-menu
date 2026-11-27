// Snelheidslimieten van de beheer-Worker. De echte Cloudflare-limiter telt per locatie en per minuut;
// hier nep-limiters, zodat we precies weten wanneer hij "nee" zegt en met welke sleutel.
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import app from "../src/admin/index";
import type { Limiter } from "../src/admin/env";
import { clearDirectoryCache } from "../src/admin/auth";
import { ORIGIN, OWNER, seed, token } from "./helpers";

beforeEach(async () => {
  await seed();
  clearDirectoryCache();
});

/** Onthoudt elke sleutel en weigert vanaf de (max+1)-de keer per sleutel. */
function fakeLimiter(max: number) {
  const keys: string[] = [];
  const limiter: Limiter = {
    limit: async ({ key }) => {
      keys.push(key);
      return { success: keys.filter((k) => k === key).length <= max };
    }
  };
  return { limiter, keys };
}

interface SendOpts {
  method?: "GET" | "POST";
  email?: string;
  jwt?: string | null;
  ip?: string;
  body?: unknown;
  lang?: "tr" | "en";
  ipLimiter?: Limiter;
  accountLimiter?: Limiter;
}

async function send(path: string, o: SendOpts = {}): Promise<Response> {
  const headers = new Headers();
  const jwt = o.jwt !== undefined ? o.jwt : await token(o.email ?? OWNER);
  if (jwt) headers.set("Cf-Access-Jwt-Assertion", jwt);
  if (o.ip) headers.set("CF-Connecting-IP", o.ip);
  if (o.lang) headers.set("Cookie", `admin_lang=${o.lang}`);
  let body: string | undefined;
  if (o.method === "POST") {
    headers.set("Content-Type", "application/json");
    headers.set("Origin", ORIGIN);
    body = JSON.stringify(o.body ?? {});
  }
  const req = new Request(`${ORIGIN}${path}`, { method: o.method ?? "GET", headers, body });
  return app.fetch(req, { ...env, RATE_LIMIT_IP: o.ipLimiter, RATE_LIMIT_ACCOUNT: o.accountLimiter });
}

const version = async (id: number) =>
  (await env.DB.prepare("SELECT version, available FROM items WHERE id = ?").bind(id).first<{ version: number; available: number }>())!;

describe("snelheidslimiet per IP", () => {
  it("na de limiet 429 met Retry-After, ook vóór de login-controle; een ander IP gaat gewoon door", async () => {
    const { limiter, keys } = fakeLimiter(2);
    const ip = "203.0.113.9";
    expect((await send("/api/state", { ip, ipLimiter: limiter })).status).toBe(200);
    expect((await send("/api/state", { ip, ipLimiter: limiter })).status).toBe(200);

    const blocked = await send("/api/state", { ip, ipLimiter: limiter });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(blocked.headers.get("Cache-Control")).toBe("no-store");
    expect(((await blocked.json()) as { error: string }).error).toBe("Çok fazla istek. Bir dakika bekleyip tekrar deneyin.");

    // Zonder token: de limiet komt vóór de login (geen 401, en de JWT-controle wordt niet eens gedaan).
    expect((await send("/api/state", { ip, jwt: null, ipLimiter: limiter })).status).toBe(429);
    // De pagina zelf: HTML-foutpagina in de gekozen taal.
    const page = await send("/", { ip, lang: "en", ipLimiter: limiter });
    expect(page.status).toBe(429);
    expect(await page.text()).toContain("Too many requests.");

    expect((await send("/api/state", { ip: "198.51.100.7", ipLimiter: limiter })).status).toBe(200);
    expect(new Set(keys)).toEqual(new Set(["ip:203.0.113.9", "ip:198.51.100.7"]));
  });
});

describe("snelheidslimiet per account", () => {
  it("alleen wijzigingen tellen; sleutel = e-mail in kleine letters; een geweigerde wijziging verandert niets", async () => {
    const { limiter, keys } = fakeLimiter(1);
    expect((await send("/api/state", { accountLimiter: limiter })).status).toBe(200);
    expect((await send("/api/state", { accountLimiter: limiter })).status).toBe(200);
    expect(keys).toEqual([]);

    const before = await version(2);
    const ok = await send("/api/items/2/available", {
      method: "POST", email: "Owner@Example.com", body: { version: before.version, available: false }, accountLimiter: limiter
    });
    expect(ok.status).toBe(200);
    const after = await version(2);
    expect(after.available).toBe(0);

    const blocked = await send("/api/items/2/available", {
      method: "POST", body: { version: after.version, available: true }, accountLimiter: limiter
    });
    expect(blocked.status).toBe(429);
    expect(await version(2)).toEqual(after);
    expect(keys).toEqual(["account:owner@example.com", "account:owner@example.com"]);
  });
});

describe("limiter zelf faalt", () => {
  it("dan gaat het verzoek gewoon door (beschikbaarheid boven een strenge telling)", async () => {
    const broken: Limiter = { limit: async () => { throw new Error("rate limiter onbereikbaar"); } };
    expect((await send("/api/state", { ip: "203.0.113.9", ipLimiter: broken, accountLimiter: broken })).status).toBe(200);
    const v = await version(2);
    const res = await send("/api/items/2/available", {
      method: "POST", body: { version: v.version, available: false }, ipLimiter: broken, accountLimiter: broken
    });
    expect(res.status).toBe(200);
  });
});
