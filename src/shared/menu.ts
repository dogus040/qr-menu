// Menumodel en het lezen van het (publieke) menu uit D1.
import { normalizeKey } from "./text";

export const THEMES = ["kraft", "kagit", "kahve", "cini", "espresso"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COLORS: Record<Theme, string> = {
  kraft: "#d4b88f",
  kagit: "#fbf7ef",
  kahve: "#f7efe3",
  cini: "#fbf9f4",
  espresso: "#251a14"
};

/** Bekende instellingen met standaardwaarde. Andere sleutels worden genegeerd. */
export const SETTING_DEFAULTS = {
  restaurant_name: "Bi Mola",
  subtitle: "",
  currency: "₺",
  address: "",
  phone: "",
  instagram: "",
  hours: "",
  footer_note: "",
  theme: "kraft",
  size_small_label: "Küçük",
  // Tweede maat. In de database heet die kolom price_large (historisch); de maat zelf is "Orta".
  size_large_label: "Orta"
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;
export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

export function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as string[]).includes(key);
}

export function toTheme(value: string | undefined): Theme {
  const k = normalizeKey(value);
  return (THEMES as readonly string[]).includes(k) ? (k as Theme) : "kraft";
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number | null;
  priceSmall: number | null;
  priceLarge: number | null;
  tags: string[];
  /** Vrije tekst onder het product, bijv. "Alerjen: Süt"; leeg = niets tonen. */
  allergenText: string;
}

export interface MenuCategory {
  id: number;
  name: string;
  note: string;
  items: MenuItem[];
}

export interface PublicMenu {
  settings: Settings;
  categories: MenuCategory[];
}

function parseList(json: unknown): string[] {
  try {
    const v = JSON.parse(String(json ?? "[]"));
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function settingsFromRows(rows: { key: string; value: string }[]): Settings {
  const s: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) if (isSettingKey(r.key)) s[r.key] = r.value;
  return s;
}

interface ItemRow {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number | null;
  price_small: number | null;
  price_large: number | null;
  tags: string;
  allergen_text: string;
}

/** Het menu zoals gasten het zien: alleen zichtbare categorieën en beschikbare producten. */
export async function loadPublicMenu(db: D1Database): Promise<PublicMenu> {
  const [settingRows, categoryRows, itemRows] = await db.batch([
    db.prepare("SELECT key, value FROM settings"),
    db.prepare(
      "SELECT id, name, note FROM categories WHERE deleted_at IS NULL AND visible = 1 ORDER BY position, id"
    ),
    db.prepare(
      `SELECT id, category_id, name, description, price, price_small, price_large, tags, allergen_text
         FROM items WHERE deleted_at IS NULL AND available = 1 ORDER BY position, id`
    )
  ]);

  const categories: MenuCategory[] = (categoryRows!.results as { id: number; name: string; note: string }[]).map(
    (c) => ({ id: c.id, name: c.name, note: c.note, items: [] })
  );
  const byId = new Map(categories.map((c) => [c.id, c]));
  for (const r of itemRows!.results as unknown as ItemRow[]) {
    byId.get(r.category_id)?.items.push({
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      priceSmall: r.price_small,
      priceLarge: r.price_large,
      tags: parseList(r.tags),
      allergenText: r.allergen_text ?? ""
    });
  }

  return {
    settings: settingsFromRows(settingRows!.results as { key: string; value: string }[]),
    categories: categories.filter((c) => c.items.length > 0)
  };
}
