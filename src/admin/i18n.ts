// Taal van de beheerpagina: Turks (standaard) of Engels. De keuze staat in het cookie admin_lang
// (gezet door de taalkiezer in app.js), zodat ook foutmeldingen van de server die taal volgen.
export type Lang = "tr" | "en";

export function langOf(req: Request): Lang {
  const m = /(?:^|;\s*)admin_lang=(tr|en)(?:;|$)/.exec(req.headers.get("Cookie") ?? "");
  return m?.[1] === "en" ? "en" : "tr";
}

// Foutmeldingen worden in het Turks geschreven; hier de Engelse versie per melding.
const EN: Record<string, string> = {
  "Giriş yapılmadı.": "Not logged in.",
  "Oturumun süresi doldu. Sayfayı yenileyip tekrar giriş yapın.": "Your session has expired. Reload the page and log in again.",
  "Beheer is nog niet ingesteld (Access).": "The admin page is not configured yet (Access).",
  "Cloudflare Access is nu niet bereikbaar. Probeer het opnieuw.": "Cloudflare Access cannot be reached right now. Try again.",
  "İstek reddedildi.": "Request refused.",
  "Çok fazla istek. Bir dakika bekleyip tekrar deneyin.": "Too many requests. Wait a minute and try again.",
  "Geçersiz istek.": "Invalid request.",
  "Geçersiz numara.": "Invalid number.",
  "Bulunamadı.": "Not found.",
  "Beklenmeyen bir hata oluştu.": "An unexpected error occurred.",
  "Erişim listesi henüz bağlanmadı.": "The access list is not connected yet.",
  "Erişim listesi yüklenemedi.": "The access list could not be loaded.",
  "Geçerli bir e-posta adresi yazın.": "Enter a valid e-mail address.",
  "Bu adres sahibine ait ve zaten her zaman erişebilir.": "This address belongs to the owner and always has access.",
  "Bu adres zaten listede.": "This address is already on the list.",
  "Sahibin erişimi kaldırılamaz.": "The owner's access cannot be removed.",
  "Ürün adını yazın.": "Enter the item name.",
  "Fiyatı yazın.": "Enter the price.",
  "Kategori adını yazın.": "Enter the category name.",
  "Geçersiz fiyat.": "Invalid price.",
  "Fiyat sadece rakam olmalı (örnek: 180 veya 12,50).": "A price may only contain digits (for example 180 or 12,50).",
  "Bu kayıt bu arada değişti (başka biri kaydetmiş olabilir). Liste yenilendi; tekrar deneyin.":
    "This record changed in the meantime (someone else may have saved it). The list was refreshed; try again.",
  "Ürün bulunamadı.": "Item not found.",
  "Kategori bulunamadı.": "Category not found.",
  "Bu kategori silinmiş.": "This category has been deleted.",
  "Bu kategoride hâlâ ürün var. Önce ürünleri silin veya taşıyın.": "This category still has items. Delete or move them first.",
  "Bilinmeyen ayar.": "Unknown setting.",
  "Kayıt bulunamadı.": "Record not found.",
  "Bu değişiklik zaten geri alındı.": "This change has already been undone.",
  "Bu değişiklik geri alınamaz.": "This change cannot be undone.",
  "Bu kayıt sonradan tekrar değişti; bu adım artık geri alınamaz.": "This record changed again later; this step can no longer be undone."
};

const EN_PATTERNS: [RegExp, string][] = [
  [/^Bu Google hesabının \/ e-posta adresinin erişim izni yok: (.*)$/s, "This Google account / e-mail address has no access: $1"],
  [/^Liste dolu \(en fazla (\d+)\)\.$/, "The list is full (at most $1)."]
];

/** Melding in de gekozen taal; onbekende meldingen blijven zoals ze zijn. */
export function translate(message: string, lang: Lang): string {
  if (lang === "tr") return message;
  if (EN[message]) return EN[message];
  for (const [re, out] of EN_PATTERNS) if (re.test(message)) return message.replace(re, out);
  return message;
}
