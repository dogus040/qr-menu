// Eenmalige import: menu + instellingen uit CSV (bijv. de Google Sheet-export) naar SQL voor D1.
//
//   node scripts/seed-from-csv.ts <menu.csv | url> <ayarlar.csv | url> > seed/seed.sql
//   npx wrangler d1 execute bimola --remote --file seed/seed.sql
//
// Leest kolommen op naam (Kategori, Ürün, Açıklama, Fiyat, Küçük, Orta of Büyük, Etiket, Alerjen, Göster).
import { readFile } from "node:fs/promises";
import { parsePrice } from "../src/shared/money.ts";
import { cleanList, cleanText, normalizeKey } from "../src/shared/text.ts";

async function load(source: string): Promise<string> {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
    return res.text();
  }
  return readFile(source, "utf8");
}

/** CSV met aanhalingstekens, komma's en regeleinden binnen cellen (zelfde regels als de oude js/data.js). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const COLUMNS: Record<string, string[]> = {
  kategori: ["kategori"],
  urun: ["urun", "urunadi"],
  aciklama: ["aciklama"],
  fiyat: ["fiyat"],
  kucuk: ["kucuk", "kucukboy"],
  buyuk: ["buyuk", "buyukboy", "orta", "ortaboy"], // tweede maat (Orta), kolom price_large
  etiket: ["etiket", "etiketler"],
  alerjen: ["alerjen", "alerjenler"],
  goster: ["goster", "aktif"]
};

const SETTING_MAP: Record<string, string> = {
  restoranadi: "restaurant_name",
  altbaslik: "subtitle",
  parabirimi: "currency",
  adres: "address",
  telefon: "phone",
  instagram: "instagram",
  calismasaatleri: "hours",
  altnot: "footer_note",
  arkaplan: "theme"
};

const sql = (v: string | number | null): string =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replace(/'/g, "''")}'`;

async function main(): Promise<void> {
  const [menuSrc, settingsSrc] = process.argv.slice(2);
  if (!menuSrc || !settingsSrc) {
    console.error("Gebruik: npm run seed:sql -- <menu.csv|url> <ayarlar.csv|url> > seed/seed.sql");
    // Geen process.exit(): dat laat Node op Windows soms crashen (UV_HANDLE_CLOSING) bij top-level await.
    process.exitCode = 1;
    return;
  }
  const menuRows = parseCsv(await load(menuSrc));
  const header = menuRows[0]!.map(normalizeKey);
  const col = (field: string): number => header.findIndex((h) => COLUMNS[field]!.includes(h));
  const get = (r: string[], field: string): string => (col(field) >= 0 ? (r[col(field)] ?? "").trim() : "");

  const out: string[] = ["-- Gegenereerd door scripts/seed-from-csv.ts", "DELETE FROM items;", "DELETE FROM categories;"];
  const categoryIds = new Map<string, number>();
  const itemPos = new Map<number, number>();
  let nextCategory = 1;

  for (const r of menuRows.slice(1)) {
    const catName = cleanText(get(r, "kategori"), 60);
    if (!catName) continue;
    let catId = categoryIds.get(normalizeKey(catName));
    if (catId === undefined) {
      catId = nextCategory++;
      categoryIds.set(normalizeKey(catName), catId);
      out.push(`INSERT INTO categories (id, name, position) VALUES (${catId}, ${sql(catName)}, ${catId * 10});`);
    }
    const name = cleanText(get(r, "urun"), 80);
    const description = cleanText(get(r, "aciklama"), 200);
    if (!name) {
      // Rij zonder product = notitie bij de categorie.
      if (description) out.push(`UPDATE categories SET note = ${sql(description)} WHERE id = ${catId};`);
      continue;
    }
    const hidden = ["hayir", "h", "0", "false"].includes(normalizeKey(get(r, "goster")));
    const pos = (itemPos.get(catId) ?? 0) + 10;
    itemPos.set(catId, pos);
    out.push(
      `INSERT INTO items (category_id, name, description, price, price_small, price_large, available, tags, allergens, position) VALUES (` +
        [
          catId,
          sql(name),
          sql(description),
          sql(parsePrice(get(r, "fiyat"))),
          sql(parsePrice(get(r, "kucuk"))),
          sql(parsePrice(get(r, "buyuk"))),
          hidden ? 0 : 1,
          sql(JSON.stringify(cleanList(get(r, "etiket")))),
          sql(JSON.stringify(cleanList(get(r, "alerjen")))),
          pos
        ].join(", ") +
        ");"
    );
  }

  for (const r of parseCsv(await load(settingsSrc)).slice(1)) {
    const key = SETTING_MAP[normalizeKey(r[0])];
    if (!key) continue;
    const value = key === "theme" ? normalizeKey(r[1]) : cleanText(r[1], 200);
    out.push(
      `INSERT INTO settings (key, value) VALUES (${sql(key)}, ${sql(value)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value;`
    );
  }
  process.stdout.write(out.join("\n") + "\n");
}

await main();
