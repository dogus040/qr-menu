// Kiest de achtergrond van de menukaart. Volgorde: ?bg= in de link,
// dan "Arka Plan" in de sheet (via menu.js), dan arkaPlan in config.js.
(function () {
  "use strict";

  var THEMES = {
    kagit: "#fbf7ef",
    kahve: "#f7efe3",
    cini: "#fbf9f4",
    kraft: "#d4b88f",
    espresso: "#251a14"
  };

  function normalize(name) {
    return String(name || "")
      .trim()
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z]/g, "");
  }

  function apply(name) {
    var key = normalize(name);
    if (!THEMES[key]) return false;
    document.documentElement.setAttribute("data-bg", key);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEMES[key]);
    return true;
  }

  var fromUrl = new URLSearchParams(location.search).get("bg");
  var cfg = window.MENU_CONFIG || {};

  window.MenuTheme = {
    // true als de link al een achtergrond vastlegt (dan wint die van de sheet).
    lockedByUrl: apply(fromUrl),
    apply: apply
  };

  if (!window.MenuTheme.lockedByUrl) apply(cfg.arkaPlan || "kagit");
})();
