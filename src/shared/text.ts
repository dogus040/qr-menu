// Tekst-hulpjes: HTML-escaping, Turkse normalisatie en opschonen van invoer.

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

/** Alles wat in HTML terechtkomt gaat hierdoor (tekst én attributen). */
export function esc(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** "Şefin Önerisi" → "sefinonerisi": voor vergelijken en CSS-klassen. */
export function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Spaties normaliseren, stuurtekens weg, lengte begrenzen. */
export function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Lijst uit JSON-tekst of komma-tekst, opgeschoond en uniek. */
export function cleanList(value: unknown, maxItems = 10, maxLength = 30): string[] {
  let raw: unknown[] = [];
  if (Array.isArray(value)) raw = value;
  else if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      raw = Array.isArray(parsed) ? parsed : value.split(/[,;]/);
    } catch {
      raw = value.split(/[,;]/);
    }
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const t = cleanText(v, maxLength);
    const k = normalizeKey(t);
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}
