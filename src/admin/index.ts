// Beheer-Worker (admin, https://admin.bimola.workers.dev): JSON-API + beheerpagina, volledig achter Cloudflare Access.
import { Hono, type Context } from "hono";
import { HttpError, type AdminEnv } from "./env";
import { EMAIL_RE, MAX_ADMINS, allowedEmails, clearDirectoryCache, directory, isAllowed, ownerEmails, verifyAccess } from "./auth";
import * as store from "./store";
import { langOf, translate } from "./i18n";
import {
  availableSchema, categorySchema, emailSchema, itemSchema, moveSchema, parseBody, settingSchema,
  toCategoryData, toItemData, versionSchema
} from "./schemas";

type App = { Bindings: AdminEnv; Variables: { email: string } };
const app = new Hono<App>();

// QR-tabblad: qrcode-generator van cdnjs. Alleen dit ene bestand mag; app.js laadt het met een SRI-hash.
const QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";

const CSP = [
  "default-src 'self'",
  `script-src 'self' ${QR_LIB}`,
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join("; ");

// Beveiligingsheaders op elk antwoord (ook statische bestanden).
app.use("*", async (c, next) => {
  await next();
  const res = new Response(c.res.body, c.res);
  if (!res.headers.has("Content-Security-Policy")) res.headers.set("Content-Security-Policy", CSP);
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.headers.set("Cache-Control", "no-store");
  c.res = res;
});

// 1) Geldig Access-token, 2) e-mail op de witte lijst. Geldt voor álles, ook de pagina zelf.
app.use("*", async (c, next) => {
  const email = await verifyAccess(c.req.raw, c.env);
  if (!(await isAllowed(c.env, email))) throw new HttpError(403, `Bu Google hesabının / e-posta adresinin erişim izni yok: ${email}`);
  c.set("email", email);
  await next();
});

// CSRF: schrijfacties alleen als JSON vanaf deze eigen pagina.
app.use("/api/*", async (c, next) => {
  if (c.req.method !== "GET") {
    const type = c.req.header("Content-Type") ?? "";
    const origin = c.req.header("Origin");
    const site = c.req.header("Sec-Fetch-Site");
    const self = new URL(c.req.url).origin;
    const sameOrigin = origin ? origin === self : site === "same-origin";
    if (!type.startsWith("application/json") || !sameOrigin) throw new HttpError(403, "İstek reddedildi.");
  }
  await next();
});

async function body(c: Context<App>): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new HttpError(400, "Geçersiz istek.");
  }
}

function idParam(c: Context<App>): number {
  const id = Number(c.req.param("id"));
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, "Geçersiz numara.");
  return id;
}

async function stateResponse(c: Context<App>) {
  const state = await store.getState(c.env.DB);
  let admins: string[] = [];
  let accessError = "";
  try {
    admins = await allowedEmails(c.env);
  } catch (err) {
    accessError = translate(err instanceof HttpError ? err.message : "Erişim listesi yüklenemedi.", langOf(c.req.raw));
  }
  return c.json({
    ...state,
    me: c.get("email"),
    // Eigenaar (OWNER_EMAILS): mag o.a. de menulink op de QR-kaartjes wijzigen.
    isOwner: ownerEmails(c.env).includes(c.get("email").toLowerCase()),
    access: {
      owners: ownerEmails(c.env),
      admins: admins.filter((e) => !ownerEmails(c.env).includes(e)),
      managed: directory(c.env) !== null,
      error: accessError
    },
    publicMenuUrl: c.env.PUBLIC_MENU_URL ?? ""
  });
}

/* ---------- API ---------- */

app.get("/api/state", (c) => stateResponse(c));

app.post("/api/items", async (c) => {
  await store.createItem(c.env.DB, c.get("email"), toItemData(parseBody(itemSchema, await body(c))));
  return stateResponse(c);
});

app.post("/api/items/:id", async (c) => {
  const b = await body(c);
  const { version } = parseBody(versionSchema, b);
  await store.updateItem(c.env.DB, c.get("email"), idParam(c), version, toItemData(parseBody(itemSchema, b)));
  return stateResponse(c);
});

app.post("/api/items/:id/available", async (c) => {
  const { version, available } = parseBody(availableSchema, await body(c));
  const id = idParam(c);
  const it = await store.getItem(c.env.DB, id);
  await store.updateItem(c.env.DB, c.get("email"), id, version, {
    category_id: it.category_id, name: it.name, description: it.description, price: it.price,
    price_small: it.price_small, price_large: it.price_large, available: available ? 1 : 0,
    tags: it.tags, allergen_text: it.allergen_text
  });
  return stateResponse(c);
});

app.post("/api/items/:id/delete", async (c) => {
  const { version } = parseBody(versionSchema, await body(c));
  await store.deleteItem(c.env.DB, c.get("email"), idParam(c), version);
  return stateResponse(c);
});

app.post("/api/items/:id/restore", async (c) => {
  const { version } = parseBody(versionSchema, await body(c));
  await store.restoreItem(c.env.DB, c.get("email"), idParam(c), version);
  return stateResponse(c);
});

app.post("/api/items/:id/move", async (c) => {
  const { version, direction } = parseBody(moveSchema, await body(c));
  await store.moveItem(c.env.DB, c.get("email"), idParam(c), version, direction);
  return stateResponse(c);
});

app.post("/api/categories", async (c) => {
  await store.createCategory(c.env.DB, c.get("email"), toCategoryData(parseBody(categorySchema, await body(c))));
  return stateResponse(c);
});

app.post("/api/categories/:id", async (c) => {
  const b = await body(c);
  const { version } = parseBody(versionSchema, b);
  await store.updateCategory(c.env.DB, c.get("email"), idParam(c), version, toCategoryData(parseBody(categorySchema, b)));
  return stateResponse(c);
});

app.post("/api/categories/:id/delete", async (c) => {
  const { version } = parseBody(versionSchema, await body(c));
  await store.deleteCategory(c.env.DB, c.get("email"), idParam(c), version);
  return stateResponse(c);
});

app.post("/api/categories/:id/move", async (c) => {
  const { version, direction } = parseBody(moveSchema, await body(c));
  await store.moveCategory(c.env.DB, c.get("email"), idParam(c), version, direction);
  return stateResponse(c);
});

app.post("/api/settings/:key", async (c) => {
  const { version, value } = parseBody(settingSchema, await body(c));
  await store.setSetting(c.env.DB, c.get("email"), c.req.param("key"), value.trim().slice(0, 200), version);
  return stateResponse(c);
});

app.post("/api/audit/:id/revert", async (c) => {
  await store.revert(c.env.DB, c.get("email"), idParam(c));
  return stateResponse(c);
});

app.post("/api/access/add", async (c) => {
  const dir = directory(c.env);
  if (!dir) throw new HttpError(400, "Erişim listesi henüz bağlanmadı.");
  const email = parseBody(emailSchema, await body(c)).email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "Geçerli bir e-posta adresi yazın.");
  if (ownerEmails(c.env).includes(email)) throw new HttpError(400, "Bu adres sahibine ait ve zaten her zaman erişebilir.");
  const current = await allowedEmails(c.env);
  if (current.includes(email)) throw new HttpError(400, "Bu adres zaten listede.");
  if (current.length >= MAX_ADMINS) throw new HttpError(400, `Liste dolu (en fazla ${MAX_ADMINS}).`);
  await dir.add(email, c.get("email"));
  clearDirectoryCache();
  await store.logAccess(c.env.DB, c.get("email"), "add", email);
  return stateResponse(c);
});

app.post("/api/access/remove", async (c) => {
  const dir = directory(c.env);
  if (!dir) throw new HttpError(400, "Erişim listesi henüz bağlanmadı.");
  const email = parseBody(emailSchema, await body(c)).email.trim().toLowerCase();
  if (ownerEmails(c.env).includes(email)) throw new HttpError(400, "Sahibin erişimi kaldırılamaz.");
  await dir.remove(email);
  clearDirectoryCache();
  await store.logAccess(c.env.DB, c.get("email"), "remove", email);
  return stateResponse(c);
});

app.all("/api/*", () => {
  throw new HttpError(404, "Bulunamadı.");
});

// Beheerpagina (statische bestanden in admin-public/), pas na de controles hierboven.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((err, c) => {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500 && !(err instanceof HttpError)) console.error(err);
  const lang = langOf(c.req.raw);
  const message = translate(err instanceof HttpError ? err.message : "Beklenmeyen bir hata oluştu.", lang);
  if (new URL(c.req.url).pathname.startsWith("/api/")) return c.json({ error: message }, status);
  const title = lang === "en" ? "Bi Mola · Admin" : "Bi Mola · Yönetim";
  const other = lang === "en" ? "Log in with another account" : "Başka hesapla giriş yap";
  const page = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family: Georgia, serif; max-width: 520px; margin: 15vh auto; padding: 0 16px; text-align: center; color: #26190c; background: #d4b88f;">
<h1 style="font-weight: 500;">${title}</h1><p>${message.replace(/[&<>"']/g, "")}</p>
<p><a href="/cdn-cgi/access/logout" style="color: #7a2814;">${other}</a></p></body></html>`;
  // Eigen CSP: alleen inline-stijl, geen scripts (de gewone CSP zou de opmaak blokkeren).
  return c.html(page, status, { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" });
});

export default app;
