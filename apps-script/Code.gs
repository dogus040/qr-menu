/**
 * Bi Mola – menü yönetimi (beheerpagina-API)
 * ---------------------------------------------------------------------------
 * Google Apps Script voor de Google Sheet "Bi Mola – Menü" (SHEET_ID hieronder).
 * De pagina bimola.pages.dev/yonetim praat hiermee.
 *
 * Installatie (eenmalig, door de eigenaar van de Sheet):
 *   1. script.google.com → Nieuw project (of Extensies → Apps Script in de Sheet),
 *      plak dit bestand in Code.gs.
 *   2. Projectinstellingen → Scripteigenschappen → eigenschap ADMIN_PIN met de PIN.
 *   3. Implementeren → Nieuwe implementatie → Web-app,
 *      Uitvoeren als: Ik, Toegang: Iedereen. Kopieer de web-app-URL.
 *   4. Zet die URL in js/config.js bij adminApiUrl.
 *
 * Geen geheimen in dit bestand: de PIN staat alleen in de scripteigenschappen.
 */

// ID van de Google Sheet "Bi Mola – Menü" (uit de link: /spreadsheets/d/<ID>/edit).
// Wordt gebruikt als het script los staat; een script via Extensies → Apps Script
// gebruikt automatisch zijn eigen Sheet.
var SHEET_ID = "1WMBCNGtdqOYoTtWO3RERnBfEVjyKoajX4JKQ2dgdHfU";
var MENU_SHEET = "menu";
var SETTINGS_SHEET = "ayarlar";
var MAX_FAILS = 8;          // foute PIN-pogingen voordat alles even op slot gaat
var LOCK_SECONDS = 900;     // 15 minuten

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

  var authError = checkPin_(req.pin);
  if (authError) return json_({ ok: false, auth: true, error: authError });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return json_(handle_(req));
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

function handle_(req) {
  var ss = book_();
  var sheet = ss.getSheetByName(MENU_SHEET);
  if (!sheet) throw new Error('"' + MENU_SHEET + '" sekmesi bulunamadı.');

  switch (req.action) {
    case "list": break;
    case "update": updateItem_(sheet, req); break;
    case "add": addItem_(sheet, req); break;
    case "delete": deleteItem_(sheet, req); break;
    case "move": moveItem_(sheet, req); break;
    case "setting": updateSetting_(ss, req); break;
    default: return { ok: false, error: "Bilinmeyen işlem." };
  }
  return { ok: true, data: snapshot_(ss, sheet) };
}

/* ---------- PIN ---------- */

function checkPin_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");
  if (!real || String(real).length < 4) {
    return "PIN ayarlanmamış. Sahibi: Apps Script → Proje ayarları → ADMIN_PIN.";
  }
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get("fails") || 0);
  if (fails >= MAX_FAILS) return "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.";
  if (String(pin || "") !== String(real)) {
    cache.put("fails", String(fails + 1), LOCK_SECONDS);
    return "PIN yanlış.";
  }
  return "";
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
  validate_(req.fields || {});
  writeRow_(sheet, map, row, req.fields || {});
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
}

function deleteItem_(sheet, req) {
  var map = columnMap_(sheet);
  var row = checkRow_(sheet, map, req.row, req.check);
  sheet.deleteRow(row);
}

// Eén plek omhoog (-1) of omlaag (+1), alleen binnen dezelfde categorie.
function moveItem_(sheet, req) {
  var map = columnMap_(sheet);
  var row = checkRow_(sheet, map, req.row, req.check);
  var other = row + (Number(req.direction) < 0 ? -1 : 1);
  if (other < 2 || other > sheet.getLastRow()) return;
  var width = sheet.getLastColumn();
  var a = sheet.getRange(row, 1, 1, width);
  var b = sheet.getRange(other, 1, 1, width);
  var av = a.getValues(), bv = b.getValues();
  if (normalizeKey_(av[0][map.kategori]) !== normalizeKey_(bv[0][map.kategori])) return;
  if (!String(bv[0][map.urun]).trim()) return; // notitierij blijft staan
  a.setValues(bv);
  b.setValues(av);
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
        return;
      }
    }
  }
  st.appendRow([safeText_(key), value]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
