// De QR-kaartjes in de beheerpagina (admin-public/qr.css) gebruiken een kopie van de themakleuren
// van de menukaart (public/css/style.css). Deze test faalt als de twee uit elkaar lopen.
import { describe, expect, it } from "vitest";
import menuCss from "../public/css/style.css?raw";
import qrCss from "../admin-public/qr.css?raw";

const norm = (body: string) => body.replace(/\s+/g, " ").trim();

function themes(css: string, rootRe: RegExp, themeRe: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  const root = rootRe.exec(css);
  if (root) out.default = norm(root[1]!);
  for (const m of css.matchAll(themeRe)) out[m[1]!] = norm(m[2]!);
  return out;
}

describe("thema's van de QR-kaartjes", () => {
  it("zijn gelijk aan die van de menukaart", () => {
    // Leeg = Vitest heeft de CSS niet als tekst geladen (zie css.include in vitest.config.ts).
    expect(menuCss.length).toBeGreaterThan(1000);
    expect(qrCss.length).toBeGreaterThan(1000);
    const menu = themes(menuCss, /:root\s*\{([^}]*)\}/, /html\[data-bg="(\w+)"\]\s*\{([^}]*)\}/g);
    const qr = themes(qrCss, /^\.qr-sheet\s*\{([^}]*)\}/m, /\.qr-sheet\[data-bg="(\w+)"\]\s*\{([^}]*)\}/g);
    expect(Object.keys(menu).sort()).toEqual(["cini", "default", "espresso", "kahve", "kraft"]);
    expect(qr).toEqual(menu);
  });
});
