// Server-side HTML voor de publieke menukaart. (De QR-kaartjes staan in de beheerpagina, tabblad QR.)
// Alle data gaat door esc(); de pagina werkt ook zonder JavaScript.
import { formatWithCurrency } from "../shared/money";
import { THEME_COLORS, toTheme, type MenuCategory, type MenuItem, type PublicMenu, type Settings } from "../shared/menu";
import { esc, normalizeKey } from "../shared/text";

const FONTS =
  "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;1,400&family=Playfair+Display:ital,wght@0,500;0,600;1,500&display=swap";

function head(title: string, settings: Settings, extra = ""): string {
  const theme = toTheme(settings.theme);
  const description = [settings.restaurant_name, settings.subtitle].filter(Boolean).join(" · ");
  return `<!doctype html>
<html lang="tr" data-bg="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="${THEME_COLORS[theme]}">
  <meta name="description" content="${esc(description)}">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONTS}" rel="stylesheet">
  <link rel="stylesheet" href="/css/style.css">${extra}
</head>`;
}

function anchor(cat: MenuCategory): string {
  return `kategori-${cat.id}`;
}

function priceCell(kurus: number | null, currency: string, cls = "item-price"): string {
  return `<span class="${cls}">${esc(formatWithCurrency(kurus, currency))}</span>`;
}

function renderItem(item: MenuItem, s: Settings): string {
  const sized = item.priceSmall !== null || item.priceLarge !== null;
  const prices = sized
    ? priceCell(item.priceSmall, s.currency, "item-price item-price-size") +
      priceCell(item.priceLarge, s.currency, "item-price item-price-size")
    : priceCell(item.price, s.currency);

  // allergenText komt per product uit de beheerpagina; een oude momentopname heeft het veld niet.
  const allergen = item.allergenText ?? "";
  const meta = item.tags.length || allergen
    ? `<p class="item-meta">${item.tags
        .map((t) => `<span class="tag tag-${esc(normalizeKey(t))}">${esc(t)}</span>`)
        .join("")}${allergen ? `<span class="allergens">${esc(allergen)}</span>` : ""}</p>`
    : "";

  return `<li class="item">
        <div class="item-line"><span class="item-name">${esc(item.name)}</span><span class="item-leader"></span>${prices}</div>${
    item.description ? `\n        <p class="item-desc">${esc(item.description)}</p>` : ""
  }${meta ? "\n        " + meta : ""}
      </li>`;
}

function renderCategory(cat: MenuCategory, s: Settings): string {
  const sized = cat.items.some((i) => i.priceSmall !== null || i.priceLarge !== null);
  return `<section class="category" id="${anchor(cat)}">
      <h2 class="category-title"><span>${esc(cat.name)}</span></h2>${
    cat.note ? `\n      <p class="category-note">${esc(cat.note)}</p>` : ""
  }${
    sized
      ? `\n      <div class="size-head"><span class="size-label">${esc(s.size_small_label)}</span><span class="size-label">${esc(s.size_large_label)}</span></div>`
      : ""
  }
      <ul class="items">
      ${cat.items.map((i) => renderItem(i, s)).join("\n      ")}
      </ul>
    </section>`;
}

function instagramHandle(value: string): string {
  return value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "").trim();
}

function renderFooter(s: Settings): string {
  const parts: string[] = [];
  if (s.hours) parts.push(`<p class="footer-hours">${esc(s.hours)}</p>`);
  if (s.address) parts.push(`<p>${esc(s.address)}</p>`);
  const contact: string[] = [];
  if (s.phone) contact.push(`<a href="tel:${esc(s.phone.replace(/[^\d+]/g, ""))}">${esc(s.phone)}</a>`);
  const ig = instagramHandle(s.instagram);
  if (ig) {
    contact.push(
      `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>`
    );
  }
  if (contact.length) parts.push(`<p class="footer-contact">${contact.join("")}</p>`);
  if (s.footer_note) parts.push(`<p class="footer-note">${esc(s.footer_note)}</p>`);
  return parts.join("\n      ");
}

export function renderMenuPage(menu: PublicMenu): string {
  const s = menu.settings;
  const nav = menu.categories
    .map((c) => `<a class="nav-link" href="#${anchor(c)}" data-target="${anchor(c)}">${esc(c.name)}</a>`)
    .join("");
  const body = menu.categories.length
    ? menu.categories.map((c) => renderCategory(c, s)).join("\n    ")
    : `<p class="status">Menü yakında burada.</p>`;

  return `${head(`${s.restaurant_name} · Menü`, s)}
<body>
  <div class="page">
    <header class="masthead">
      <div class="ornament" aria-hidden="true"><span>&#10086;</span></div>
      <h1 class="restaurant-name">${esc(s.restaurant_name)}</h1>
      <p class="restaurant-subtitle">${esc(s.subtitle)}</p>
      <div class="rule" aria-hidden="true"><span>&#10022;</span></div>
    </header>

    <nav id="category-nav" class="category-nav" aria-label="Kategoriler">${nav}</nav>

    <main id="menu" class="menu">
    ${body}
    </main>

    <footer class="footer">
      <div class="rule" aria-hidden="true"><span>&#10022;</span></div>
      ${renderFooter(s)}
    </footer>
  </div>
  <script src="/js/menu-nav.js" defer></script>
</body>
</html>`;
}

export function renderUnavailablePage(): string {
  return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Menü</title><link rel="stylesheet" href="/css/style.css"></head>
<body><div class="page"><main class="menu"><p class="status">Menü şu anda yüklenemedi. Lütfen birazdan tekrar deneyin.</p></main></div></body></html>`;
}
