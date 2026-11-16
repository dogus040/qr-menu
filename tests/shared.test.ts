import { describe, expect, it } from "vitest";
import { formatPrice, formatWithCurrency, parsePrice } from "../src/shared/money";
import { cleanList, cleanText, esc, normalizeKey } from "../src/shared/text";

describe("geld", () => {
  it("leest Turkse en gewone notaties", () => {
    expect(parsePrice("180")).toBe(18000);
    expect(parsePrice("12,50")).toBe(1250);
    expect(parsePrice("12.5")).toBe(1250);
    expect(parsePrice("1.250")).toBe(125000);
    expect(parsePrice("1.250,75")).toBe(125075);
    expect(parsePrice(" 180 ₺ ")).toBe(18000);
    expect(parsePrice("")).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(25)).toBe(2500);
  });

  it("weigert onzin", () => {
    for (const bad of ["abc", "-5", "1,2,3", "12,345", "=1+1", "1e5"]) {
      expect(() => parsePrice(bad), bad).toThrow();
    }
  });

  it("toont bedragen Turks", () => {
    expect(formatPrice(18000)).toBe("180");
    expect(formatPrice(1250)).toBe("12,50");
    expect(formatPrice(125000)).toBe("1.250");
    expect(formatPrice(null)).toBe("");
    expect(formatWithCurrency(21000, "₺")).toBe("210 ₺");
  });
});

describe("tekst", () => {
  it("escapet HTML", () => {
    expect(esc(`<script>alert("x")</script>&'`)).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;");
  });

  it("normaliseert Turkse tekens", () => {
    expect(normalizeKey("Şefin Önerisi")).toBe("sefinonerisi");
    expect(normalizeKey("AÇILI")).toBe("acili");
    expect(normalizeKey("İçecek")).toBe("icecek");
  });

  it("schoont invoer op", () => {
    expect(cleanText("  Çay \n\t latte  ", 80)).toBe("Çay latte");
    expect(cleanText("x".repeat(100), 10)).toHaveLength(10);
    expect(cleanList("Süt, Gluten, süt, ")).toEqual(["Süt", "Gluten"]);
    expect(cleanList('["Yeni","Vegan"]')).toEqual(["Yeni", "Vegan"]);
  });
});
