// Inloggen loopt via Cloudflare Access. Deze code controleert het Access-token
// (handtekening, app, uitgever, geldigheid) en of het e-mailadres op de witte lijst staat.
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { HttpError, type AdminEnv } from "./env";

const remoteJwks = new Map<string, JWTVerifyGetKey>();

function keySet(env: AdminEnv): JWTVerifyGetKey {
  if (env.ACCESS_JWKS_JSON) return createLocalJWKSet(JSON.parse(env.ACCESS_JWKS_JSON));
  const url = `https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
  let set = remoteJwks.get(url);
  if (!set) {
    set = createRemoteJWKSet(new URL(url));
    remoteJwks.set(url, set);
  }
  return set;
}

function readToken(request: Request): string | null {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header;
  const cookie = request.headers.get("Cookie") ?? "";
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  return m ? decodeURIComponent(m[1]!) : null;
}

/** Geeft het (kleine letters) e-mailadres uit een geldig Access-token, anders HttpError 401. */
export async function verifyAccess(request: Request, env: AdminEnv): Promise<string> {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    // Zonder configuratie niemand binnenlaten.
    throw new HttpError(500, "Beheer is nog niet ingesteld (Access).");
  }
  const token = readToken(request);
  if (!token) throw new HttpError(401, "Giriş yapılmadı.");
  try {
    const { payload } = await jwtVerify(token, keySet(env), {
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"]
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) throw new Error("geen e-mail in token");
    return email;
  } catch {
    throw new HttpError(401, "Oturumun süresi doldu. Sayfayı yenileyip tekrar giriş yapın.");
  }
}

/* ---------- witte lijst ---------- */

export const EMAIL_RE = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[a-z]{2,}$/i;
export const MAX_ADMINS = 50;

export function ownerEmails(env: AdminEnv): string[] {
  return (env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export interface Directory {
  list(): Promise<string[]>;
  add(email: string, actor: string): Promise<void>;
  remove(email: string): Promise<void>;
}

type AccessRule = { email?: { email: string } } & Record<string, unknown>;
interface AccessGroup {
  name: string;
  include: AccessRule[];
  exclude?: AccessRule[];
  require?: AccessRule[];
}

/** Witte lijst = Cloudflare Access-groep; Access zelf houdt vreemden al bij de poort tegen. */
class AccessGroupDirectory implements Directory {
  constructor(
    private readonly accountId: string,
    private readonly groupId: string,
    private readonly token: string
  ) {}

  private url(): string {
    return `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/access/groups/${this.groupId}`;
  }

  private async call(init?: RequestInit): Promise<AccessGroup> {
    const res = await fetch(this.url(), {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }
    });
    const body = (await res.json().catch(() => null)) as { success?: boolean; result?: AccessGroup } | null;
    if (!res.ok || !body?.success || !body.result) {
      console.error("Access API", res.status, JSON.stringify(body)?.slice(0, 500));
      throw new HttpError(502, "Cloudflare Access is nu niet bereikbaar. Probeer het opnieuw.");
    }
    return body.result;
  }

  async list(): Promise<string[]> {
    const g = await this.call();
    return g.include.flatMap((r) => (r.email?.email ? [r.email.email.toLowerCase()] : []));
  }

  private async save(g: AccessGroup, include: AccessRule[]): Promise<void> {
    await this.call({
      method: "PUT",
      body: JSON.stringify({ name: g.name, include, exclude: g.exclude ?? [], require: g.require ?? [] })
    });
  }

  async add(email: string): Promise<void> {
    const g = await this.call();
    if (g.include.some((r) => r.email?.email?.toLowerCase() === email)) return;
    await this.save(g, [...g.include, { email: { email } }]);
  }

  async remove(email: string): Promise<void> {
    const g = await this.call();
    await this.save(g, g.include.filter((r) => r.email?.email?.toLowerCase() !== email));
  }
}

/** Alleen lokaal/tests. */
class D1Directory implements Directory {
  constructor(private readonly db: D1Database) {}
  async list(): Promise<string[]> {
    const r = await this.db.prepare("SELECT email FROM dev_admin_emails ORDER BY added_at").all<{ email: string }>();
    return r.results.map((x) => x.email);
  }
  async add(email: string, actor: string): Promise<void> {
    await this.db.prepare("INSERT OR IGNORE INTO dev_admin_emails (email, added_by) VALUES (?, ?)").bind(email, actor).run();
  }
  async remove(email: string): Promise<void> {
    await this.db.prepare("DELETE FROM dev_admin_emails WHERE email = ?").bind(email).run();
  }
}

export function directory(env: AdminEnv): Directory | null {
  if (env.ACCESS_ACCOUNT_ID && env.ACCESS_GROUP_ID && env.CF_API_TOKEN) {
    return new AccessGroupDirectory(env.ACCESS_ACCOUNT_ID, env.ACCESS_GROUP_ID, env.CF_API_TOKEN);
  }
  if (env.ACCESS_DIRECTORY === "d1") return new D1Directory(env.DB);
  return null; // alleen eigenaar(s)
}

// Korte cache zodat niet elke aanvraag de Cloudflare API raakt.
let cache: { at: number; emails: string[] } | null = null;
const CACHE_MS = 60_000;

export function clearDirectoryCache(): void {
  cache = null;
}

export async function allowedEmails(env: AdminEnv): Promise<string[]> {
  const dir = directory(env);
  if (!dir) return [];
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.emails;
  const emails = await dir.list();
  cache = { at: Date.now(), emails };
  return emails;
}

export async function isAllowed(env: AdminEnv, email: string): Promise<boolean> {
  if (ownerEmails(env).includes(email)) return true;
  return (await allowedEmails(env)).includes(email);
}
