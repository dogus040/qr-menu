// Geldbedragen: intern altijd hele kuruş (integer), op het scherm Turks geformatteerd.
// Bewust zonder imports, zodat ook scripts (node) dit bestand kunnen gebruiken.

const PLAIN = /^\d{1,7}(?:[.,]\d{1,2})?$/;          // 180  180,5  180.50
const THOUSANDS = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/; // 1.250  1.250,50

/** "180" → 18000, "12,50" → 1250, "1.250" → 125000. Leeg → null. Ongeldig → Error. */
export function parsePrice(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) throw new Error("Geçersiz fiyat.");
    return Math.round(input * 100);
  }
  const s = String(input).trim().replace(/\s|₺|tl$/gi, "");
  if (s === "") return null;
  let normalized: string;
  if (THOUSANDS.test(s)) normalized = s.replace(/\./g, "").replace(",", ".");
  else if (PLAIN.test(s)) normalized = s.replace(",", ".");
  else throw new Error("Fiyat sadece rakam olmalı (örnek: 180 veya 12,50).");
  const value = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Geçersiz fiyat.");
  return value;
}

/** 18000 → "180", 1250 → "12,50", 125000 → "1.250". */
export function formatPrice(kurus: number | null | undefined): string {
  if (kurus === null || kurus === undefined) return "";
  const hasFraction = kurus % 100 !== 0;
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2
  }).format(kurus / 100);
}

/** Bedrag met valutateken erachter, Turkse gewoonte: "180 ₺". */
export function formatWithCurrency(kurus: number | null | undefined, currency: string): string {
  const p = formatPrice(kurus);
  if (!p) return "";
  return currency ? `${p} ${currency}` : p;
}
