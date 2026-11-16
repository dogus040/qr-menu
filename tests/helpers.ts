// Hulpjes voor de tests: Access-tokens tekenen, verzoeken naar de beheer-Worker, testdata.
import { SELF, env } from "cloudflare:test";
import { SignJWT, importJWK } from "jose";

export const ORIGIN = "https://bimola-admin.example.workers.dev";
export const OWNER = "owner@example.com";

export async function token(
  email: string | null,
  opts: { aud?: string; iss?: string; expiresIn?: string | number; key?: string } = {}
): Promise<string> {
  const jwk = JSON.parse(opts.key ?? env.TEST_PRIVATE_JWK);
  const key = await importJWK(jwk, "RS256");
  const jwt = new SignJWT(email ? { email } : {})
    .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
    .setIssuer(opts.iss ?? `https://${env.ACCESS_TEAM_DOMAIN}`)
    .setAudience(opts.aud ?? env.ACCESS_AUD)
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h");
  return jwt.sign(key);
}

export interface CallOpts {
  method?: "GET" | "POST";
  body?: unknown;
  email?: string | null;
  jwt?: string | null;
  origin?: string | null;
  contentType?: string;
  viaCookie?: boolean;
}

export async function call(path: string, opts: CallOpts = {}): Promise<Response> {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const headers = new Headers();
  const jwt = opts.jwt !== undefined ? opts.jwt : await token(opts.email === undefined ? OWNER : opts.email);
  if (jwt) {
    if (opts.viaCookie) headers.set("Cookie", `CF_Authorization=${jwt}`);
    else headers.set("Cf-Access-Jwt-Assertion", jwt);
  }
  if (method === "POST") {
    headers.set("Content-Type", opts.contentType ?? "application/json");
    if (opts.origin !== null) headers.set("Origin", opts.origin ?? ORIGIN);
  }
  return SELF.fetch(`${ORIGIN}${path}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined
  });
}

export async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** Klein testmenu: 2 categorieën, 3 producten, 2 instellingen. */
export async function seed(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM items"),
    env.DB.prepare("DELETE FROM categories"),
    env.DB.prepare("DELETE FROM settings"),
    env.DB.prepare("DELETE FROM audit_log"),
    env.DB.prepare("DELETE FROM dev_admin_emails"),
    env.DB.prepare("INSERT INTO categories (id, name, position) VALUES (1, 'Sıcak Kahveler', 10), (2, 'Çay', 20)"),
    env.DB.prepare(
      `INSERT INTO items (id, category_id, name, price, price_small, price_large, allergens, position) VALUES
        (1, 1, 'Vanilya Latte', NULL, 18000, 21000, '["Süt"]', 10),
        (2, 1, 'Mocha', NULL, 18000, 21000, '[]', 20),
        (3, 2, 'Çay', 3000, NULL, NULL, '[]', 10)`
    ),
    env.DB.prepare("INSERT INTO settings (key, value) VALUES ('restaurant_name', 'Bi Mola'), ('theme', 'kraft')")
  ]);
}
