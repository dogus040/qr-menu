// Invoercontrole voor de beheer-API (zod) en omzetting naar opslagvorm.
import { z } from "zod";
import { HttpError } from "./env";
import { parsePrice } from "../shared/money";
import { cleanList, cleanText } from "../shared/text";
import type { CategoryData, ItemData } from "./store";

const priceInput = z.union([z.string().max(20), z.number(), z.null()]).optional();

export const itemSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().max(200),
  description: z.string().max(400).optional().default(""),
  price: priceInput,
  priceSmall: priceInput,
  priceLarge: priceInput,
  available: z.boolean().optional().default(true),
  tags: z.array(z.string().max(60)).max(20).optional().default([]),
  allergenText: z.string().max(400).optional().default("")
});

export const categorySchema = z.object({
  name: z.string().max(200),
  note: z.string().max(400).optional().default(""),
  visible: z.boolean().optional().default(true)
});

export const versionSchema = z.object({ version: z.number().int().nonnegative() });
export const moveSchema = versionSchema.extend({ direction: z.union([z.literal(-1), z.literal(1)]) });
export const availableSchema = versionSchema.extend({ available: z.boolean() });
export const settingSchema = versionSchema.extend({ value: z.string().max(400) });
export const emailSchema = z.object({ email: z.string().max(200) });

export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(400, "Geçersiz istek.");
  return r.data;
}

function price(v: unknown): number | null {
  try {
    return parsePrice(v);
  } catch (err) {
    throw new HttpError(400, (err as Error).message);
  }
}

export function toItemData(input: z.infer<typeof itemSchema>): ItemData {
  const name = cleanText(input.name, 80);
  if (!name) throw new HttpError(400, "Ürün adını yazın.");
  const small = price(input.priceSmall);
  const large = price(input.priceLarge);
  const sized = small !== null || large !== null;
  const single = sized ? null : price(input.price);
  if (!sized && single === null) throw new HttpError(400, "Fiyatı yazın.");
  return {
    category_id: input.categoryId,
    name,
    description: cleanText(input.description, 200),
    price: single,
    price_small: small,
    price_large: large,
    available: input.available ? 1 : 0,
    tags: cleanList(input.tags),
    allergen_text: cleanText(input.allergenText, 200)
  };
}

export function toCategoryData(input: z.infer<typeof categorySchema>): CategoryData {
  const name = cleanText(input.name, 60);
  if (!name) throw new HttpError(400, "Kategori adını yazın.");
  return { name, note: cleanText(input.note, 200), visible: input.visible ? 1 : 0 };
}
