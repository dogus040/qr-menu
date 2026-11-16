// Beheerpagina: leest en schrijft de Google Sheet via de Apps Script-web-app
// (apps-script/Code.gs). Alle teksten voor de gebruiker zijn Turks.
(function () {
  "use strict";

  var cfg = window.MENU_CONFIG || {};
  var API = cfg.adminApiUrl || "";

  var TAGS = ["Yeni", "Vejetaryen", "Vegan", "Acılı", "Şefin Önerisi"];
  var ALLERGENS = ["Süt", "Gluten", "Yumurta", "Kuruyemiş", "Yer fıstığı", "Soya", "Susam"];
  var THEMES = [["kraft", "Kraft"], ["kagit", "Kağıt"], ["kahve", "Kahve"], ["cini", "Çini"], ["espresso", "Espresso"]];
  // Volgorde en Turkse labels van de instellingen (sleutel = genormaliseerde naam in de sheet).
  var SETTINGS = [
    ["restoranadi", "Restoran Adı", "Kafe adı"],
    ["altbaslik", "Alt Başlık", "Slogan"],
    ["adres", "Adres", "Adres"],
    ["telefon", "Telefon", "Telefon"],
    ["instagram", "Instagram", "Instagram kullanıcı adı"],
    ["calismasaatleri", "Çalışma Saatleri", "Çalışma saatleri"],
    ["altnot", "Alt Not", "Menünün altındaki not"],
    ["arkaplan", "Arka Plan", "Arka plan"],
    ["parabirimi", "Para Birimi", "Para birimi"]
  ];
  var FIELDS = ["kategori", "urun", "aciklama", "fiyat", "kucuk", "buyuk", "etiket", "alerjen", "goster"];
  var TOKEN_KEY = "bimola-yonetim-token";

  var state = { idToken: "", data: null, editing: null, extraTags: [], extraAllergens: [] };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== "") n.textContent = text;
    return n;
  }

  function norm(s) {
    return String(s || "").trim().toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]/g, "");
  }

  function splitList(v) {
    return String(v || "").split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function isOn(item) {
    var k = norm(item.goster);
    return !(k === "hayir" || k === "h" || k === "0" || k === "false");
  }

  /* ---------- Google-token (alleen deze browsersessie, max. 1 uur geldig) ---------- */
  // Inhoud van het ID-token lezen (alleen voor weergave en vervaltijd;
  // de echte controle doet het script bij Google).
  function tokenPayload(token) {
    try {
      var part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      var json = decodeURIComponent(atob(part).split("").map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  }

  function tokenValid(token) {
    var exp = Number(tokenPayload(token).exp || 0);
    return !exp || exp * 1000 > Date.now() + 60000;
  }

  function saveToken(t) { try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) { /* privévenster */ } }
  function loadToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function clearToken() { try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* niets */ } }

  /* ---------- API ---------- */
  function api(action, extra) {
    if (!API) return Promise.reject(new Error("Kurulum tamamlanmadı: yönetim bağlantısı (adminApiUrl) eksik."));
    if (!state.idToken || !tokenValid(state.idToken)) {
      var expired = new Error("Oturumun süresi doldu. Tekrar giriş yapın.");
      expired.auth = true;
      return Promise.reject(expired);
    }
    var body = { action: action, idToken: state.idToken };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    // Geen eigen headers: zo blijft het een "simple request" zonder CORS-preflight.
    return fetch(API, { method: "POST", body: JSON.stringify(body), redirect: "follow" })
      .then(function (res) { return res.json(); })
      .catch(function () { throw new Error("Bağlantı hatası. İnterneti kontrol edip tekrar deneyin."); })
      .then(function (res) {
        if (!res || !res.ok) {
          var err = new Error((res && res.error) || "Bir hata oluştu.");
          err.auth = Boolean(res && res.auth);
          err.denied = Boolean(res && res.denied);
          throw err;
        }
        state.data = res.data;
        return res.data;
      });
  }

  /* ---------- weergave ---------- */
  var toastTimer;
  function toast(msg, bad) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.toggle("bad", Boolean(bad));
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, bad ? 4500 : 2200);
  }

  function showView(name) {
    ["login", "app", "edit"].forEach(function (v) { $("view-" + v).hidden = v !== name; });
    window.scrollTo(0, 0);
  }

  function handleError(err) {
    if (err.auth || err.denied) {
      signOut(err.message, err.denied);
      return;
    }
    toast(err.message, true);
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = "Kaydediliyor…"; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
  }

  function categories() {
    var seen = {}, list = [];
    (state.data ? state.data.items : []).forEach(function (it) {
      var k = norm(it.kategori);
      if (it.kategori && !seen[k]) { seen[k] = true; list.push(it.kategori); }
    });
    return list;
  }

  function priceText(it) {
    if (it.kucuk || it.buyuk) {
      return "Küçük " + (it.kucuk || "–") + " ₺ · Büyük " + (it.buyuk || "–") + " ₺";
    }
    return it.fiyat ? it.fiyat + " ₺" : "Fiyat yok";
  }

  function fieldsOf(it) {
    var f = {};
    FIELDS.forEach(function (k) { f[k] = it[k] || ""; });
    return f;
  }

  /* ---------- menülijst ---------- */
  function renderMenu() {
    var box = $("menu-list");
    box.textContent = "";
    var items = state.data.items;
    var cats = categories();
    if (!cats.length) { box.appendChild(el("p", "empty", "Henüz ürün yok. Aşağıdan ekleyin.")); return; }

    cats.forEach(function (cat) {
      var section = el("section", "cat");
      var head = el("div", "cat-head");
      head.appendChild(el("h2", null, cat));
      var add = el("button", "btn ghost small", "+ Ekle");
      add.type = "button";
      add.addEventListener("click", function () { openEdit(null, cat); });
      head.appendChild(add);
      section.appendChild(head);

      items.forEach(function (it) {
        if (norm(it.kategori) !== norm(cat)) return;
        if (it.note) { section.appendChild(el("p", "cat-note", it.aciklama)); return; }

        var row = el("div", "row" + (isOn(it) ? "" : " off"));
        var main = el("button", "row-main");
        main.type = "button";
        var name = el("span", "row-name", it.urun);
        if (!isOn(it)) name.appendChild(el("span", "badge", "Tükendi"));
        main.appendChild(name);
        main.appendChild(el("span", "row-price", priceText(it)));
        main.addEventListener("click", function () { openEdit(it); });
        row.appendChild(main);

        var sw = el("input", "switch");
        sw.type = "checkbox";
        sw.checked = isOn(it);
        sw.setAttribute("aria-label", it.urun + ": satışta");
        sw.addEventListener("change", function () { toggleItem(it, sw); });
        row.appendChild(sw);
        section.appendChild(row);
      });
      box.appendChild(section);
    });
  }

  function toggleItem(it, sw) {
    var on = sw.checked;
    sw.disabled = true;
    var f = fieldsOf(it);
    f.goster = on ? "evet" : "hayır";
    api("update", { row: it.row, check: it.urun, fields: f })
      .then(function () {
        renderMenu();
        toast(it.urun + (on ? ": satışta" : ": tükendi"));
      })
      .catch(function (err) {
        sw.checked = !on;
        sw.disabled = false;
        handleError(err);
      });
  }

  /* ---------- bewerken ---------- */
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
    // Waarden die niet in de lijst staan bewaren we ongewijzigd.
    var known = options.map(norm);
    state[extraKey] = selected.filter(function (s) { return known.indexOf(norm(s)) === -1; });
  }

  function chipValues(boxId, extraKey) {
    var vals = [];
    $(boxId).querySelectorAll(".chip").forEach(function (b) {
      if (b.getAttribute("aria-pressed") === "true") vals.push(b.textContent);
    });
    return vals.concat(state[extraKey]).join(", ");
  }

  function setPriceType(type) {
    document.querySelectorAll('input[name="ptype"]').forEach(function (r) { r.checked = r.value === type; });
    $("price-single").hidden = type !== "single";
    $("price-sizes").hidden = type !== "sizes";
  }

  function fillCategorySelect(selected) {
    var sel = $("f-kategori");
    sel.textContent = "";
    categories().forEach(function (c) {
      var o = el("option", null, c);
      o.value = c;
      sel.appendChild(o);
    });
    var n = el("option", null, "+ Yeni kategori…");
    n.value = "__new";
    sel.appendChild(n);
    sel.value = selected && categories().some(function (c) { return c === selected; }) ? selected : (categories()[0] || "__new");
    $("f-kategori-new").hidden = sel.value !== "__new";
    $("f-kategori-new").value = "";
  }

  function openEdit(item, presetCat) {
    state.editing = item;
    $("edit-title").textContent = item ? "Ürünü düzenle" : "Yeni ürün";
    $("edit-error").textContent = "";
    $("f-urun").value = item ? item.urun : "";
    fillCategorySelect(item ? item.kategori : presetCat);
    $("f-aciklama").value = item ? item.aciklama : "";
    $("f-fiyat").value = item ? item.fiyat : "";
    $("f-kucuk").value = item ? item.kucuk : "";
    $("f-buyuk").value = item ? item.buyuk : "";
    setPriceType(item && (item.kucuk || item.buyuk) ? "sizes" : "single");
    $("f-goster").checked = item ? isOn(item) : true;
    renderChips("f-etiket", TAGS, item ? splitList(item.etiket) : [], "extraTags");
    renderChips("f-alerjen", ALLERGENS, item ? splitList(item.alerjen) : [], "extraAllergens");
    $("edit-extra").hidden = !item;
    showView("edit");
    if (!item) $("f-urun").focus();
  }

  var PRICE_RE = /^\d+([.,]\d{1,2})?$/;

  function collect() {
    var sizes = document.querySelector('input[name="ptype"]:checked').value === "sizes";
    var kat = $("f-kategori").value === "__new" ? $("f-kategori-new").value.trim() : $("f-kategori").value;
    var f = {
      urun: $("f-urun").value.trim(),
      kategori: kat,
      aciklama: $("f-aciklama").value.trim(),
      fiyat: sizes ? "" : $("f-fiyat").value.trim(),
      kucuk: sizes ? $("f-kucuk").value.trim() : "",
      buyuk: sizes ? $("f-buyuk").value.trim() : "",
      etiket: chipValues("f-etiket", "extraTags"),
      alerjen: chipValues("f-alerjen", "extraAllergens"),
      goster: $("f-goster").checked ? "evet" : "hayır"
    };
    if (!f.urun) return { error: "Ürün adını yazın." };
    if (!f.kategori) return { error: "Kategori seçin veya yeni kategori adı yazın." };
    var prices = sizes ? [f.kucuk, f.buyuk] : [f.fiyat];
    if (!prices.some(Boolean)) return { error: sizes ? "En az bir boy için fiyat yazın." : "Fiyatı yazın." };
    for (var i = 0; i < prices.length; i++) {
      if (prices[i] && !PRICE_RE.test(prices[i])) return { error: "Fiyat sadece rakam olmalı (örnek: 180)." };
    }
    return { fields: f };
  }

  function afterSave(msg) {
    renderMenu();
    showView("app");
    toast(msg);
  }

  function saveEdit(ev) {
    ev.preventDefault();
    var c = collect();
    if (c.error) { $("edit-error").textContent = c.error; return; }
    $("edit-error").textContent = "";
    var btn = $("edit-save");
    busy(btn, true);
    var it = state.editing;
    var call = it
      ? api("update", { row: it.row, check: it.urun, fields: c.fields })
      : api("add", { fields: c.fields });
    call.then(function () { busy(btn, false); afterSave("Kaydedildi: " + c.fields.urun); })
      .catch(function (err) { busy(btn, false); handleError(err); });
  }

  function deleteItem() {
    var it = state.editing;
    if (!it) return;
    if (!window.confirm("\"" + it.urun + "\" silinsin mi? Bu işlem geri alınamaz.")) return;
    var btn = $("edit-delete");
    busy(btn, true);
    api("delete", { row: it.row, check: it.urun })
      .then(function () { busy(btn, false); afterSave("Silindi: " + it.urun); })
      .catch(function (err) { busy(btn, false); handleError(err); });
  }

  function moveItem(direction) {
    var it = state.editing;
    if (!it) return;
    var btn = $(direction < 0 ? "move-up" : "move-down");
    busy(btn, true);
    api("move", { row: it.row, check: it.urun, direction: direction })
      .then(function (data) {
        busy(btn, false);
        // Zelfde product terugvinden (rijnummer is veranderd).
        var again = data.items.filter(function (x) {
          return x.urun === it.urun && norm(x.kategori) === norm(it.kategori);
        })[0];
        state.editing = again || null;
        if (again && again.row === it.row) toast("Bu ürün zaten en " + (direction < 0 ? "üstte." : "altta."));
        else toast("Taşındı");
        renderMenu();
      })
      .catch(function (err) { busy(btn, false); handleError(err); });
  }

  /* ---------- ayarlar ---------- */
  function renderSettings() {
    var box = $("settings-list");
    box.textContent = "";
    var list = state.data.settings.slice();
    var used = {};

    function addRow(sheetKey, label, value, normKey) {
      var wrap = el("div", "setting");
      var lab = el("label", null, label);
      var row = el("div", "setting-row");
      var input;
      if (normKey === "arkaplan") {
        input = el("select");
        THEMES.forEach(function (t) {
          var o = el("option", null, t[1]);
          o.value = t[0];
          input.appendChild(o);
        });
        input.value = norm(value) || "kraft";
      } else {
        input = el("input");
        input.type = "text";
        input.maxLength = 200;
        input.value = value;
      }
      var id = "set-" + normKey;
      input.id = id;
      lab.htmlFor = id;
      var btn = el("button", "btn primary", "Kaydet");
      btn.type = "button";
      btn.addEventListener("click", function () {
        busy(btn, true);
        api("setting", { key: sheetKey, value: input.value })
          .then(function () { busy(btn, false); toast("Kaydedildi: " + label); })
          .catch(function (err) { busy(btn, false); handleError(err); });
      });
      row.appendChild(input);
      row.appendChild(btn);
      wrap.appendChild(lab);
      wrap.appendChild(row);
      box.appendChild(wrap);
    }

    SETTINGS.forEach(function (s) {
      var found = list.filter(function (x) { return norm(x.key) === s[0]; })[0];
      used[s[0]] = true;
      addRow(found ? found.key : s[1], s[2], found ? found.value : "", s[0]);
    });
    list.forEach(function (x) {
      var k = norm(x.key);
      if (!used[k]) addRow(x.key, x.key, x.value, k);
    });
  }

  /* ---------- erişim (witte lijst) en log ---------- */
  function renderAccess() {
    var acc = state.data.access || { emails: [] };
    $("me").textContent = acc.me || "";

    var list = $("access-list");
    list.textContent = "";
    var rows = [];
    if (acc.owner) rows.push({ email: acc.owner, owner: true });
    acc.emails.forEach(function (e) { rows.push({ email: e, owner: false }); });

    rows.forEach(function (r) {
      var li = el("li");
      var info = el("span");
      info.appendChild(el("span", null, r.email));
      var tags = [];
      if (r.owner) tags.push("Sahibi");
      if (r.email === acc.me) tags.push("Sen");
      if (tags.length) info.appendChild(el("span", "tagline", tags.join(" · ")));
      li.appendChild(info);
      if (!r.owner) {
        var rm = el("button", "btn danger small", "Kaldır");
        rm.type = "button";
        rm.addEventListener("click", function () { removeAccess(r.email, rm); });
        li.appendChild(rm);
      }
      list.appendChild(li);
    });

    var log = $("log-list");
    log.textContent = "";
    var entries = state.data.log || [];
    if (!entries.length) log.appendChild(el("li", "muted", "Henüz değişiklik yok."));
    entries.forEach(function (x) {
      var li = el("li");
      var when = new Date(x.t);
      li.appendChild(el("span", "when", (isNaN(when) ? x.t : when.toLocaleString("tr-TR")) + " · " + x.who));
      li.appendChild(el("span", null, x.what));
      log.appendChild(li);
    });
  }

  function removeAccess(email, btn) {
    var self = state.data.access && email === state.data.access.me;
    var msg = self
      ? "Kendi erişiminizi kaldırırsanız artık giriş yapamazsınız. Devam edilsin mi?"
      : "\"" + email + "\" artık menüyü düzenleyemeyecek. Devam edilsin mi?";
    if (!window.confirm(msg)) return;
    busy(btn, true);
    api("accessRemove", { email: email })
      .then(function () {
        busy(btn, false);
        toast("Erişim kaldırıldı: " + email);
        if (self) { signOut("Erişiminiz kaldırıldı."); return; }
        renderAccess();
      })
      .catch(function (err) { busy(btn, false); handleError(err); });
  }

  var EMAIL_RE = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}$/i;

  $("access-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var input = $("access-email");
    var email = input.value.trim().toLowerCase();
    $("access-error").textContent = "";
    if (!EMAIL_RE.test(email)) { $("access-error").textContent = "Geçerli bir e-posta adresi yazın."; return; }
    var btn = ev.target.querySelector("button");
    busy(btn, true);
    api("accessAdd", { email: email })
      .then(function () {
        busy(btn, false);
        input.value = "";
        renderAccess();
        toast("Erişim eklendi: " + email);
      })
      .catch(function (err) {
        busy(btn, false);
        if (err.auth || err.denied) { handleError(err); return; }
        $("access-error").textContent = err.message;
      });
  });

  /* ---------- inloggen met Google ---------- */
  function enterApp() {
    renderMenu();
    renderSettings();
    renderAccess();
    showView("app");
  }

  function setLoginState(status, error, offerSwitch) {
    $("login-status").textContent = status || "";
    $("login-error").textContent = error || "";
    $("switch-account").hidden = !offerSwitch;
  }

  // Wordt aangeroepen door Google ("Sign in with Google") met een ID-token.
  function onCredential(response) {
    state.idToken = response && response.credential ? response.credential : "";
    if (!state.idToken) return;
    setLoginState("Giriş kontrol ediliyor…");
    api("list")
      .then(function () {
        saveToken(state.idToken);
        setLoginState("");
        enterApp();
      })
      .catch(function (err) {
        state.idToken = "";
        clearToken();
        setLoginState("", err.message, err.denied);
        showView("login");
      });
  }

  function signOut(message, offerSwitch) {
    clearToken();
    state.idToken = "";
    state.data = null;
    try { if (window.google && google.accounts) google.accounts.id.disableAutoSelect(); } catch (e) { /* niets */ }
    showView("login");
    setLoginState("", message || "", offerSwitch);
  }

  var gisReady = false;
  function initGis() {
    if (gisReady || !(window.google && google.accounts && google.accounts.id)) return;
    if (!cfg.googleClientId) {
      setLoginState("", "Kurulum tamamlanmadı: Google giriş ayarı (googleClientId) eksik.");
      return;
    }
    gisReady = true;
    google.accounts.id.initialize({
      client_id: cfg.googleClientId,
      callback: onCredential,
      auto_select: true,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true,
      itp_support: true,
      context: "signin"
    });
    google.accounts.id.renderButton($("gsi-button"), {
      type: "standard", theme: "outline", size: "large", text: "signin_with",
      shape: "pill", logo_alignment: "left", locale: "tr", width: 260
    });
    if (!state.idToken) google.accounts.id.prompt();
  }
  window.onGoogleLibraryLoad = initGis;

  $("switch-account").addEventListener("click", function () {
    try { google.accounts.id.disableAutoSelect(); google.accounts.id.prompt(); } catch (e) { /* niets */ }
    setLoginState("Google hesabınızı seçin.");
  });

  $("logout").addEventListener("click", function () { signOut("Çıkış yapıldı."); });

  document.querySelectorAll(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      document.querySelectorAll(".tab").forEach(function (x) { x.classList.toggle("active", x === t); });
      ["menu", "settings", "access"].forEach(function (name) {
        $("tab-" + name).hidden = t.dataset.tab !== name;
      });
      if (t.dataset.tab === "access" && state.data) renderAccess();
    });
  });

  document.querySelectorAll('input[name="ptype"]').forEach(function (r) {
    r.addEventListener("change", function () { setPriceType(r.value); });
  });
  $("f-kategori").addEventListener("change", function () {
    $("f-kategori-new").hidden = $("f-kategori").value !== "__new";
    if (!$("f-kategori-new").hidden) $("f-kategori-new").focus();
  });
  $("add-new").addEventListener("click", function () { openEdit(null); });
  $("edit-back").addEventListener("click", function () { showView("app"); });
  $("edit-form").addEventListener("submit", saveEdit);
  $("edit-delete").addEventListener("click", deleteItem);
  $("move-up").addEventListener("click", function () { moveItem(-1); });
  $("move-down").addEventListener("click", function () { moveItem(1); });

  // Alleen voor lokaal testen (localhost): inloggen met een test-token.
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    window.__bimolaTestLogin = function (token) { onCredential({ credential: token }); };
  }

  if (!API) {
    setLoginState("", "Kurulum tamamlanmadı: yönetim bağlantısı (adminApiUrl) eksik.");
  }
  // Nog geldig token uit deze sessie? Dan meteen door.
  var saved = loadToken();
  if (saved && API && tokenValid(saved)) {
    state.idToken = saved;
    setLoginState("Giriş kontrol ediliyor…");
    api("list").then(function () { setLoginState(""); enterApp(); }).catch(function (err) {
      clearToken();
      state.idToken = "";
      setLoginState("", err.auth ? "" : err.message, err.denied);
    });
  } else {
    clearToken();
  }
  initGis();
})();
