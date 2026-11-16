// Beheerpagina Bi Mola. Inloggen doet Cloudflare Access vóór deze pagina;
// hier alleen de JSON-API van de Worker. Teksten: Turks (standaard) of Engels, via de taalkiezer.
(function () {
  "use strict";

  /* ---------- taal ---------- */
  // De keuze staat in het cookie admin_lang, zodat de Worker foutmeldingen en de QR-pagina ook in die taal geeft.
  var I18N = {
    tr: {
      pageTitle: "Bi Mola · Yönetim", brandSuffix: "· Yönetim", openMenu: "Menüyü aç", logout: "Çıkış",
      loginAgain: "Yeniden giriş", tabMenu: "Menü", tabSettings: "Ayarlar", tabAccess: "Erişim", tabHistory: "Geçmiş",
      loading: "Yükleniyor…", addItem: "+ Yeni ürün", addCategory: "+ Yeni kategori",
      accessTitle: "Erişimi olan hesaplar",
      accessIntro: "Sadece bu e-posta adresleri giriş yapabilir (Google veya e-posta kodu ile). Sahibin hesabı her zaman erişebilir.",
      newEmail: "Yeni e-posta adresi", emailPlaceholder: "ornek@gmail.com", add: "Ekle",
      historyTitle: "Son değişiklikler",
      historyIntro: "Bir değişikliği \"Geri al\" ile eski haline getirin (sonradan tekrar değiştirilmediyse).",
      trashTitle: "Çöp kutusu", back: "← Geri", itemName: "Ürün adı", category: "Kategori", price: "Fiyat",
      singlePrice: "Tek fiyat", twoSizes: "İki boy ({0} / {1})", priceTl: "Fiyat (₺)", smallTl: "{0} (₺)",
      largeTl: "{0} (₺)", description: "Açıklama", optional: "(isteğe bağlı)", allergenText: "Alerjen metni",
      allergenHint: "(menüde ürünün altında; boş = gösterilmez)", allergenPlaceholder: "örn. Alerjen: Süt",
      clear: "Temizle", available: "Satışta", availableHint: "(kapalı = tükendi, menüde görünmez)", tags: "Etiketler",
      save: "Kaydet", up: "↑ Yukarı", down: "↓ Aşağı", deleteItem: "Ürünü sil", categoryName: "Kategori adı",
      note: "Not", noteHint: "(isteğe bağlı, başlığın altında)", showOnMenu: "Menüde göster",
      deleteCategory: "Kategoriyi sil",
      saving: "Kaydediliyor…", sessionExpired: "Oturumun süresi doldu.", genericError: "Bir hata oluştu.",
      sessionBanner: "Oturumun süresi doldu. Değişikliğiniz kaydedilmedi; yeniden giriş yapıp tekrar deneyin.",
      noPrice: "Fiyat yok",
      noCategories: "Henüz kategori yok. Önce bir kategori ekleyin.", hidden: "Gizli", edit: "Düzenle",
      addShort: "+ Ekle", emptyCategory: "Bu kategoride ürün yok.", soldOut: "Tükendi",
      isAvailable: "{0}: satışta", isSoldOut: "{0}: tükendi", editItem: "Ürünü düzenle", newItem: "Yeni ürün",
      errName: "Ürün adını yazın.", errNoCategory: "Önce bir kategori ekleyin.",
      errSizePrice: "En az bir boy için fiyat yazın.", errPrice: "Fiyatı yazın.", saved: "Kaydedildi: {0}",
      moved: "Taşındı", confirmDeleteItem: "\"{0}\" silinsin mi? Geçmiş sekmesindeki çöp kutusundan geri getirebilirsiniz.",
      deleted: "Silindi: {0}", editCategory: "Kategoriyi düzenle", newCategory: "Yeni kategori",
      errCategoryName: "Kategori adını yazın.", confirmDeleteCategory: "\"{0}\" kategorisi silinsin mi?",
      accessNotLinked: "Erişim listesi henüz Cloudflare Access'e bağlanmadı.", owner: "Sahibi", you: "Sen",
      remove: "Kaldır", confirmRemoveSelf: "Kendi erişiminizi kaldırırsanız artık giriş yapamazsınız. Devam edilsin mi?",
      confirmRemove: "\"{0}\" artık menüyü düzenleyemeyecek. Devam edilsin mi?", accessRemoved: "Erişim kaldırıldı: {0}",
      errEmail: "Geçerli bir e-posta adresi yazın.", accessAdded: "Erişim eklendi: {0}", noChanges: "Henüz değişiklik yok.",
      undo: "Geri al", confirmUndo: "Bu değişiklik geri alınsın mı?\n{0}", undone: "Geri alındı",
      trashEmpty: "Çöp kutusu boş.", restore: "Geri getir", restored: "Geri getirildi: {0}",
      draftRestored: "Kaydedilmemiş değişikliğiniz geri yüklendi. Kontrol edip kaydedin.",
      set_restaurant_name: "Kafe adı", set_subtitle: "Slogan", set_address: "Adres", set_phone: "Telefon",
      set_instagram: "Instagram kullanıcı adı", set_hours: "Çalışma saatleri", set_footer_note: "Menünün altındaki not",
      set_theme: "Arka plan", set_currency: "Para birimi", set_size_small_label: "Küçük boy etiketi",
      set_size_large_label: "Orta boy etiketi",
      theme_kraft: "Kraft", theme_kagit: "Kağıt", theme_kahve: "Kahve", theme_cini: "Çini", theme_espresso: "Espresso",
      qrTitle: "Masalar için QR kartları",
      qrIntro: "Yazdır'a basın (A4 başına 4 kart, A6 boyutu) veya QR kodunu resim olarak indirin.",
      qrUrl: "Menü bağlantısı", qrUrlLocked: "Bu bağlantıyı sadece sahibi değiştirebilir.",
      qrUrlOwner: "Sadece sen (sahibi) değiştirebilirsin. Kaydedilmez; sadece bu baskı için geçerli.",
      qrCta: "QR kodunun altındaki yazı", qrTable: "Masa numarası (isteğe bağlı, örn. \"Masa 5\")",
      qrPrintBg: "Arka planı da yazdır (gerçek kraft kâğıda yazdırıyorsanız kapatın)", qrPrint: "Yazdır",
      qrDownload: "QR indir (PNG)", qrLibError: "QR kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edip tekrar deneyin."
    },
    en: {
      pageTitle: "Bi Mola · Admin", brandSuffix: "· Admin", openMenu: "Open menu", logout: "Log out",
      loginAgain: "Log in again", tabMenu: "Menu", tabSettings: "Settings", tabAccess: "Access", tabHistory: "History",
      loading: "Loading…", addItem: "+ New item", addCategory: "+ New category",
      accessTitle: "Accounts with access",
      accessIntro: "Only these e-mail addresses can log in (with Google or an e-mail code). The owner's account always has access.",
      newEmail: "New e-mail address", emailPlaceholder: "example@gmail.com", add: "Add",
      historyTitle: "Recent changes",
      historyIntro: "Use \"Undo\" to reverse a change (as long as it has not been changed again since).",
      trashTitle: "Trash", back: "← Back", itemName: "Item name", category: "Category", price: "Price",
      singlePrice: "Single price", twoSizes: "Two sizes ({0} / {1})", priceTl: "Price (₺)", smallTl: "{0} (₺)",
      largeTl: "{0} (₺)", description: "Description", optional: "(optional)", allergenText: "Allergen text",
      allergenHint: "(shown below the item on the menu; empty = not shown)", allergenPlaceholder: "e.g. Alerjen: Süt",
      clear: "Clear", available: "Available", availableHint: "(off = sold out, hidden on the menu)", tags: "Labels",
      save: "Save", up: "↑ Up", down: "↓ Down", deleteItem: "Delete item", categoryName: "Category name",
      note: "Note", noteHint: "(optional, shown below the heading)", showOnMenu: "Show on the menu",
      deleteCategory: "Delete category",
      saving: "Saving…", sessionExpired: "Your session has expired.", genericError: "Something went wrong.",
      sessionBanner: "Your session has expired. Your change was not saved; log in again and retry.",
      noPrice: "No price",
      noCategories: "No categories yet. Add a category first.", hidden: "Hidden", edit: "Edit",
      addShort: "+ Add", emptyCategory: "No items in this category.", soldOut: "Sold out",
      isAvailable: "{0}: available", isSoldOut: "{0}: sold out", editItem: "Edit item", newItem: "New item",
      errName: "Enter the item name.", errNoCategory: "Add a category first.",
      errSizePrice: "Enter a price for at least one size.", errPrice: "Enter the price.", saved: "Saved: {0}",
      moved: "Moved", confirmDeleteItem: "Delete \"{0}\"? You can bring it back from the trash in the History tab.",
      deleted: "Deleted: {0}", editCategory: "Edit category", newCategory: "New category",
      errCategoryName: "Enter the category name.", confirmDeleteCategory: "Delete the category \"{0}\"?",
      accessNotLinked: "The access list is not connected to Cloudflare Access yet.", owner: "Owner", you: "You",
      remove: "Remove", confirmRemoveSelf: "If you remove your own access you can no longer log in. Continue?",
      confirmRemove: "\"{0}\" will no longer be able to edit the menu. Continue?", accessRemoved: "Access removed: {0}",
      errEmail: "Enter a valid e-mail address.", accessAdded: "Access added: {0}", noChanges: "No changes yet.",
      undo: "Undo", confirmUndo: "Undo this change?\n{0}", undone: "Undone",
      trashEmpty: "The trash is empty.", restore: "Restore", restored: "Restored: {0}",
      draftRestored: "Your unsaved change was restored. Check it and save.",
      set_restaurant_name: "Café name", set_subtitle: "Tagline", set_address: "Address", set_phone: "Phone",
      set_instagram: "Instagram username", set_hours: "Opening hours", set_footer_note: "Note at the bottom of the menu",
      set_theme: "Background", set_currency: "Currency", set_size_small_label: "Small size label",
      set_size_large_label: "Medium size label",
      theme_kraft: "Kraft", theme_kagit: "Paper", theme_kahve: "Coffee", theme_cini: "Tiles", theme_espresso: "Espresso",
      qrTitle: "QR cards for the tables",
      qrIntro: "Press Print (4 cards per A4 sheet, A6 size) or download the QR code as an image.",
      qrUrl: "Link to the menu", qrUrlLocked: "Only the owner can change this link.",
      qrUrlOwner: "Only you (the owner) can change this. It is not saved; it only applies to this print.",
      qrCta: "Text below the QR code", qrTable: "Table number (optional, e.g. \"Masa 5\")",
      qrPrintBg: "Print the background too (turn off when printing on real kraft paper)", qrPrint: "Print",
      qrDownload: "Download QR (PNG)", qrLibError: "The QR library could not be loaded. Check the internet connection and try again."
    }
  };
  // Etiketten worden in het Turks opgeslagen (gasten zien die); in het Engels alleen een andere knoptekst.
  var TAG_LABELS_EN = { "Yeni": "New", "Vejetaryen": "Vegetarian", "Vegan": "Vegan", "Acılı": "Spicy", "Şefin Önerisi": "Chef's choice" };
  // Logregels staan in het Turks in de database; in het Engels vertalen we de vaste woorden.
  var SUMMARY_EN = [
    ["Geri alındı: ", "Undone: "], ["Kategori eklendi: ", "Category added: "],
    ["Kategori güncellendi: ", "Category updated: "], ["Eklendi: ", "Added: "], ["Güncellendi: ", "Updated: "],
    ["Silindi: ", "Deleted: "], ["Geri getirildi: ", "Restored: "], ["Taşındı: ", "Moved: "], ["Ayar: ", "Setting: "],
    ["Erişim eklendi: ", "Access added: "], ["Erişim kaldırıldı: ", "Access removed: "]
  ];
  // "büyük" staat nog in oude logregels (vóór de maat "orta" heette).
  var DETAIL_EN = [["fiyat", "price"], ["küçük", "small"], ["orta", "medium"], ["büyük", "large"], ["satışta", "available"],
    ["tükendi", "sold out"], ["alerjen metni", "allergen text"]];

  function readLang() {
    var m = /(?:^|;\s*)admin_lang=(tr|en)(?:;|$)/.exec(document.cookie);
    return m ? m[1] : "tr";
  }
  var lang = readLang();

  function t(key) {
    var s = (I18N[lang] && I18N[lang][key]) || I18N.tr[key] || key;
    for (var i = 1; i < arguments.length; i++) s = s.split("{" + (i - 1) + "}").join(String(arguments[i]));
    return s;
  }
  function tagLabel(v) { return lang === "en" && TAG_LABELS_EN[v] ? TAG_LABELS_EN[v] : v; }
  function locale() { return lang === "en" ? "en-GB" : "tr-TR"; }

  function summaryText(s) {
    if (lang !== "en") return s;
    var out = "";
    var update = false;
    for (var found = true; found;) {
      found = false;
      for (var i = 0; i < SUMMARY_EN.length; i++) {
        if (s.indexOf(SUMMARY_EN[i][0]) === 0) {
          if (SUMMARY_EN[i][0] === "Güncellendi: ") update = true;
          out += SUMMARY_EN[i][1];
          s = s.slice(SUMMARY_EN[i][0].length);
          found = true;
          break;
        }
      }
    }
    // Details staan tussen haakjes aan het eind: "(fiyat 180 → 200, tükendi)".
    var m = update ? /^(.*) \(([^()]*)\)$/.exec(s) : null;
    if (m) {
      var parts = m[2].split(", ").map(function (p) {
        for (var j = 0; j < DETAIL_EN.length; j++) {
          if (p.indexOf(DETAIL_EN[j][0]) === 0) return DETAIL_EN[j][1] + p.slice(DETAIL_EN[j][0].length);
        }
        return p;
      });
      s = m[1] + " (" + parts.join(", ") + ")";
    }
    return out + s;
  }

  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t("pageTitle");
    document.querySelectorAll("[data-i18n]").forEach(function (n) { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach(function (n) { n.placeholder = t(n.dataset.i18nPh); });
    $("lang").value = lang;
  }

  function setLang(next) {
    lang = next === "en" ? "en" : "tr";
    document.cookie = "admin_lang=" + lang + "; Path=/; Max-Age=31536000; SameSite=Lax; Secure";
    applyStatic();
    if (state) renderAll();
    if (!$("view-item").hidden) {
      $("item-title").textContent = editingItem ? t("editItem") : t("newItem");
      $("f-tags").querySelectorAll(".chip").forEach(function (b) { b.textContent = tagLabel(b.dataset.value); });
    }
    if (!$("view-category").hidden) $("category-title").textContent = editingCategory ? t("editCategory") : t("newCategory");
  }

  var TAGS = ["Yeni", "Vejetaryen", "Vegan", "Acılı", "Şefin Önerisi"];
  var THEMES = ["kraft", "kagit", "kahve", "cini", "espresso"];
  var SETTINGS = [
    "restaurant_name", "subtitle", "address", "phone", "instagram", "hours", "footer_note",
    "theme", "currency", "size_small_label", "size_large_label"
  ];
  var DRAFT_KEY = "bimola-admin-draft";

  var state = null;
  var editingItem = null;      // null = nieuw product
  var editingCategory = null;  // null = nieuwe categorie
  var extraTags = [];          // etiketten buiten de vaste lijst (uit oude data)

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null && text !== "") n.textContent = text;
    return n;
  }
  function norm(s) {
    return String(s || "").trim().toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]/g, "");
  }
  var nf0 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(k) {
    if (k === null || k === undefined) return "";
    return k % 100 === 0 ? nf0.format(k / 100) : nf2.format(k / 100);
  }
  // Voor invoervelden zonder duizendtalpunt: 125000 → "1250".
  function moneyInput(k) {
    if (k === null || k === undefined) return "";
    return k % 100 === 0 ? String(k / 100) : (k / 100).toFixed(2).replace(".", ",");
  }

  /* ---------- meldingen ---------- */
  var toastTimer;
  function toast(msg, bad) {
    var el2 = $("toast");
    el2.textContent = msg;
    el2.classList.toggle("bad", Boolean(bad));
    el2.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el2.classList.remove("show"); }, bad ? 5000 : 2200);
  }

  function banner(msg) {
    $("banner-text").textContent = msg;
    $("banner").hidden = !msg;
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = t("saving"); }
    else if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }

  /* ---------- concept bewaren bij verlopen sessie ---------- */
  function saveDraft() {
    if ($("view-item").hidden) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ id: editingItem ? editingItem.id : null, fields: collectItem(true) }));
    } catch (e) { /* privévenster */ }
  }
  function takeDraft() {
    try {
      var d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null");
      sessionStorage.removeItem(DRAFT_KEY);
      return d;
    } catch (e) { return null; }
  }

  /* ---------- API ---------- */
  function SessionError() { this.message = t("sessionExpired"); }

  function api(path, body) {
    var init = { method: body === undefined ? "GET" : "POST", credentials: "same-origin", redirect: "manual" };
    if (body !== undefined) {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    return fetch(path, init).then(function (res) {
      // Access stuurt bij een verlopen sessie een redirect naar de inlogpagina.
      if (res.type === "opaqueredirect" || res.status === 0 || res.status === 401) throw new SessionError();
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || t("genericError"));
          err.status = res.status;
          throw err;
        }
        state = data;
        return data;
      });
    }, function () {
      // Netwerkfout of CORS-fout door een Access-redirect: behandelen als verlopen sessie.
      throw new SessionError();
    });
  }

  function handleError(err) {
    if (err instanceof SessionError) {
      saveDraft();
      banner(t("sessionBanner"));
      return;
    }
    toast(err.message, true);
    if (err.status === 409) refresh();
    if (err.status === 403) banner(err.message);
  }

  function refresh() {
    return api("/api/state").then(renderAll).catch(handleError);
  }

  /* ---------- weergave ---------- */
  function showView(name) {
    ["app", "item", "category"].forEach(function (v) { $("view-" + v).hidden = v !== name; });
    window.scrollTo(0, 0);
  }

  function renderAll() {
    $("loading").hidden = true;
    $("me").textContent = state.me || "";
    if (state.publicMenuUrl) $("open-menu").href = state.publicMenuUrl;
    applySizeLabels();
    renderMenu();
    renderSettings();
    renderAccess();
    renderHistory();
    renderQr();
  }

  function itemsOf(catId) {
    return state.items.filter(function (i) { return i.category_id === catId; });
  }

  // Maatnamen komen uit Ayarlar, net als op de menukaart (standaard "Küçük" en "Orta").
  function sizeLabels() {
    return { small: setting("size_small_label") || "Küçük", large: setting("size_large_label") || "Orta" };
  }

  // Vaste spatie: "Küçük 180 ₺" blijft bij elkaar; op een smalle telefoon breekt de regel alleen bij "·".
  var NBSP = String.fromCharCode(160);
  function priceText(it) {
    if (it.price_small !== null || it.price_large !== null) {
      var s = sizeLabels();
      return s.small + NBSP + (money(it.price_small) || "–") + NBSP + "₺ · " +
        s.large + NBSP + (money(it.price_large) || "–") + NBSP + "₺";
    }
    return it.price !== null ? money(it.price) + NBSP + "₺" : t("noPrice");
  }

  function applySizeLabels() {
    var s = sizeLabels();
    $("label-sizes").textContent = t("twoSizes", s.small, s.large);
    $("label-small").textContent = t("smallTl", s.small);
    $("label-large").textContent = t("largeTl", s.large);
  }

  function renderMenu() {
    var box = $("menu-list");
    box.textContent = "";
    if (!state.categories.length) {
      box.appendChild(el("p", "empty", t("noCategories")));
      return;
    }
    state.categories.forEach(function (cat) {
      var section = el("section", "cat");
      var head = el("div", "cat-head");
      var h = el("h2", null, cat.name);
      if (!cat.visible) h.appendChild(el("span", "badge hidden-badge", t("hidden")));
      head.appendChild(h);
      var actions = el("div", "cat-actions");
      var edit = el("button", "btn ghost small", t("edit"));
      edit.type = "button";
      edit.addEventListener("click", function () { openCategory(cat); });
      var add = el("button", "btn ghost small", t("addShort"));
      add.type = "button";
      add.addEventListener("click", function () { openItem(null, cat.id); });
      actions.appendChild(edit);
      actions.appendChild(add);
      head.appendChild(actions);
      section.appendChild(head);
      if (cat.note) section.appendChild(el("p", "cat-note", cat.note));

      var items = itemsOf(cat.id);
      if (!items.length) section.appendChild(el("p", "cat-note", t("emptyCategory")));
      items.forEach(function (it) {
        var on = Boolean(it.available);
        var row = el("div", "row" + (on ? "" : " off"));
        var main = el("button", "row-main");
        main.type = "button";
        var name = el("span", "row-name", it.name);
        if (!on) name.appendChild(el("span", "badge", t("soldOut")));
        main.appendChild(name);
        main.appendChild(el("span", "row-price", priceText(it)));
        if (it.allergen_text) main.appendChild(el("span", "row-allergen", it.allergen_text));
        main.addEventListener("click", function () { openItem(it); });
        row.appendChild(main);

        // Zichtbare knop, net als bij categorieën (de hele rij aantikken werkt ook).
        var editBtn = el("button", "btn ghost small row-edit", t("edit"));
        editBtn.type = "button";
        editBtn.setAttribute("aria-label", t("edit") + ": " + it.name);
        editBtn.addEventListener("click", function () { openItem(it); });
        row.appendChild(editBtn);

        var sw = el("input", "switch");
        sw.type = "checkbox";
        sw.checked = on;
        sw.setAttribute("aria-label", t("isAvailable", it.name));
        sw.addEventListener("change", function () {
          sw.disabled = true;
          api("/api/items/" + it.id + "/available", { version: it.version, available: sw.checked })
            .then(function () { renderAll(); toast(sw.checked ? t("isAvailable", it.name) : t("isSoldOut", it.name)); })
            .catch(function (err) { sw.checked = !sw.checked; sw.disabled = false; handleError(err); });
        });
        row.appendChild(sw);
        section.appendChild(row);
      });
      box.appendChild(section);
    });
  }

  /* ---------- product bewerken ---------- */
  function renderTagChips(selected) {
    var box = $("f-tags");
    box.textContent = "";
    var chosen = selected.map(norm);
    TAGS.forEach(function (opt) {
      var b = el("button", "chip", tagLabel(opt));
      b.type = "button";
      b.dataset.value = opt;
      b.setAttribute("aria-pressed", chosen.indexOf(norm(opt)) !== -1 ? "true" : "false");
      b.addEventListener("click", function () {
        b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
      });
      box.appendChild(b);
    });
    var known = TAGS.map(norm);
    extraTags = selected.filter(function (s) { return known.indexOf(norm(s)) === -1; });
  }

  function tagValues() {
    var vals = [];
    $("f-tags").querySelectorAll(".chip").forEach(function (b) {
      if (b.getAttribute("aria-pressed") === "true") vals.push(b.dataset.value);
    });
    return vals.concat(extraTags);
  }

  function setPriceType(type) {
    document.querySelectorAll('input[name="ptype"]').forEach(function (r) { r.checked = r.value === type; });
    $("price-single").hidden = type !== "single";
    $("price-sizes").hidden = type !== "sizes";
  }

  function openItem(it, presetCategory, draft) {
    editingItem = it;
    $("item-title").textContent = it ? t("editItem") : t("newItem");
    $("item-error").textContent = "";
    var sel = $("f-category");
    sel.textContent = "";
    state.categories.forEach(function (c) {
      var o = el("option", null, c.name);
      o.value = String(c.id);
      sel.appendChild(o);
    });
    var f = draft || {};
    sel.value = String(f.categoryId || (it ? it.category_id : presetCategory || (state.categories[0] || {}).id));
    $("f-name").value = f.name !== undefined ? f.name : it ? it.name : "";
    $("f-description").value = f.description !== undefined ? f.description : it ? it.description : "";
    $("f-allergen").value = f.allergenText !== undefined ? f.allergenText : it ? it.allergen_text || "" : "";
    var sized = f.priceSmall !== undefined ? Boolean(f.priceSmall || f.priceLarge)
      : Boolean(it && (it.price_small !== null || it.price_large !== null));
    $("f-price").value = f.price !== undefined ? f.price || "" : it ? moneyInput(it.price) : "";
    $("f-small").value = f.priceSmall !== undefined ? f.priceSmall || "" : it ? moneyInput(it.price_small) : "";
    $("f-large").value = f.priceLarge !== undefined ? f.priceLarge || "" : it ? moneyInput(it.price_large) : "";
    setPriceType(sized ? "sizes" : "single");
    applySizeLabels();
    $("f-available").checked = f.available !== undefined ? f.available : it ? Boolean(it.available) : true;
    renderTagChips(f.tags || (it ? it.tags : []));
    $("item-extra").hidden = !it;
    showView("item");
    if (!it) $("f-name").focus();
  }

  function collectItem(raw) {
    var sizes = document.querySelector('input[name="ptype"]:checked').value === "sizes";
    var f = {
      categoryId: Number($("f-category").value),
      name: $("f-name").value.trim(),
      description: $("f-description").value.trim(),
      price: sizes ? null : $("f-price").value.trim(),
      priceSmall: sizes ? $("f-small").value.trim() : null,
      priceLarge: sizes ? $("f-large").value.trim() : null,
      available: $("f-available").checked,
      tags: tagValues(),
      allergenText: $("f-allergen").value.trim()
    };
    if (raw) return f;
    if (!f.name) return { error: t("errName") };
    if (!f.categoryId) return { error: t("errNoCategory") };
    if (sizes ? !(f.priceSmall || f.priceLarge) : !f.price) return { error: sizes ? t("errSizePrice") : t("errPrice") };
    return { fields: f };
  }

  $("f-allergen-clear").addEventListener("click", function () {
    $("f-allergen").value = "";
    $("f-allergen").focus();
  });

  $("item-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var c = collectItem(false);
    if (c.error) { $("item-error").textContent = c.error; return; }
    var btn = $("item-save");
    busy(btn, true);
    var it = editingItem;
    var body = c.fields;
    if (it) body.version = it.version;
    api(it ? "/api/items/" + it.id : "/api/items", body)
      .then(function () { busy(btn, false); renderAll(); showView("app"); toast(t("saved", c.fields.name)); })
      .catch(function (err) {
        busy(btn, false);
        if (err.status === 400) $("item-error").textContent = err.message;
        else handleError(err);
        if (err.status === 409) showView("app");
      });
  });

  function moveItem(direction) {
    var it = editingItem;
    var btn = $(direction < 0 ? "item-up" : "item-down");
    busy(btn, true);
    api("/api/items/" + it.id + "/move", { version: it.version, direction: direction })
      .then(function () {
        busy(btn, false);
        editingItem = state.items.filter(function (x) { return x.id === it.id; })[0] || null;
        renderAll();
        toast(t("moved"));
      })
      .catch(function (err) { busy(btn, false); handleError(err); });
  }
  $("item-up").addEventListener("click", function () { moveItem(-1); });
  $("item-down").addEventListener("click", function () { moveItem(1); });

  $("item-delete").addEventListener("click", function () {
    var it = editingItem;
    if (!window.confirm(t("confirmDeleteItem", it.name))) return;
    var btn = $("item-delete");
    busy(btn, true);
    api("/api/items/" + it.id + "/delete", { version: it.version })
      .then(function () { busy(btn, false); renderAll(); showView("app"); toast(t("deleted", it.name)); })
      .catch(function (err) { busy(btn, false); handleError(err); });
  });

  /* ---------- categorie bewerken ---------- */
  function openCategory(cat) {
    editingCategory = cat;
    $("category-title").textContent = cat ? t("editCategory") : t("newCategory");
    $("category-error").textContent = "";
    $("c-name").value = cat ? cat.name : "";
    $("c-note").value = cat ? cat.note : "";
    $("c-visible").checked = cat ? Boolean(cat.visible) : true;
    $("category-extra").hidden = !cat;
    showView("category");
    if (!cat) $("c-name").focus();
  }

  $("category-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = $("c-name").value.trim();
    if (!name) { $("category-error").textContent = t("errCategoryName"); return; }
    var cat = editingCategory;
    var body = { name: name, note: $("c-note").value.trim(), visible: $("c-visible").checked };
    if (cat) body.version = cat.version;
    var btn = $("category-save");
    busy(btn, true);
    api(cat ? "/api/categories/" + cat.id : "/api/categories", body)
      .then(function () { busy(btn, false); renderAll(); showView("app"); toast(t("saved", name)); })
      .catch(function (err) {
        busy(btn, false);
        if (err.status === 400) $("category-error").textContent = err.message;
        else handleError(err);
      });
  });

  function moveCategory(direction) {
    var cat = editingCategory;
    api("/api/categories/" + cat.id + "/move", { version: cat.version, direction: direction })
      .then(function () {
        editingCategory = state.categories.filter(function (x) { return x.id === cat.id; })[0] || null;
        renderAll();
        toast(t("moved"));
      })
      .catch(handleError);
  }
  $("category-up").addEventListener("click", function () { moveCategory(-1); });
  $("category-down").addEventListener("click", function () { moveCategory(1); });

  $("category-delete").addEventListener("click", function () {
    var cat = editingCategory;
    if (!window.confirm(t("confirmDeleteCategory", cat.name))) return;
    api("/api/categories/" + cat.id + "/delete", { version: cat.version })
      .then(function () { renderAll(); showView("app"); toast(t("deleted", cat.name)); })
      .catch(function (err) {
        if (err.status === 400) $("category-error").textContent = err.message;
        else handleError(err);
      });
  });

  /* ---------- instellingen ---------- */
  function renderSettings() {
    var box = $("settings-list");
    box.textContent = "";
    SETTINGS.forEach(function (key) {
      var label = t("set_" + key);
      var cur = state.settings[key] || { value: "", version: 0 };
      var wrap = el("div", "setting");
      var lab = el("label", null, label);
      var row = el("div", "setting-row");
      var input;
      if (key === "theme") {
        input = el("select");
        THEMES.forEach(function (name) {
          var o = el("option", null, t("theme_" + name));
          o.value = name;
          input.appendChild(o);
        });
        input.value = cur.value || "kraft";
      } else {
        input = el("input");
        input.type = "text";
        input.maxLength = 200;
        input.value = cur.value;
      }
      input.id = "set-" + key;
      lab.htmlFor = input.id;
      var btn = el("button", "btn primary", t("save"));
      btn.type = "button";
      btn.addEventListener("click", function () {
        busy(btn, true);
        api("/api/settings/" + key, { version: cur.version, value: input.value })
          .then(function () { busy(btn, false); renderAll(); toast(t("saved", label)); })
          .catch(function (err) { busy(btn, false); handleError(err); });
      });
      row.appendChild(input);
      row.appendChild(btn);
      wrap.appendChild(lab);
      wrap.appendChild(row);
      box.appendChild(wrap);
    });
  }

  /* ---------- toegang ---------- */
  function renderAccess() {
    var acc = state.access;
    var note = $("access-note");
    note.hidden = !(acc.error || !acc.managed);
    note.textContent = acc.error || (!acc.managed ? t("accessNotLinked") : "");
    $("access-form").hidden = !acc.managed;

    var list = $("access-list");
    list.textContent = "";
    acc.owners.map(function (e) { return { email: e, owner: true }; })
      .concat(acc.admins.map(function (e) { return { email: e, owner: false }; }))
      .forEach(function (r) {
        var li = el("li");
        var info = el("span");
        info.appendChild(el("span", null, r.email));
        var tags = [];
        if (r.owner) tags.push(t("owner"));
        if (r.email === state.me) tags.push(t("you"));
        if (tags.length) info.appendChild(el("span", "tagline", tags.join(" · ")));
        li.appendChild(info);
        if (!r.owner && acc.managed) {
          var rm = el("button", "btn danger small", t("remove"));
          rm.type = "button";
          rm.addEventListener("click", function () {
            var self = r.email === state.me;
            if (!window.confirm(self ? t("confirmRemoveSelf") : t("confirmRemove", r.email))) return;
            busy(rm, true);
            api("/api/access/remove", { email: r.email })
              .then(function () { busy(rm, false); renderAll(); toast(t("accessRemoved", r.email)); })
              .catch(function (err) { busy(rm, false); handleError(err); });
          });
          li.appendChild(rm);
        }
        list.appendChild(li);
      });
  }

  var EMAIL_RE = /^[^\s@,;<>"'()]+@[^\s@,;<>"'()]+\.[a-z]{2,}$/i;
  $("access-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var input = $("access-email");
    var email = input.value.trim().toLowerCase();
    $("access-error").textContent = "";
    if (!EMAIL_RE.test(email)) { $("access-error").textContent = t("errEmail"); return; }
    var btn = ev.target.querySelector("button");
    busy(btn, true);
    api("/api/access/add", { email: email })
      .then(function () { busy(btn, false); input.value = ""; renderAll(); toast(t("accessAdded", email)); })
      .catch(function (err) {
        busy(btn, false);
        if (err.status === 400) $("access-error").textContent = err.message;
        else handleError(err);
      });
  });

  /* ---------- geschiedenis en prullenbak ---------- */
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString(locale(), { dateStyle: "short", timeStyle: "short" });
  }

  function renderHistory() {
    var log = $("log-list");
    log.textContent = "";
    if (!state.log.length) log.appendChild(el("li", "muted", t("noChanges")));
    state.log.forEach(function (e) {
      var li = el("li", e.revertible || e.action === "revert" || e.entity === "access" ? "" : "reverted");
      var text = el("span", "text");
      text.appendChild(el("span", "when", when(e.at) + " · " + e.actor));
      text.appendChild(el("span", null, summaryText(e.summary)));
      li.appendChild(text);
      if (e.revertible) {
        var b = el("button", "btn ghost small", t("undo"));
        b.type = "button";
        b.addEventListener("click", function () {
          if (!window.confirm(t("confirmUndo", summaryText(e.summary)))) return;
          busy(b, true);
          api("/api/audit/" + e.id + "/revert", {})
            .then(function () { busy(b, false); renderAll(); toast(t("undone")); })
            .catch(function (err) { busy(b, false); handleError(err); });
        });
        li.appendChild(b);
      }
      log.appendChild(li);
    });

    var trash = $("trash-list");
    trash.textContent = "";
    if (!state.trash.length) trash.appendChild(el("li", "muted", t("trashEmpty")));
    state.trash.forEach(function (x) {
      var li = el("li");
      var text = el("span", "text");
      text.appendChild(el("span", "when", when(x.deleted_at)));
      text.appendChild(el("span", null, x.name));
      li.appendChild(text);
      var b = el("button", "btn ghost small", t("restore"));
      b.type = "button";
      b.addEventListener("click", function () {
        busy(b, true);
        api("/api/items/" + x.id + "/restore", { version: x.version })
          .then(function () { busy(b, false); renderAll(); toast(t("restored", x.name)); })
          .catch(function (err) { busy(b, false); handleError(err); });
      });
      li.appendChild(b);
      trash.appendChild(li);
    });
  }

  /* ---------- QR-kaartjes ---------- */
  // qrcode-generator van cdnjs, pas geladen bij het openen van dit tabblad. De SRI-hash pint de inhoud:
  // verandert het bestand, dan weigert de browser het (belangrijk: deze pagina heeft de login van de beheerder).
  // De CSP van de Worker staat alleen precies deze URL toe.
  var QR_LIB = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  var QR_LIB_SRI = "sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==";
  var qrLib = null;
  var qrUrlSet = false;

  function loadQrLib() {
    if (window.qrcode) return Promise.resolve();
    if (!qrLib) {
      qrLib = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = QR_LIB;
        s.integrity = QR_LIB_SRI;
        s.crossOrigin = "anonymous";
        s.referrerPolicy = "no-referrer";
        s.onload = function () { resolve(); };
        s.onerror = function () { qrLib = null; s.remove(); reject(new Error(t("qrLibError"))); };
        document.head.appendChild(s);
      });
    }
    return qrLib;
  }

  function setting(key) { return state.settings[key] ? state.settings[key].value : ""; }

  function luminance(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return 1;
    return (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255;
  }

  // Altijd donker op licht: scanners lezen omgekeerde codes slecht.
  function qrColors() {
    var cs = getComputedStyle($("qr-sheet"));
    var card = cs.getPropertyValue("--card").trim() || "#fbf7ef";
    var ink = cs.getPropertyValue("--ink").trim() || "#2b2118";
    return luminance(card) >= luminance(ink) ? { light: card, dark: ink } : { light: ink, dark: card };
  }

  function drawQr(canvas, text, scale, colors) {
    var qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    var count = qr.getModuleCount();
    var margin = 2;
    var size = (count + margin * 2) * scale;
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = colors.light;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = colors.dark;
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
  }

  // 4 kaartjes (A6) met naam, slogan en thema van de menukaart; de tekst op de kaartjes is voor gasten (Turks).
  function drawCards() {
    var sheet = $("qr-sheet");
    sheet.textContent = "";
    var url = $("qr-url").value.trim();
    if (!url || !window.qrcode) return;
    var colors = qrColors();
    var name = setting("restaurant_name") || "Menü";
    var subtitle = setting("subtitle");
    for (var i = 0; i < 4; i++) {
      var card = el("div", "qr-card");
      card.appendChild(el("div", "orn", "❦"));
      card.appendChild(el("div", "name", name));
      if (subtitle) card.appendChild(el("p", "sub", subtitle));
      var canvas = document.createElement("canvas");
      drawQr(canvas, url, 12, colors);
      card.appendChild(canvas);
      card.appendChild(el("p", "cta", $("qr-cta").value));
      card.appendChild(el("div", "table", $("qr-table").value));
      sheet.appendChild(card);
    }
  }

  function renderQr() {
    if (!state || $("tab-qr").hidden) return;
    var input = $("qr-url");
    if (!qrUrlSet && state.publicMenuUrl) { input.value = state.publicMenuUrl; qrUrlSet = true; }
    // Alleen de eigenaar mag de link wijzigen (de rest ziet hem alleen).
    input.readOnly = !state.isOwner;
    if (!state.isOwner && state.publicMenuUrl) input.value = state.publicMenuUrl;
    $("qr-url-note").textContent = state.isOwner ? t("qrUrlOwner") : t("qrUrlLocked");
    $("qr-sheet").dataset.bg = setting("theme") || "kraft";
    loadQrLib().then(drawCards).catch(function (err) { toast(err.message, true); });
  }

  ["qr-url", "qr-cta", "qr-table"].forEach(function (id) {
    $(id).addEventListener("input", function () { drawCards(); });
  });
  $("qr-printbg").addEventListener("change", function () {
    $("qr-sheet").classList.toggle("no-print-bg", !$("qr-printbg").checked);
  });
  // Afdrukken vanaf dit tabblad: qr.css verbergt bij body[data-tab="qr"] alles behalve de kaartjes.
  $("qr-print").addEventListener("click", function () { window.print(); });
  $("qr-download").addEventListener("click", function () {
    var url = $("qr-url").value.trim();
    if (!url || !window.qrcode) return;
    var canvas = document.createElement("canvas");
    drawQr(canvas, url, 24, { light: "#ffffff", dark: "#000000" });
    var a = document.createElement("a");
    a.download = "menu-qr.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
  });

  /* ---------- navigatie ---------- */
  function showTab(name) {
    document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("active", x.dataset.tab === name); });
    ["menu", "settings", "access", "history", "qr"].forEach(function (n) { $("tab-" + n).hidden = n !== name; });
    document.body.dataset.tab = name;
    if (name === "qr") renderQr();
  }
  document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () { showTab(tab.dataset.tab); });
  });
  document.body.dataset.tab = "menu";
  document.querySelectorAll('input[name="ptype"]').forEach(function (r) {
    r.addEventListener("change", function () { setPriceType(r.value); });
  });
  $("add-item").addEventListener("click", function () { openItem(null); });
  $("add-category").addEventListener("click", function () { openCategory(null); });
  $("item-back").addEventListener("click", function () { showView("app"); });
  $("category-back").addEventListener("click", function () { showView("app"); });
  $("banner-reload").addEventListener("click", function () { saveDraft(); location.reload(); });
  $("lang").addEventListener("change", function () { setLang($("lang").value); });

  // Start: taal toepassen, gegevens laden, en een bewaard concept (na verlopen sessie) terugzetten.
  applyStatic();
  api("/api/state").then(function () {
    renderAll();
    var draft = takeDraft();
    if (draft) {
      var it = draft.id ? state.items.filter(function (x) { return x.id === draft.id; })[0] : null;
      openItem(it || null, null, draft.fields);
      toast(t("draftRestored"));
    }
  }).catch(handleError);
})();
