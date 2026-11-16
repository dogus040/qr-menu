// Alle schrijfacties op de menudata. Elke wijziging is één D1-transactie (batch):
// de wijziging zelf + een regel in audit_log. Die logregel controleert ook of de
// wijziging precies het verwachte aantal rijen raakte (anders: actor = NULL →
// NOT NULL-fout → hele transactie teruggedraaid). Zo kan een verouderde versie
// (iemand anders was je voor) nooit half of stilletjes worden opgeslagen.
import { HttpError } from "./env";
import { SETTING_DEFAULTS, isSettingKey, type SettingKey } from "../shared/menu";

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const ITEM_JSON = `json_object('id', id, 'category_id', category_id, 'name', name, 'description', description,
  'price', price, 'price_small', price_small, 'price_large', price_large, 'available', available,
  'tags', json(tags), 'allergens', json(allergens), 'position', position, 'version', version, 'deleted_at', deleted_at)`;
const CATEGORY_JSON = `json_object('id', id, 'name', name, 'note', note, 'visible', visible,
  'position', position, 'version', version, 'deleted_at', deleted_at)`;

export interface ItemRow {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number | null;
  price_small: number | null;
  price_large: number | null;
  available: number;
  tags: string[];
  allergens: string[];
  position: number;
  version: number;
  deleted_at: string | null;
}

export interface CategoryRow {
  id: number;
  name: string;
  note: string;
  visible: number;
  position: number;
  version: number;
  deleted_at: string | null;
}

export interface ItemData {
  category_id: number;
  name: string;
  description: string;
  price: number | null;
  price_small: number | null;
  price_large: number | null;
  available: number;
  tags: string[];
  allergens: string[];
}

export interface CategoryData {
  name: string;
  note: string;
  visible: number;
}

type Entity = "item" | "category" | "setting";
const TABLE: Record<"item" | "category", { table: string; json: string }> = {
  item: { table: "items", json: ITEM_JSON },
  category: { table: "categories", json: CATEGORY_JSON }
};

const CONFLICT = "Bu kayıt bu arada değişti (başka biri kaydetmiş olabilir). Liste yenilendi; tekrar deneyin.";

/** Logregel die alleen lukt als de vorige opdracht precies `expected` rijen raakte. */
function guardedAudit(
  db: D1Database,
  expected: number,
  a: { actor: string; action: string; entity: Entity; entityIdSql: string; entityIdArg?: unknown; summary: string; before: unknown; afterSql: string; afterArgs?: unknown[] }
): D1PreparedStatement {
  const sql = `INSERT INTO audit_log (actor, action, entity, entity_id, summary, before_json, after_json)
    SELECT CASE WHEN changes() = ? THEN ? ELSE NULL END, ?, ?, ${a.entityIdSql}, ?, ?, (${a.afterSql})`;
  const args: unknown[] = [expected, a.actor, a.action, a.entity];
  if (a.entityIdArg !== undefined) args.push(a.entityIdArg);
  args.push(a.summary, a.before === null ? null : JSON.stringify(a.before), ...(a.afterArgs ?? []));
  return db.prepare(sql).bind(...args);
}

async function runGuarded(db: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  try {
    return await db.batch(statements);
  } catch (err) {
    if (/NOT NULL constraint failed: audit_log\.actor/i.test(String(err))) throw new HttpError(409, CONFLICT);
    throw err;
  }
}

function itemFromRow(r: Record<string, unknown>): ItemRow {
  const list = (v: unknown): string[] => {
    try {
      const x = typeof v === "string" ? JSON.parse(v) : v;
      return Array.isArray(x) ? x.map(String) : [];
    } catch {
      return [];
    }
  };
  return { ...(r as unknown as ItemRow), tags: list(r.tags), allergens: list(r.allergens) };
}

/* ---------- lezen ---------- */

export async function getItem(db: D1Database, id: number): Promise<ItemRow> {
  const r = await db.prepare("SELECT * FROM items WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!r) throw new HttpError(404, "Ürün bulunamadı.");
  return itemFromRow(r);
}

export async function getCategory(db: D1Database, id: number): Promise<CategoryRow> {
  const r = await db.prepare("SELECT * FROM categories WHERE id = ?").bind(id).first<CategoryRow>();
  if (!r) throw new HttpError(404, "Kategori bulunamadı.");
  return r;
}

async function liveCategory(db: D1Database, id: number): Promise<CategoryRow> {
  const c = await getCategory(db, id);
  if (c.deleted_at) throw new HttpError(400, "Bu kategori silinmiş.");
  return c;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  entity: string;
  summary: string;
  revertible: boolean;
}

export async function getState(db: D1Database) {
  const [cats, items, settings, log, trash] = await db.batch([
    db.prepare("SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY position, id"),
    db.prepare("SELECT * FROM items WHERE deleted_at IS NULL ORDER BY position, id"),
    db.prepare("SELECT key, value, version FROM settings"),
    db.prepare("SELECT id, at, actor, action, entity, summary, reverted_by FROM audit_log ORDER BY id DESC LIMIT 60"),
    db.prepare("SELECT id, name, category_id, version, deleted_at FROM items WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 30")
  ]);
  const settingRows = settings!.results as { key: string; value: string; version: number }[];
  const settingMap = Object.fromEntries(
    (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((k) => {
      const row = settingRows.find((r) => r.key === k);
      return [k, { value: row ? row.value : SETTING_DEFAULTS[k], version: row ? row.version : 0 }];
    })
  );
  return {
    categories: cats!.results as unknown as CategoryRow[],
    items: (items!.results as Record<string, unknown>[]).map(itemFromRow),
    settings: settingMap,
    trash: trash!.results,
    log: (log!.results as (AuditEntry & { reverted_by: number | null })[]).map((e) => ({
      id: e.id,
      at: e.at,
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      summary: e.summary,
      revertible: e.reverted_by === null && e.entity !== "access" && e.action !== "revert"
    }))
  };
}

/* ---------- producten ---------- */

function itemValues(d: ItemData): unknown[] {
  return [
    d.category_id, d.name, d.description, d.price, d.price_small, d.price_large,
    d.available, JSON.stringify(d.tags), JSON.stringify(d.allergens)
  ];
}

export async function createItem(db: D1Database, actor: string, d: ItemData): Promise<number> {
  await liveCategory(db, d.category_id);
  const res = await runGuarded(db, [
    db
      .prepare(
        `INSERT INTO items (category_id, name, description, price, price_small, price_large, available, tags, allergens, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,
                 (SELECT COALESCE(MAX(position), 0) + 10 FROM items WHERE category_id = ? AND deleted_at IS NULL))`
      )
      .bind(...itemValues(d), d.category_id),
    guardedAudit(db, 1, {
      actor, action: "create", entity: "item", entityIdSql: "last_insert_rowid()",
      summary: `Eklendi: ${d.name}`, before: null,
      afterSql: `SELECT ${ITEM_JSON} FROM items WHERE id = last_insert_rowid()`
    }),
    db.prepare("SELECT entity_id AS id FROM audit_log WHERE id = last_insert_rowid()")
  ]);
  return Number((res[2]!.results[0] as { id: string }).id);
}

export async function updateItem(db: D1Database, actor: string, id: number, version: number, d: ItemData): Promise<void> {
  const before = await getItem(db, id);
  if (before.deleted_at || before.version !== version) throw new HttpError(409, CONFLICT);
  if (d.category_id !== before.category_id) await liveCategory(db, d.category_id);
  const moved = d.category_id !== before.category_id;
  await runGuarded(db, [
    db
      .prepare(
        `UPDATE items SET category_id = ?, name = ?, description = ?, price = ?, price_small = ?, price_large = ?,
           available = ?, tags = ?, allergens = ?,
           position = ${moved ? "(SELECT COALESCE(MAX(position), 0) + 10 FROM items WHERE category_id = ? AND deleted_at IS NULL)" : "position"},
           version = version + 1, updated_at = ${NOW}
         WHERE id = ? AND version = ? AND deleted_at IS NULL`
      )
      .bind(...itemValues(d), ...(moved ? [d.category_id] : []), id, version),
    guardedAudit(db, 1, {
      actor, action: "update", entity: "item", entityIdSql: "?", entityIdArg: String(id),
      summary: `Güncellendi: ${d.name}${describeChange(before, d)}`, before,
      afterSql: `SELECT ${ITEM_JSON} FROM items WHERE id = ?`, afterArgs: [id]
    })
  ]);
}

function describeChange(b: ItemRow, d: ItemData): string {
  const parts: string[] = [];
  const fmt = (v: number | null): string => (v === null ? "–" : String(v / 100).replace(".", ","));
  if (b.price !== d.price) parts.push(`fiyat ${fmt(b.price)} → ${fmt(d.price)}`);
  if (b.price_small !== d.price_small) parts.push(`küçük ${fmt(b.price_small)} → ${fmt(d.price_small)}`);
  if (b.price_large !== d.price_large) parts.push(`büyük ${fmt(b.price_large)} → ${fmt(d.price_large)}`);
  if (b.available !== d.available) parts.push(d.available ? "satışta" : "tükendi");
  return parts.length ? ` (${parts.join(", ")})` : "";
}

/** Zet deleted_at (verwijderen = prullenbak) of haalt het weg (terugzetten). */
async function setDeleted(
  db: D1Database, actor: string, entity: "item" | "category", id: number, version: number, deleted: boolean, name: string
): Promise<void> {
  const t = TABLE[entity];
  const before = entity === "item" ? await getItem(db, id) : await getCategory(db, id);
  if (before.version !== version || Boolean(before.deleted_at) === deleted) throw new HttpError(409, CONFLICT);
  await runGuarded(db, [
    db
      .prepare(
        `UPDATE ${t.table} SET deleted_at = ${deleted ? NOW : "NULL"}, version = version + 1, updated_at = ${NOW}
         WHERE id = ? AND version = ?`
      )
      .bind(id, version),
    guardedAudit(db, 1, {
      actor, action: deleted ? "delete" : "restore", entity, entityIdSql: "?", entityIdArg: String(id),
      summary: `${deleted ? "Silindi" : "Geri getirildi"}: ${name}`, before,
      afterSql: `SELECT ${t.json} FROM ${t.table} WHERE id = ?`, afterArgs: [id]
    })
  ]);
}

export async function deleteItem(db: D1Database, actor: string, id: number, version: number): Promise<void> {
  const it = await getItem(db, id);
  await setDeleted(db, actor, "item", id, version, true, it.name);
}

export async function restoreItem(db: D1Database, actor: string, id: number, version: number): Promise<void> {
  const it = await getItem(db, id);
  await liveCategory(db, it.category_id);
  await setDeleted(db, actor, "item", id, version, false, it.name);
}

/** Eén plek omhoog (-1) of omlaag (+1) binnen dezelfde categorie (items) of lijst (categorieën). */
async function move(
  db: D1Database, actor: string, entity: "item" | "category", id: number, version: number, direction: number
): Promise<void> {
  const t = TABLE[entity];
  const cur = entity === "item" ? await getItem(db, id) : await getCategory(db, id);
  if (cur.deleted_at || cur.version !== version) throw new HttpError(409, CONFLICT);
  const up = direction < 0;
  const scope = entity === "item" ? "AND category_id = ?" : "";
  const scopeArgs = entity === "item" ? [(cur as ItemRow).category_id] : [];
  const other = await db
    .prepare(
      `SELECT id, position, version FROM ${t.table}
        WHERE deleted_at IS NULL ${scope} AND (position ${up ? "<" : ">"} ? OR (position = ? AND id ${up ? "<" : ">"} ?))
        ORDER BY position ${up ? "DESC" : "ASC"}, id ${up ? "DESC" : "ASC"} LIMIT 1`
    )
    .bind(...scopeArgs, cur.position, cur.position, cur.id)
    .first<{ id: number; position: number; version: number }>();
  if (!other) return; // staat al bovenaan/onderaan

  // Gelijke posities komen voor bij oude data: dan uit elkaar trekken.
  const curNew = other.position === cur.position ? cur.position + (up ? -1 : 1) : other.position;
  const before = [
    { id: cur.id, position: cur.position, version: cur.version },
    { id: other.id, position: other.position, version: other.version }
  ];
  await runGuarded(db, [
    db
      .prepare(
        `UPDATE ${t.table} SET position = CASE id WHEN ? THEN ? ELSE ? END, version = version + 1, updated_at = ${NOW}
          WHERE (id = ? AND version = ?) OR (id = ? AND version = ?)`
      )
      .bind(cur.id, curNew, cur.position, cur.id, cur.version, other.id, other.version),
    guardedAudit(db, 2, {
      actor, action: "move", entity, entityIdSql: "?", entityIdArg: String(cur.id),
      summary: `Taşındı: ${cur.name} ${up ? "↑" : "↓"}`, before,
      afterSql: `SELECT json_group_array(json_object('id', id, 'position', position, 'version', version)) FROM ${t.table} WHERE id IN (?, ?)`,
      afterArgs: [cur.id, other.id]
    })
  ]);
}

export const moveItem = (db: D1Database, actor: string, id: number, version: number, dir: number) =>
  move(db, actor, "item", id, version, dir);
export const moveCategory = (db: D1Database, actor: string, id: number, version: number, dir: number) =>
  move(db, actor, "category", id, version, dir);

/* ---------- categorieën ---------- */

export async function createCategory(db: D1Database, actor: string, d: CategoryData): Promise<number> {
  const res = await runGuarded(db, [
    db
      .prepare(
        `INSERT INTO categories (name, note, visible, position)
         VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 10 FROM categories WHERE deleted_at IS NULL))`
      )
      .bind(d.name, d.note, d.visible),
    guardedAudit(db, 1, {
      actor, action: "create", entity: "category", entityIdSql: "last_insert_rowid()",
      summary: `Kategori eklendi: ${d.name}`, before: null,
      afterSql: `SELECT ${CATEGORY_JSON} FROM categories WHERE id = last_insert_rowid()`
    }),
    db.prepare("SELECT entity_id AS id FROM audit_log WHERE id = last_insert_rowid()")
  ]);
  return Number((res[2]!.results[0] as { id: string }).id);
}

export async function updateCategory(
  db: D1Database, actor: string, id: number, version: number, d: CategoryData
): Promise<void> {
  const before = await getCategory(db, id);
  if (before.deleted_at || before.version !== version) throw new HttpError(409, CONFLICT);
  await runGuarded(db, [
    db
      .prepare(
        `UPDATE categories SET name = ?, note = ?, visible = ?, version = version + 1, updated_at = ${NOW}
          WHERE id = ? AND version = ? AND deleted_at IS NULL`
      )
      .bind(d.name, d.note, d.visible, id, version),
    guardedAudit(db, 1, {
      actor, action: "update", entity: "category", entityIdSql: "?", entityIdArg: String(id),
      summary: `Kategori güncellendi: ${d.name}`, before,
      afterSql: `SELECT ${CATEGORY_JSON} FROM categories WHERE id = ?`, afterArgs: [id]
    })
  ]);
}

export async function deleteCategory(db: D1Database, actor: string, id: number, version: number): Promise<void> {
  const c = await getCategory(db, id);
  const live = await db
    .prepare("SELECT COUNT(*) AS n FROM items WHERE category_id = ? AND deleted_at IS NULL")
    .bind(id)
    .first<{ n: number }>();
  if ((live?.n ?? 0) > 0) throw new HttpError(400, "Bu kategoride hâlâ ürün var. Önce ürünleri silin veya taşıyın.");
  await setDeleted(db, actor, "category", id, version, true, c.name);
}

/* ---------- instellingen ---------- */

export async function setSetting(
  db: D1Database, actor: string, key: string, value: string, version: number
): Promise<void> {
  if (!isSettingKey(key)) throw new HttpError(400, "Bilinmeyen ayar.");
  const row = await db.prepare("SELECT key, value, version FROM settings WHERE key = ?").bind(key).first<{
    key: string; value: string; version: number;
  }>();
  const before = row ?? { key, value: SETTING_DEFAULTS[key], version: 0 };
  if (before.version !== version) throw new HttpError(409, CONFLICT);
  await runGuarded(db, [
    db
      .prepare(
        `INSERT INTO settings (key, value, version) VALUES (?, ?, 1)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, version = settings.version + 1, updated_at = ${NOW}
         WHERE settings.version = ?`
      )
      .bind(key, value, version),
    guardedAudit(db, 1, {
      actor, action: "update", entity: "setting", entityIdSql: "?", entityIdArg: key,
      summary: `Ayar: ${key} = ${value.slice(0, 60)}`, before,
      afterSql: "SELECT json_object('key', key, 'value', value, 'version', version) FROM settings WHERE key = ?",
      afterArgs: [key]
    })
  ]);
}

/* ---------- toegang (alleen loggen; de lijst zelf staat in Cloudflare Access) ---------- */

export async function logAccess(db: D1Database, actor: string, action: "add" | "remove", email: string): Promise<void> {
  await db
    .prepare("INSERT INTO audit_log (actor, action, entity, entity_id, summary) VALUES (?, ?, 'access', ?, ?)")
    .bind(actor, action, email, `${action === "add" ? "Erişim eklendi" : "Erişim kaldırıldı"}: ${email}`)
    .run();
}

/* ---------- terugdraaien ---------- */

interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entity_id: string;
  summary: string;
  before_json: string | null;
  after_json: string | null;
  reverted_by: number | null;
}

/**
 * Draait één logregel terug, maar alleen als het item sindsdien niet opnieuw is gewijzigd
 * (huidige versie = versie direct na die wijziging). Anders 409.
 */
export async function revert(db: D1Database, actor: string, auditId: number): Promise<void> {
  const a = await db.prepare("SELECT * FROM audit_log WHERE id = ?").bind(auditId).first<AuditRow>();
  if (!a) throw new HttpError(404, "Kayıt bulunamadı.");
  if (a.reverted_by !== null) throw new HttpError(409, "Bu değişiklik zaten geri alındı.");
  if (a.entity === "access" || a.action === "revert") throw new HttpError(400, "Bu değişiklik geri alınamaz.");

  const after = a.after_json ? JSON.parse(a.after_json) : null;
  const before = a.before_json ? JSON.parse(a.before_json) : null;
  const tooLate = new HttpError(409, "Bu kayıt sonradan tekrar değişti; bu adım artık geri alınamaz.");
  const markReverted = db
    .prepare("UPDATE audit_log SET reverted_by = last_insert_rowid() WHERE id = ? AND reverted_by IS NULL")
    .bind(auditId);
  const summary = `Geri alındı: ${a.summary}`;

  if (a.entity === "setting") {
    const cur = await db.prepare("SELECT version FROM settings WHERE key = ?").bind(a.entity_id).first<{ version: number }>();
    if (!cur || cur.version !== after?.version) throw tooLate;
    await runGuarded(db, [
      db
        .prepare(`UPDATE settings SET value = ?, version = version + 1, updated_at = ${NOW} WHERE key = ? AND version = ?`)
        .bind(String(before?.value ?? ""), a.entity_id, cur.version),
      revertAudit(db, actor, a, summary, "SELECT json_object('key', key, 'value', value, 'version', version) FROM settings WHERE key = ?", [a.entity_id]),
      markReverted
    ]);
    return;
  }

  const entity = a.entity as "item" | "category";
  const t = TABLE[entity];
  if (!t) throw new HttpError(400, "Bu değişiklik geri alınamaz.");

  if (a.action === "move") {
    const rows = (after ?? []) as { id: number; position: number; version: number }[];
    const prev = (before ?? []) as { id: number; position: number; version: number }[];
    if (rows.length !== 2 || prev.length !== 2) throw new HttpError(400, "Bu değişiklik geri alınamaz.");
    const [r1, r2] = rows as [typeof rows[0], typeof rows[0]];
    const pos = (id: number) => prev.find((p) => p.id === id)!.position;
    await runGuarded(db, [
      db
        .prepare(
          `UPDATE ${t.table} SET position = CASE id WHEN ? THEN ? ELSE ? END, version = version + 1, updated_at = ${NOW}
            WHERE (id = ? AND version = ?) OR (id = ? AND version = ?)`
        )
        .bind(r1.id, pos(r1.id), pos(r2.id), r1.id, r1.version, r2.id, r2.version),
      revertAudit(db, actor, a, summary, `SELECT json_group_array(json_object('id', id, 'position', position, 'version', version)) FROM ${t.table} WHERE id IN (?, ?)`, [r1.id, r2.id], 2),
      markReverted
    ]);
    return;
  }

  const id = Number(a.entity_id);
  const cur = entity === "item" ? await getItem(db, id) : await getCategory(db, id);
  if (cur.version !== after?.version) throw tooLate;

  let change: D1PreparedStatement;
  if (a.action === "create" || a.action === "restore") {
    change = db.prepare(`UPDATE ${t.table} SET deleted_at = ${NOW}, version = version + 1, updated_at = ${NOW} WHERE id = ? AND version = ?`).bind(id, cur.version);
  } else if (a.action === "delete") {
    change = db.prepare(`UPDATE ${t.table} SET deleted_at = NULL, version = version + 1, updated_at = ${NOW} WHERE id = ? AND version = ?`).bind(id, cur.version);
  } else if (a.action === "update" && entity === "item") {
    const b = before as ItemRow;
    change = db
      .prepare(
        `UPDATE items SET category_id = ?, name = ?, description = ?, price = ?, price_small = ?, price_large = ?,
           available = ?, tags = ?, allergens = ?, position = ?, version = version + 1, updated_at = ${NOW}
         WHERE id = ? AND version = ?`
      )
      .bind(b.category_id, b.name, b.description, b.price, b.price_small, b.price_large, b.available,
        JSON.stringify(b.tags ?? []), JSON.stringify(b.allergens ?? []), b.position, id, cur.version);
  } else if (a.action === "update" && entity === "category") {
    const b = before as CategoryRow;
    change = db
      .prepare(`UPDATE categories SET name = ?, note = ?, visible = ?, version = version + 1, updated_at = ${NOW} WHERE id = ? AND version = ?`)
      .bind(b.name, b.note, b.visible, id, cur.version);
  } else {
    throw new HttpError(400, "Bu değişiklik geri alınamaz.");
  }
  await runGuarded(db, [change, revertAudit(db, actor, a, summary, `SELECT ${t.json} FROM ${t.table} WHERE id = ?`, [id]), markReverted]);
}

function revertAudit(
  db: D1Database, actor: string, a: AuditRow, summary: string, afterSql: string, afterArgs: unknown[], expected = 1
): D1PreparedStatement {
  return guardedAudit(db, expected, {
    actor, action: "revert", entity: a.entity as Entity, entityIdSql: "?", entityIdArg: a.entity_id,
    summary, before: a.after_json ? JSON.parse(a.after_json) : null, afterSql, afterArgs
  });
}
