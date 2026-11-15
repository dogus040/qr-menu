// Leest het menu en de instellingen uit een Google Sheet (CSV) of uit data/*.csv.
(function () {
  "use strict";

  // CSV-parser die aanhalingstekens, komma's en regeleinden binnen cellen aankan.
  function parseCsv(text) {
    var rows = [];
    var row = [];
    var cell = "";
    var inQuotes = false;
    text = text.replace(/^﻿/, "");

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else { inQuotes = false; }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell); cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); rows.push(row);
        row = []; cell = "";
      } else {
        cell += ch;
      }
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }

    return rows.filter(function (r) {
      return r.some(function (c) { return c.trim() !== ""; });
    });
  }

  // Kolomnamen vergelijken zonder hoofdletters en Turkse tekens (Ürün = urun).
  function normalizeKey(s) {
    return String(s || "")
      .trim()
      .toLocaleLowerCase("tr")
      .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
      .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]/g, "");
  }

  var COLUMN_ALIASES = {
    kategori: ["kategori", "kategoriler"],
    urun: ["urun", "urunadi", "yemek", "isim", "ad"],
    aciklama: ["aciklama", "icerik"],
    fiyat: ["fiyat", "ucret"],
    etiket: ["etiket", "etiketler"],
    alerjen: ["alerjen", "alerjenler"],
    goster: ["goster", "aktif", "gorunur"]
  };

  function toObjects(rows) {
    if (!rows.length) return [];
    var header = rows[0].map(normalizeKey);
    var index = {};
    Object.keys(COLUMN_ALIASES).forEach(function (field) {
      index[field] = header.findIndex(function (h) {
        return COLUMN_ALIASES[field].indexOf(h) !== -1;
      });
    });
    return rows.slice(1).map(function (r) {
      var o = {};
      Object.keys(index).forEach(function (field) {
        o[field] = index[field] >= 0 ? String(r[index[field]] || "").trim() : "";
      });
      return o;
    });
  }

  function isHidden(value) {
    var v = normalizeKey(value);
    return v === "hayir" || v === "h" || v === "yok" || v === "0" || v === "false" || v === "nee";
  }

  function splitList(value) {
    return String(value || "")
      .split(/[,;]/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  // Zet de rijen om in categorieën (volgorde zoals in de sheet).
  function buildMenu(rows) {
    var items = toObjects(rows);
    var categories = [];
    var byName = {};

    items.forEach(function (it) {
      if (!it.kategori) return;
      var cat = byName[it.kategori];
      if (!cat) {
        cat = { name: it.kategori, note: "", items: [] };
        byName[it.kategori] = cat;
        categories.push(cat);
      }
      // Rij zonder product = notitie bij de categorie.
      if (!it.urun) {
        if (it.aciklama) cat.note = it.aciklama;
        return;
      }
      if (isHidden(it.goster)) return;
      cat.items.push({
        name: it.urun,
        description: it.aciklama,
        price: it.fiyat,
        tags: splitList(it.etiket),
        allergens: splitList(it.alerjen)
      });
    });

    return categories.filter(function (c) { return c.items.length; });
  }

  function buildSettings(rows) {
    var settings = {};
    rows.slice(1).forEach(function (r) {
      var key = normalizeKey(r[0]);
      if (key) settings[key] = String(r[1] || "").trim();
    });
    return settings;
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " voor " + url);
      return res.text();
    });
  }

  // Probeert eerst de Google Sheet, valt terug op het lokale bestand.
  function loadCsv(remoteUrl, localUrl) {
    if (!remoteUrl) return fetchText(localUrl).then(parseCsv);
    return fetchText(remoteUrl)
      .then(function (text) {
        // Google geeft een HTML-pagina terug als de sheet niet (meer) gepubliceerd is.
        if (/^\s*<!doctype html|^\s*<html/i.test(text)) throw new Error("Geen CSV");
        return parseCsv(text);
      })
      .catch(function (err) {
        console.warn("Google Sheet niet bereikbaar, lokale data gebruikt:", err);
        return fetchText(localUrl).then(parseCsv);
      });
  }

  window.MenuData = {
    parseCsv: parseCsv,
    normalizeKey: normalizeKey,
    loadMenu: function () {
      var cfg = window.MENU_CONFIG || {};
      return loadCsv(cfg.menuCsvUrl, "data/menu.csv").then(buildMenu);
    },
    loadSettings: function () {
      var cfg = window.MENU_CONFIG || {};
      return loadCsv(cfg.ayarlarCsvUrl, "data/ayarlar.csv").then(buildSettings);
    }
  };
})();
