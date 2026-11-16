// Tekent de menukaart.
(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null && text !== "") node.textContent = text;
    return node;
  }

  function slug(s, i) {
    var base = window.MenuData.normalizeKey(s) || "kategori";
    return base + "-" + i;
  }

  function formatPrice(raw, currency) {
    var value = String(raw || "").trim();
    if (!value) return "";
    // Alleen cijfers (bijv. 250 of 12,50) krijgen automatisch het valutateken.
    if (currency && /^[\d.,\s]+$/.test(value)) return value + " " + currency;
    return value;
  }

  function renderHeader(settings) {
    var name = settings.restoranadi || "Menü";
    document.title = name + " · Menü";
    document.getElementById("restaurant-name").textContent = name;
    document.getElementById("restaurant-subtitle").textContent = settings.altbaslik || "";
  }

  function renderNav(categories) {
    var nav = document.getElementById("category-nav");
    nav.textContent = "";
    categories.forEach(function (cat, i) {
      var a = el("a", "nav-link", cat.name);
      a.href = "#" + slug(cat.name, i);
      a.dataset.target = slug(cat.name, i);
      nav.appendChild(a);
    });
  }

  function hasSizes(item) {
    return Boolean(item.priceSmall || item.priceLarge);
  }

  function renderItem(item, currency) {
    var li = el("li", "item");
    var line = el("div", "item-line");
    line.appendChild(el("span", "item-name", item.name));
    line.appendChild(el("span", "item-leader"));
    if (hasSizes(item)) {
      // Twee kolommen (Küçük, Büyük); een lege maat blijft als lege kolom staan.
      line.appendChild(el("span", "item-price item-price-size", formatPrice(item.priceSmall, currency)));
      line.appendChild(el("span", "item-price item-price-size", formatPrice(item.priceLarge, currency)));
    } else {
      line.appendChild(el("span", "item-price", formatPrice(item.price, currency)));
    }
    li.appendChild(line);

    if (item.description) li.appendChild(el("p", "item-desc", item.description));

    if (item.tags.length || item.allergens.length) {
      var meta = el("p", "item-meta");
      item.tags.forEach(function (t) {
        var key = window.MenuData.normalizeKey(t);
        var tag = el("span", "tag tag-" + key, t);
        meta.appendChild(tag);
      });
      if (item.allergens.length) {
        meta.appendChild(el("span", "allergens", "Alerjen: " + item.allergens.join(", ")));
      }
      li.appendChild(meta);
    }
    return li;
  }

  function renderMenu(categories, settings) {
    var main = document.getElementById("menu");
    main.textContent = "";
    var currency = settings.parabirimi || "";

    categories.forEach(function (cat, i) {
      var section = el("section", "category");
      section.id = slug(cat.name, i);

      var title = el("h2", "category-title");
      title.appendChild(el("span", null, cat.name));
      section.appendChild(title);
      if (cat.note) section.appendChild(el("p", "category-note", cat.note));

      // Kopjes boven de prijskolommen als deze categorie maten heeft.
      if (cat.items.some(hasSizes)) {
        var head = el("div", "size-head");
        head.appendChild(el("span", "size-label", settings.kucukboyetiketi || "Küçük"));
        head.appendChild(el("span", "size-label", settings.buyukboyetiketi || "Büyük"));
        section.appendChild(head);
      }

      var list = el("ul", "items");
      cat.items.forEach(function (item) { list.appendChild(renderItem(item, currency)); });
      section.appendChild(list);
      main.appendChild(section);
    });
  }

  function renderFooter(settings) {
    var footer = document.getElementById("footer-info");
    footer.textContent = "";

    if (settings.calismasaatleri) footer.appendChild(el("p", "footer-hours", settings.calismasaatleri));
    if (settings.adres) footer.appendChild(el("p", null, settings.adres));

    var contact = el("p", "footer-contact");
    if (settings.telefon) {
      var tel = el("a", null, settings.telefon);
      tel.href = "tel:" + settings.telefon.replace(/[^\d+]/g, "");
      contact.appendChild(tel);
    }
    if (settings.instagram) {
      var handle = settings.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/$/, "");
      var ig = el("a", null, "@" + handle);
      ig.href = "https://instagram.com/" + encodeURIComponent(handle);
      ig.target = "_blank";
      ig.rel = "noopener";
      contact.appendChild(ig);
    }
    if (contact.childNodes.length) footer.appendChild(contact);
    if (settings.altnot) footer.appendChild(el("p", "footer-note", settings.altnot));
  }

  // Markeert de categorie die op het scherm staat in de navigatie.
  function watchActiveCategory() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav-link"));
    if (!links.length || !("IntersectionObserver" in window)) return;
    var nav = document.getElementById("category-nav");

    function setActive(id) {
      links.forEach(function (a) {
        var active = a.dataset.target === id;
        a.classList.toggle("active", active);
        if (active) {
          var left = a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2;
          nav.scrollTo({ left: left, behavior: "smooth" });
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: "-30% 0px -65% 0px" });

    document.querySelectorAll(".category").forEach(function (s) { observer.observe(s); });
    setActive(links[0].dataset.target);
  }

  function showError() {
    var main = document.getElementById("menu");
    main.textContent = "";
    main.appendChild(el("p", "status", "Menü şu anda yüklenemedi. Lütfen sayfayı yenileyin."));
  }

  Promise.all([window.MenuData.loadMenu(), window.MenuData.loadSettings()])
    .then(function (result) {
      var categories = result[0];
      var settings = result[1];
      if (settings.arkaplan && window.MenuTheme && !window.MenuTheme.lockedByUrl) {
        window.MenuTheme.apply(settings.arkaplan);
      }
      renderHeader(settings);
      renderNav(categories);
      renderMenu(categories, settings);
      renderFooter(settings);
      watchActiveCategory();
    })
    .catch(function (err) {
      console.error(err);
      showError();
    });
})();
