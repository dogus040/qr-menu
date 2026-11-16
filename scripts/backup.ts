// Backup van de menudata uit D1 (zonder e-mailadressen of log):
//   backup/menu.json      volledige tabellen settings, categories, items (ook prullenbak)
//   public/snapshot.json  het publieke menu; de menukaart toont dit als D1 ooit niet bereikbaar is
//
//   node scripts/backup.ts --remote     (productie; nachtelijks via GitHub Actions)
//   node scripts/backup.ts --local      (lokale ontwikkel-database)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const where = process.argv.includes("--local") ? "--local" : "--remote";

function query<T>(sql: string): T[] {
  const out = execFileSync(
    process.execPath,
    ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "bimola", where, "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }
  );
  const parsed = JSON.parse(out) as { results: T[] }[];
  return parsed[0]?.results ?? [];
}

interface ItemRow {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number | null;
  price_small: number | null;
  price_large: number | null;
  available: number;
  tags: string;
  allergens: string; // oude lijst, niet meer gebruikt; blijft in de backup
  allergen_text: string;
  position: number;
  deleted_at: string | null;
}
interface CategoryRow { id: number; name: string; note: string; visible: number; position: number; deleted_at: string | null }

const settings = query<{ key: string; value: string }>("SELECT key, value FROM settings ORDER BY key");
const categories = query<CategoryRow>("SELECT id, name, note, visible, position, deleted_at FROM categories ORDER BY position, id");
const items = query<ItemRow>(
  `SELECT id, category_id, name, description, price, price_small, price_large, available, tags, allergens, allergen_text, position, deleted_at
     FROM items ORDER BY category_id, position, id`
);

mkdirSync("backup", { recursive: true });
writeFileSync("backup/menu.json", JSON.stringify({ settings, categories, items }, null, 2) + "\n");

const list = (s: string): string[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
const snapshot = {
  settings,
  categories: categories
    .filter((c) => !c.deleted_at && c.visible)
    .map((c) => ({
      id: c.id,
      name: c.name,
      note: c.note,
      items: items
        .filter((i) => i.category_id === c.id && !i.deleted_at && i.available)
        .sort((a, b) => a.position - b.position || a.id - b.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          price: i.price,
          priceSmall: i.price_small,
          priceLarge: i.price_large,
          tags: list(i.tags),
          allergenText: i.allergen_text ?? ""
        }))
    }))
    .filter((c) => c.items.length > 0)
};
writeFileSync("public/snapshot.json", JSON.stringify(snapshot) + "\n");
console.log(`backup: ${settings.length} instellingen, ${categories.length} categorieën, ${items.length} producten`);
