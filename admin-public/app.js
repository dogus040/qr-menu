// Beheerpagina Bi Mola. Inloggen doet Cloudflare Access vóór deze pagina;
// hier alleen de JSON-API van de Worker. Teksten voor gebruikers zijn Turks.
(function () {
  "use strict";

  var TAGS = ["Yeni", "Vejetaryen", "Vegan", "Acılı", "Şefin Önerisi"];
  var ALLERGENS = ["Süt", "Gluten", "Yumurta", "Kuruyemiş", "Yer fıstığı", "Soya", "Susam"];
  var THEMES = [["kraft", "Kraft"], ["kagit", "Kağıt"], ["kahve", "Kahve"], ["cini", "Çini"], ["espresso", "Espresso"]];
  var SETTINGS = [
    ["restaurant_name", "Kafe adı"],
    ["subtitle", "Slogan"],
    ["address", "Adres"],
    ["phone", "Telefon"],
    ["instagram", "Instagram kullanıcı adı"],
    ["hours", "Çalışma saatleri"],
    ["footer_note", "Menünün altındaki not"],
    ["theme", "Arka plan"],
    ["currency", "Para birimi"],
    ["size_small_label", "Küçük boy etiketi"],
    ["size_large_label", "Büyük boy etiketi"]
  ];
  var DRAFT_KEY = "bimola-admin-draft";

  var state = null;
  var editingItem = null;      // null = nieuw product
  var editingCategory = null;  // null = nieuwe categorie
  var extra = { tags: [], allergens: [] };

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
    var t = $("toast");
    t.textContent = msg;
    t.classList.toggle("bad", Boolean(bad));
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, bad ? 5000 : 2200);
  }

  function banner(msg) {
    $("banner-text").textContent = msg;
    $("banner").hidden = !msg;
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Kaydediliyor…"; }
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
  function SessionError() { this.message = "Oturumun süresi doldu."; }

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
          var err = new Error(data.error || "Bir hata oluştu.");
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
      banner("Oturumun süresi doldu. Değişikliğiniz kaydedilmedi; yeniden giriş yapıp tekrar deneyin.");
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
    renderMenu();
    renderSettings();
    renderAccess();
    renderHistory();
  }

  function itemsOf(catId) {
    return state.items.filter(function (i) { return i.category_id === catId; });
  }

  function priceText(it) {
    if (it.price_small !== null || it.price_large !== null) {
      return "Küçük " + (money(it.price_small) || "–") + " ₺ · Büyük " + (money(it.price_large) || "–") + " ₺";
    }
    return it.price !== null ? money(it.price) + " ₺" : "Fiyat yok";
  }

  function renderMenu() {
    var box = $("menu-list");
    box.textContent = "";
    if (!state.categories.length) {
      box.appendChild(el("p", "empty", "Henüz kategori yok. Önce bir kategori ekleyin."));
      return;
    }
    state.categories.forEach(function (cat) {
      var section = el("section", "cat");
      var head = el("div", "cat-head");
      var h = el("h2", null, cat.name);
      if (!cat.visible) h.appendChild(el("span", "badge hidden-badge", "Gizli"));
      head.appendChild(h);
      var actions = el("div", "cat-actions");
      var edit = el("button", "btn ghost small", "Düzenle");
      edit.type = "button";
      edit.addEventListener("click", function () { openCategory(cat); });
      var add = el("button", "btn ghost small", "+ Ekle");
      add.type = "button";
      add.addEventListener("click", function () { openItem(null, cat.id); });
      actions.appendChild(edit);
      actions.appendChild(add);
      head.appendChild(actions);
      section.appendChild(head);
      if (cat.note) section.appendChild(el("p", "cat-note", cat.note));

      var items = itemsOf(cat.id);
      if (!items.length) section.appendChild(el("p", "cat-note", "Bu kategoride ürün yok."));
      items.forEach(function (it) {
        var on = Boolean(it.available);
        var row = el("div", "row" + (on ? "" : " off"));
        var main = el("button", "row-main");
        main.type = "button";
        var name = el("span", "row-name", it.name);
        if (!on) name.appendChild(el("span", "badge", "Tükendi"));
        main.appendChild(name);
        main.appendChild(el("span", "row-price", priceText(it)));
        main.addEventListener("click", function () { openItem(it); });
        row.appendChild(main);

        var sw = el("input", "switch");
        sw.type = "checkbox";
        sw.checked = on;
        sw.setAttribute("aria-label", it.name + ": satışta");
        sw.addEventListener("change", function () {
          sw.disabled = true;
          api("/api/items/" + it.id + "/available", { version: it.version, available: sw.checked })
            .then(function () { renderAll(); toast(it.name + (sw.checked ? ": satışta" : ": tükendi")); })
            .catch(function (err) { sw.checked = !sw.checked; sw.disabled = false; handleError(err); });
        });
        row.appendChild(sw);
        section.appendChild(row);
      });
      box.appendChild(section);
    });
  }

  /* ---------- product bewerken ---------- */
  function renderChips(boxId, options, selected, extraKey) {
    var box = $(boxId);
    box.textContent = "";
    var chosen = selected.map(norm);
    options.forEach(function (opt) {
      var b = el("button", "chip", opt);
      b.type = "button";
      b.setAttribute("aria-pressed", chosen.indexOf(norm(opt)) !== -1 ? "true" : "false");
      b.addEventListener("click", function () {
        b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
      });
      box.appendChild(b);
    });
    var known = options.map(norm);
    extra[extraKey] = selected.filter(function (s) { return known.indexOf(norm(s)) === -1; });
  }

  function chipValues(boxId, extraKey) {
    var vals = [];
    $(boxId).querySelectorAll(".chip").forEach(function (b) {
      if (b.getAttribute("aria-pressed") === "true") vals.push(b.textContent);
    });
    return vals.concat(extra[extraKey]);
  }

  function setPriceType(type) {
    document.querySelectorAll('input[name="ptype"]').forEach(function (r) { r.checked = r.value === type; });
    $("price-single").hidden = type !== "single";
    $("price-sizes").hidden = type !== "sizes";
  }

  function openItem(it, presetCategory, draft) {
    editingItem = it;
    $("item-title").textContent = it ? "Ürünü düzenle" : "Yeni ürün";
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
    var sized = f.priceSmall !== undefined ? Boolean(f.priceSmall || f.priceLarge)
      : Boolean(it && (it.price_small !== null || it.price_large !== null));
    $("f-price").value = f.price !== undefined ? f.price || "" : it ? moneyInput(it.price) : "";
    $("f-small").value = f.priceSmall !== undefined ? f.priceSmall || "" : it ? moneyInput(it.price_small) : "";
    $("f-large").value = f.priceLarge !== undefined ? f.priceLarge || "" : it ? moneyInput(it.price_large) : "";
    setPriceType(sized ? "sizes" : "single");
    $("f-available").checked = f.available !== undefined ? f.available : it ? Boolean(it.available) : true;
    renderChips("f-tags", TAGS, f.tags || (it ? it.tags : []), "tags");
    renderChips("f-allergens", ALLERGENS, f.allergens || (it ? it.allergens : []), "allergens");
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
      tags: chipValues("f-tags", "tags"),
      allergens: chipValues("f-allergens", "allergens")
    };
    if (raw) return f;
    if (!f.name) return { error: "Ürün adını yazın." };
    if (!f.categoryId) return { error: "Önce bir kategori ekleyin." };
    if (sizes ? !(f.priceSmall || f.priceLarge) : !f.price) return { error: sizes ? "En az bir boy için fiyat yazın." : "Fiyatı yazın." };
    return { fields: f };
  }

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
      .then(function () { busy(btn, false); renderAll(); showView("app"); toast("Kaydedildi: " + c.fields.name); })
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
        toast("Taşındı");
      })
      .catch(function (err) { busy(btn, false); handleError(err); });
  }
  $("item-up").addEventListener("click", function () { moveItem(-1); });
  $("item-down").addEventListener("click", function () { moveItem(1); });

  $("item-delete").addEventListener("click", function () {
    var it = editingItem;
    if (!window.confirm("\"" + it.name + "\" silinsin mi? Geçmiş sekmesindeki çöp kutusundan geri getirebilirsiniz.")) return;
    var btn = $("item-delete");
    busy(btn, true);
    api("/api/items/" + it.id + "/delete", { version: it.version })
      .then(function () { busy(btn, false); renderAll(); showView("app"); toast("Silindi: " + it.name); })
      .catch(function (err) { busy(btn, false); handleError(err); });
  });

  /* ---------- categorie bewerken ---------- */
  function openCategory(cat) {
    editingCategory = cat;
    $("category-title").textContent = cat ? "Kategoriyi düzenle" : "Yeni kategori";
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
    if (!name) { $("category-error").textContent = "Kategori adını yazın."; return; }
    var cat = editingCategory;
    var body = { name: name, note: $("c-note").value.trim(), visible: $("c-visible").checked };
    if (cat) body.version = cat.version;
    var btn = $("category-save");
    busy(btn, true);
    api(cat ? "/api/categories/" + cat.id : "/api/categories", body)
      .then(function () { busy(btn, false); renderAll(); showView("app"); toast("Kaydedildi: " + name); })
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
        toast("Taşındı");
      })
      .catch(handleError);
  }
  $("category-up").addEventListener("click", function () { moveCategory(-1); });
  $("category-down").addEventListener("click", function () { moveCategory(1); });

  $("category-delete").addEventListener("click", function () {
    var cat = editingCategory;
    if (!window.confirm("\"" + cat.name + "\" kategorisi silinsin mi?")) return;
    api("/api/categories/" + cat.id + "/delete", { version: cat.version })
      .then(function () { renderAll(); showView("app"); toast("Silindi: " + cat.name); })
      .catch(function (err) {
        if (err.status === 400) $("category-error").textContent = err.message;
        else handleError(err);
      });
  });

  /* ---------- instellingen ---------- */
  function renderSettings() {
    var box = $("settings-list");
    box.textContent = "";
    SETTINGS.forEach(function (s) {
      var key = s[0];
      var cur = state.settings[key] || { value: "", version: 0 };
      var wrap = el("div", "setting");
      var lab = el("label", null, s[1]);
      var row = el("div", "setting-row");
      var input;
      if (key === "theme") {
        input = el("select");
        THEMES.forEach(function (t) {
          var o = el("option", null, t[1]);
          o.value = t[0];
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
      var btn = el("button", "btn primary", "Kaydet");
      btn.type = "button";
      btn.addEventListener("click", function () {
        busy(btn, true);
        api("/api/settings/" + key, { version: cur.version, value: input.value })
          .then(function () { busy(btn, false); renderAll(); toast("Kaydedildi: " + s[1]); })
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
    note.textContent = acc.error || (!acc.managed ? "Erişim listesi henüz Cloudflare Access'e bağlanmadı." : "");
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
        if (r.owner) tags.push("Sahibi");
        if (r.email === state.me) tags.push("Sen");
        if (tags.length) info.appendChild(el("span", "tagline", tags.join(" · ")));
        li.appendChild(info);
        if (!r.owner && acc.managed) {
          var rm = el("button", "btn danger small", "Kaldır");
          rm.type = "button";
          rm.addEventListener("click", function () {
            var self = r.email === state.me;
            var msg = self
              ? "Kendi erişiminizi kaldırırsanız artık giriş yapamazsınız. Devam edilsin mi?"
              : "\"" + r.email + "\" artık menüyü düzenleyemeyecek. Devam edilsin mi?";
            if (!window.confirm(msg)) return;
            busy(rm, true);
            api("/api/access/remove", { email: r.email })
              .then(function () { busy(rm, false); renderAll(); toast("Erişim kaldırıldı: " + r.email); })
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
    if (!EMAIL_RE.test(email)) { $("access-error").textContent = "Geçerli bir e-posta adresi yazın."; return; }
    var btn = ev.target.querySelector("button");
    busy(btn, true);
    api("/api/access/add", { email: email })
      .then(function () { busy(btn, false); input.value = ""; renderAll(); toast("Erişim eklendi: " + email); })
      .catch(function (err) {
        busy(btn, false);
        if (err.status === 400) $("access-error").textContent = err.message;
        else handleError(err);
      });
  });

  /* ---------- geschiedenis en prullenbak ---------- */
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
  }

  function renderHistory() {
    var log = $("log-list");
    log.textContent = "";
    if (!state.log.length) log.appendChild(el("li", "muted", "Henüz değişiklik yok."));
    state.log.forEach(function (e) {
      var li = el("li", e.revertible || e.action === "revert" || e.entity === "access" ? "" : "reverted");
      var text = el("span", "text");
      text.appendChild(el("span", "when", when(e.at) + " · " + e.actor));
      text.appendChild(el("span", null, e.summary));
      li.appendChild(text);
      if (e.revertible) {
        var b = el("button", "btn ghost small", "Geri al");
        b.type = "button";
        b.addEventListener("click", function () {
          if (!window.confirm("Bu değişiklik geri alınsın mı?\n" + e.summary)) return;
          busy(b, true);
          api("/api/audit/" + e.id + "/revert", {})
            .then(function () { busy(b, false); renderAll(); toast("Geri alındı"); })
            .catch(function (err) { busy(b, false); handleError(err); });
        });
        li.appendChild(b);
      }
      log.appendChild(li);
    });

    var trash = $("trash-list");
    trash.textContent = "";
    if (!state.trash.length) trash.appendChild(el("li", "muted", "Çöp kutusu boş."));
    state.trash.forEach(function (t) {
      var li = el("li");
      var text = el("span", "text");
      text.appendChild(el("span", "when", when(t.deleted_at)));
      text.appendChild(el("span", null, t.name));
      li.appendChild(text);
      var b = el("button", "btn ghost small", "Geri getir");
      b.type = "button";
      b.addEventListener("click", function () {
        busy(b, true);
        api("/api/items/" + t.id + "/restore", { version: t.version })
          .then(function () { busy(b, false); renderAll(); toast("Geri getirildi: " + t.name); })
          .catch(function (err) { busy(b, false); handleError(err); });
      });
      li.appendChild(b);
      trash.appendChild(li);
    });
  }

  /* ---------- navigatie ---------- */
  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("active", x === t); });
      ["menu", "settings", "access", "history"].forEach(function (name) {
        $("tab-" + name).hidden = t.dataset.tab !== name;
      });
    });
  });
  document.querySelectorAll('input[name="ptype"]').forEach(function (r) {
    r.addEventListener("change", function () { setPriceType(r.value); });
  });
  $("add-item").addEventListener("click", function () { openItem(null); });
  $("add-category").addEventListener("click", function () { openCategory(null); });
  $("item-back").addEventListener("click", function () { showView("app"); });
  $("category-back").addEventListener("click", function () { showView("app"); });
  $("banner-reload").addEventListener("click", function () { saveDraft(); location.reload(); });

  // Start: gegevens laden, en een bewaard concept (na verlopen sessie) terugzetten.
  api("/api/state").then(function () {
    renderAll();
    var draft = takeDraft();
    if (draft) {
      var it = draft.id ? state.items.filter(function (x) { return x.id === draft.id; })[0] : null;
      openItem(it || null, null, draft.fields);
      toast("Kaydedilmemiş değişikliğiniz geri yüklendi. Kontrol edip kaydedin.");
    }
  }).catch(handleError);
})();
