/**
 * Bi Mola – menü yönetimi (beheerpagina-API)
 * ---------------------------------------------------------------------------
 * Google Apps Script voor de Google Sheet "Bi Mola – Menü" (SHEET_ID hieronder).
 * De pagina bimola.pages.dev/yonetim praat hiermee.
 *
 * Toegang: inloggen met Google. De pagina stuurt bij elk verzoek het
 * ID-token van "Sign in with Google" mee; dit script laat Google het token
 * controleren (handtekening, bestemd voor OAUTH_CLIENT_ID, niet verlopen,
 * e-mail geverifieerd) en kijkt daarna of het e-mailadres op de witte lijst
 * staat. De eigenaar van het script mag er altijd in en kan niet van de lijst.
 * De witte lijst staat in de scripteigenschap ALLOWED_EMAILS en wordt via
 * de beheerpagina (tab "Erişim") bijgehouden. Elke wijziging komt in een
 * wijzigingslog (scripteigenschap CHANGE_LOG: wie, wanneer, wat).
 *
 * Installatie (eenmalig, door de eigenaar van de Sheet):
 *   1. script.google.com → Nieuw project, plak dit bestand in Code.gs.
 *   2. Vul OAUTH_CLIENT_ID hieronder in (Google Cloud → OAuth-client, type Web,
 *      toegestane JavaScript-oorsprong https://bimola.pages.dev).
 *   3. Implementeren → Nieuwe implementatie → Web-app,
 *      Uitvoeren als: Ik, Toegang: Iedereen. Kopieer de web-app-URL.
 *   4. Zet die URL bij adminApiUrl en de client-ID bij googleClientId in js/config.js.
 *
 * Geen geheimen in dit bestand: de client-ID is openbaar, de witte lijst
 * staat in de scripteigenschappen.
 */

// ID van de Google Sheet "Bi Mola – Menü" (uit de link: /spreadsheets/d/<ID>/edit).
var SHEET_ID = "1WMBCNGtdqOYoTtWO3RERnBfEVjyKoajX4JKQ2dgdHfU";
// OAuth-client-ID ("Sign in with Google") van de beheerpagina.
var OAUTH_CLIENT_ID = "";
var MENU_SHEET = "menu";
var SETTINGS_SHEET = "ayarlar";
var LOG_MAX = 80;           // aantal bewaarde regels in het wijzigingslog
var MAX_ALLOWED = 50;

var FIELDS = {
  kategori: ["kategori", "kategoriler"],
  urun: ["urun", "urunadi", "yemek", "isim", "ad"],
  aciklama: ["aciklama", "icerik"],
  fiyat: ["fiyat", "ucret"],
  kucuk: ["kucuk", "kucukboy", "fiyatkucuk"],
  buyuk: ["buyuk", "buyukboy", "fiyatbuyuk"],
  etiket: ["etiket", "etiketler"],
  alerjen: ["alerjen", "alerjenler"],
  goster: ["goster", "aktif", "gorunur"]
};
var PRICE_FIELDS = { fiyat: true, kucuk: true, buyuk: true };

function doGet() {
  return json_({ ok: true, service: "bimola-yonetim" });
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: "Geçersiz istek." });
  }

  var email;
  try {
    email = verifyGoogleToken_(req.idToken);
  } catch (err) {
    return json_({ ok: false, auth: true, error: err.message });
  }
  if (!isAllowed_(email)) {
    return json_({ ok: false, denied: true, email: email,
      error: "Bu Google hesabının erişim izni yok: " + email });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return json_(handle_(req, email));
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    lock.releaseLock();
  }
}

function book_() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  return active || SpreadsheetApp.openById(SHEET_ID);
}

function handle_(req, email) {
  var ss = book_();
  var sheet = ss.getSheetByName(MENU_SHEET);
  if (!sheet) throw new Error('"' + MENU_SHEET + '" sekmesi bulunamadı.');

  var what = "";
  switch (req.action) {
    case "list": break;
    case "update": what = updateItem_(sheet, req); break;
    case "add": what = addItem_(sheet, req); break;
    case "delete": what = deleteItem_(sheet, req); break;
    case "move": what = moveItem_(sheet, req); break;
    case "setting": what = updateSetting_(ss, req); break;
    case "accessAdd": what = accessAdd_(req.email); break;
    case "accessRemove": what = accessRemove_(req.email); break;
    default: return { ok: false, error: "Bilinmeyen işlem." };
  }
  if (what) log_(ss, email, what);

  var data = snapshot_(ss, sheet);
  data.access = { me: email, owner: ownerEmail_(), emails: allowedList_() };
  data.log = readLog_().slice(0, 30);
  return { ok: true, data: data };
}

/* ---------- Google-login en witte lijst ---------- */

function authError_(msg) {
  return new Error(msg || "Google ile tekrar giriş yapın.");
}

// Laat Google het ID-token controleren; geeft het (kleine letters) e-mailadres terug.
function verifyGoogleToken_(token) {
  if (!OAUTH_CLIENT_ID) throw authError_("Kurulum eksik: OAUTH_CLIENT_ID boş.");
  if (!token || typeof token !== "string" || token.length > 4096) throw authError_("Google ile giriş yapın.");

  var cache = CacheService.getScriptCache();
  var key = "tok_" + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var cached = cache.get(key);
  if (cached) return cached;

  var res = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token),
    { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw authError_("Oturumun süresi doldu. Tekrar giriş yapın.");

  var info = JSON.parse(res.getContentText());
  var now = Math.floor(Date.now() / 1000);
  var exp = Number(info.exp);
  if (info.aud !== OAUTH_CLIENT_ID) throw authError_("Geçersiz giriş (yanlış uygulama).");
  if (info.iss !== "accounts.google.com" && info.iss !== "https://accounts.google.com") throw authError_("Geçersiz giriş.");
  if (String(info.email_verified) !== "true") throw authError_("Google e-posta adresi doğrulanmamış.");
  if (!(exp > now)) throw authError_("Oturumun süresi doldu. Tekrar giriş yapın.");

  var email = String(info.email || "").trim().toLowerCase();
  if (!email) throw authError_("E-posta adresi alınamadı.");
  cache.put(key, email, Math.max(1, Math.min(exp - now, 3600)));
  return email;
}

function ownerEmail_() {
  return String(Session.getEffectiveUser().getEmail() || "").trim().toLowerCase();
}

function allowedList_() {
  var raw = PropertiesService.getScriptProperties().getProperty("ALLOWED_EMAILS");
  var list;
  try { list = JSON.parse(raw || "[]"); } catch (e) { list = []; }
  if (!Array.isArray(list)) list = [];
  var seen = {};
  return list.map(function (x) { return String(x).trim().toLowerCase(); })
    .filter(function (x) { if (!x || seen[x]) return false; seen[x] = true; return true; });
}

function saveAllowed_(list) {
  PropertiesService.getScriptProperties().setProperty("ALLOWED_EMAILS", JSON.stringify(list));
}

function isAllowed_(email) {
  if (!email) return false;
  return email === ownerEmail_() || allowedList_().indexOf(email) !== -1;
}

var EMAIL_RE = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[a-z]{2,}$/;

function accessAdd_(raw) {
  var email = String(raw || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("Geçerli bir e-posta adresi yazın.");
  if (email === ownerEmail_()) throw new Error("Bu hesap zaten sahibi ve her zaman erişebilir.");
  var list = allowedList_();
  if (list.indexOf(email) !== -1) throw new Error("Bu adres zaten listede.");
  if (list.length >= MAX_ALLOWED) throw new Error("Liste dolu (en fazla " + MAX_ALLOWED + ").");
  list.push(email);
  saveAllowed_(list);
  return "Erişim eklendi: " + email;
}

function accessRemove_(raw) {
  var email = String(raw || "").trim().toLowerCase();
  if (email === ownerEmail_()) throw new Error("Sahibin erişimi kaldırılamaz.");
  var list = allowedList_();
  var i = list.indexOf(email);
  if (i === -1) throw new Error("Bu adres listede yok.");
  list.splice(i, 1);
  saveAllowed_(list);
  return "Erişim kaldırıldı: " + email;
}

// Wijzigingslog (laatste LOG_MAX regels) in de scripteigenschappen, niet in de
// Sheet: die is voor iedereen leesbaar en dan zouden e-mailadressen uitlekken.
function readLog_() {
  try {
    var list = JSON.parse(PropertiesService.getScriptProperties().getProperty("CHANGE_LOG") || "[]");
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function log_(ss, email, what) {
  try {
    var list = readLog_();
    list.unshift({ t: new Date().toISOString(), who: email, what: String(what).slice(0, 120) });
    list = list.slice(0, LOG_MAX);
    var json = JSON.stringify(list);
    // Scripteigenschappen mogen per waarde maximaal ~9 kB zijn.
    while (json.length > 8500 && list.length > 1) {
      list = list.slice(0, Math.max(1, list.length - 10));
      json = JSON.stringify(list);
    }
    PropertiesService.getScriptProperties().setProperty("CHANGE_LOG", json);
  } catch (e) {
    // Een mislukte logregel mag de wijziging zelf niet tegenhouden.
  }
}

/* ---------- lezen ---------- */

function normalizeKey_(s) {
  return String(s == null ? "" : s)
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/i̇/g, "i")
    .replace(/[^a-z0-9]/g, "");
}

// Kolomnummer (0-based) per veld, op basis van rij 1.
function columnMap_(sheet) {
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(normalizeKey_);
  var map = {};
  Object.keys(FIELDS).forEach(function (field) {
    for (var i = 0; i < header.length; i++) {
      if (FIELDS[field].indexOf(header[i]) !== -1) { map[field] = i; break; }
    }
  });
  if (map.kategori == null || map.urun == null) throw new Error("Kategori / Ürün sütunu bulunamadı.");
  return map;
}

function snapshot_(ss, sheet) {
  var map = columnMap_(sheet);
  var last = sheet.getLastRow();
  var items = [];
  if (last > 1) {
    var values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getDisplayValues();
    values.forEach(function (r, i) {
      var item = { row: i + 2 };
      Object.keys(FIELDS).forEach(function (f) {
        item[f] = map[f] == null ? "" : String(r[map[f]] || "").trim();
      });
      if (!item.kategori && !item.urun) return;
      item.note = !item.urun;
      items.push(item);
    });
  }

  var settings = [];
  var st = ss.getSheetByName(SETTINGS_SHEET);
  if (st && st.getLastRow() > 1) {
    st.getRange(2, 1, st.getLastRow() - 1, 2).getDisplayValues().forEach(function (r) {
      if (String(r[0]).trim()) settings.push({ key: String(r[0]).trim(), value: String(r[1]) });
    });
  }

  return {
    columns: Object.keys(map),
    items: items,
    settings: settings
  };
}

/* ---------- schrijven ---------- */

// Tekst die met = + - @ begint niet als formule laten uitvoeren.
function safeText_(v) {
  var s = String(v == null ? "" : v).trim().slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function cellValue_(field, v) {
  var s = String(v == null ? "" : v).trim();
  if (PRICE_FIELDS[field]) {
    if (s === "") return "";
    if (/^\d+$/.test(s)) return Number(s);
    if (!/^[\d.,\s]+$/.test(s)) throw new Error("Fiyat sadece rakam olmalı: " + s);
    return s;
  }
  if (field === "goster") {
    var k = normalizeKey_(s);
    return (k === "hayir" || k === "h" || k === "0" || k === "false") ? "hayır" : "evet";
  }
  return safeText_(s);
}

function checkRow_(sheet, map, row, expectedName) {
  row = Number(row);
  if (!(row >= 2 && row <= sheet.getLastRow())) throw new Error("Satır bulunamadı. Listeyi yenileyin.");
  var name = String(sheet.getRange(row, map.urun + 1).getDisplayValue()).trim();
  if (expectedName != null && name !== String(expectedName).trim()) {
    throw new Error("Bu satır bu arada değişti. Listeyi yenileyin.");
  }
  return row;
}

function validate_(fields) {
  if (!String(fields.urun || "").trim()) throw new Error("Ürün adı boş olamaz.");
  if (!String(fields.kategori || "").trim()) throw new Error("Kategori boş olamaz.");
}

function writeRow_(sheet, map, row, fields) {
  var width = sheet.getLastColumn();
  var range = sheet.getRange(row, 1, 1, width);
  var values = range.getValues()[0];
  Object.keys(fields).forEach(function (f) {
    if (map[f] == null) return;
    values[map[f]] = cellValue_(f, fields[f]);
  });
  range.setValues([values]);
}

function updateItem_(sheet, req) {
  var map = columnMap_(sheet);
  var row = checkRow_(sheet, map, req.row, req.check);
  var f = req.fields || {};
  validate_(f);
  writeRow_(sheet, map, row, f);
  return "Güncellendi: " + f.urun + priceNote_(f);
}

function priceNote_(f) {
  if (f.kucuk || f.buyuk) return " (" + (f.kucuk || "-") + " / " + (f.buyuk || "-") + ")";
  if (f.fiyat) return " (" + f.fiyat + ")";
  return "";
}

function addItem_(sheet, req) {
  var map = columnMap_(sheet);
  var fields = req.fields || {};
  validate_(fields);
  if (fields.goster == null) fields.goster = "evet";

  // Na de laatste rij van dezelfde categorie, anders onderaan.
  var last = sheet.getLastRow();
  var target = last + 1;
  if (last > 1) {
    var cats = sheet.getRange(2, map.kategori + 1, last - 1, 1).getDisplayValues();
    var want = normalizeKey_(fields.kategori);
    for (var i = cats.length - 1; i >= 0; i--) {
      if (normalizeKey_(cats[i][0]) === want) {
        if (i + 2 < last) {
          sheet.insertRowAfter(i + 2);
          target = i + 3;
        }
        break;
      }
    }
  }
  writeRow_(sheet, map, target, fields);
  return "Eklendi: " + fields.urun + priceNote_(fields);
}

function deleteItem_(sheet, req) {
  var map = columnMap_(sheet);
  var row = checkRow_(sheet, map, req.row, req.check);
  var name = String(sheet.getRange(row, map.urun + 1).getDisplayValue());
  sheet.deleteRow(row);
  return "Silindi: " + name;
}

// Eén plek omhoog (-1) of omlaag (+1), alleen binnen dezelfde categorie.
function moveItem_(sheet, req) {
  var map = columnMap_(sheet);
  var row = checkRow_(sheet, map, req.row, req.check);
  var other = row + (Number(req.direction) < 0 ? -1 : 1);
  if (other < 2 || other > sheet.getLastRow()) return "";
  var width = sheet.getLastColumn();
  var a = sheet.getRange(row, 1, 1, width);
  var b = sheet.getRange(other, 1, 1, width);
  var av = a.getValues(), bv = b.getValues();
  if (normalizeKey_(av[0][map.kategori]) !== normalizeKey_(bv[0][map.kategori])) return "";
  if (!String(bv[0][map.urun]).trim()) return ""; // notitierij blijft staan
  a.setValues(bv);
  b.setValues(av);
  return "Taşındı: " + av[0][map.urun];
}

function updateSetting_(ss, req) {
  var key = String(req.key || "").trim();
  if (!key) throw new Error("Ayar adı boş.");
  var st = ss.getSheetByName(SETTINGS_SHEET);
  if (!st) throw new Error('"' + SETTINGS_SHEET + '" sekmesi bulunamadı.');
  var value = safeText_(req.value);
  var last = st.getLastRow();
  if (last > 1) {
    var keys = st.getRange(2, 1, last - 1, 1).getDisplayValues();
    for (var i = 0; i < keys.length; i++) {
      if (normalizeKey_(keys[i][0]) === normalizeKey_(key)) {
        st.getRange(i + 2, 2).setValue(value);
        return "Ayar: " + key + " = " + value;
      }
    }
  }
  st.appendRow([safeText_(key), value]);
  return "Ayar: " + key + " = " + value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
