// Test van apps-script/Code.gs met een nep-Spreadsheet in het geheugen.
// Draaien: node tests/code_gs.test.js
const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const project = require("path").join(__dirname, "..");

// CSV-parser uit js/data.js hergebruiken.
const win = {};
vm.runInNewContext(fs.readFileSync(project + "/js/data.js", "utf8"), { window: win, fetch: () => {} });
const parse = win.MenuData.parseCsv;

function makeSheet(name, rows) {
  const data = rows.map(r => r.slice());
  const width = () => Math.max(...data.map(r => r.length));
  const sheet = {
    name, data,
    getLastRow: () => data.length,
    getLastColumn: () => width(),
    getRange(r, c, nr = 1, nc = 1) {
      const get = () => {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = [];
          for (let j = 0; j < nc; j++) row.push((data[r - 1 + i] || [])[c - 1 + j] ?? "");
          out.push(row);
        }
        return out;
      };
      return {
        getValues: get,
        getDisplayValues: () => get().map(row => row.map(v => String(v))),
        getDisplayValue: () => String(get()[0][0]),
        setValues(vals) {
          vals.forEach((row, i) => row.forEach((v, j) => {
            while (data.length < r + i) data.push([]);
            data[r - 1 + i][c - 1 + j] = v;
          }));
        },
        setValue(v) { this.setValues([[v]]); }
      };
    },
    insertRowAfter(r) { data.splice(r, 0, new Array(width()).fill("")); },
    deleteRow(r) { data.splice(r - 1, 1); },
    appendRow(row) { data.push(row.slice()); }
  };
  return sheet;
}

const menuRows = parse(fs.readFileSync(__dirname + "/fixtures/menu.csv", "utf8"));
const setRows = parse(fs.readFileSync(__dirname + "/fixtures/ayarlar.csv", "utf8"));
const sheets = { menu: makeSheet("menu", menuRows), ayarlar: makeSheet("ayarlar", setRows) };
const cacheStore = {};
let pin = "482913";

const ctx = {
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: n => sheets[n] || null }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k === "ADMIN_PIN" ? pin : null) }) },
  CacheService: { getScriptCache: () => ({ get: k => cacheStore[k] ?? null, put: (k, v) => { cacheStore[k] = v; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { JSON: "json" },
    createTextOutput: s => ({ s, setMimeType() { return this; } })
  }
};
vm.runInNewContext(fs.readFileSync(project + "/apps-script/Code.gs", "utf8"), ctx);

function call(body) {
  const out = ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  return JSON.parse(out.s);
}
const names = () => sheets.menu.data.slice(1).map(r => r[1]);

// 1. Foute PIN
let r = call({ pin: "000000", action: "list" });
assert.strictEqual(r.ok, false); assert.strictEqual(r.auth, true);
delete cacheStore.fails;

// 2. Lijst
r = call({ pin, action: "list" });
assert.ok(r.ok, r.error);
assert.strictEqual(r.data.items.length, 19);
const psl = r.data.items[0];
assert.strictEqual(psl.urun, "Pumpkin Spice Latte");
assert.strictEqual(psl.kucuk, "180"); assert.strictEqual(psl.buyuk, "210");
assert.strictEqual(psl.row, 2);
console.log("list ok:", r.data.items.length, "items,", r.data.settings.length, "settings");

// 3. Prijs wijzigen + uitverkocht
r = call({ pin, action: "update", row: 2, check: "Pumpkin Spice Latte",
  fields: { urun: "Pumpkin Spice Latte", kategori: "Sıcak Kahveler", kucuk: "185", buyuk: "215", goster: "hayır" } });
assert.ok(r.ok, r.error);
assert.strictEqual(sheets.menu.data[1][4], 185);
assert.strictEqual(sheets.menu.data[1][8], "hayır");
console.log("update ok");

// 4. Verouderde check wordt geweigerd
r = call({ pin, action: "update", row: 2, check: "Iets anders", fields: { urun: "X", kategori: "Y" } });
assert.strictEqual(r.ok, false);

// 5. Formule-injectie wordt tekst
r = call({ pin, action: "update", row: 3, check: "Vanilya Latte",
  fields: { urun: "=IMPORTXML(1)", kategori: "Sıcak Kahveler" } });
assert.ok(r.ok, r.error);
assert.strictEqual(sheets.menu.data[2][1], "'=IMPORTXML(1)");
r = call({ pin, action: "update", row: 3, check: "'=IMPORTXML(1)", fields: { urun: "Vanilya Latte", kategori: "Sıcak Kahveler" } });
assert.ok(r.ok, r.error);

// 6. Prijs met letters wordt geweigerd
r = call({ pin, action: "update", row: 3, check: "Vanilya Latte",
  fields: { urun: "Vanilya Latte", kategori: "Sıcak Kahveler", kucuk: "abc" } });
assert.strictEqual(r.ok, false);

// 7. Toevoegen in bestaande categorie: komt na de laatste Sıcak Kahveler-rij
r = call({ pin, action: "add", fields: { urun: "Flat White", kategori: "Sıcak Kahveler", kucuk: "170", buyuk: "200" } });
assert.ok(r.ok, r.error);
assert.strictEqual(names()[8], "Flat White");
assert.strictEqual(names()[9], "Iced Pumpkin Latte");
console.log("add in category ok");

// 8. Toevoegen nieuwe categorie: onderaan
r = call({ pin, action: "add", fields: { urun: "Su", kategori: "Diğer", fiyat: "25" } });
assert.ok(r.ok, r.error);
assert.strictEqual(names()[names().length - 1], "Su");
assert.strictEqual(sheets.menu.data[sheets.menu.data.length - 1][8], "evet");

// 9. Toevoegen aan laatste categorie (geen insert nodig)
r = call({ pin, action: "add", fields: { urun: "Maden Suyu", kategori: "Diğer", fiyat: "30" } });
assert.ok(r.ok, r.error);
assert.strictEqual(names()[names().length - 1], "Maden Suyu");

// 10. Verplaatsen binnen categorie, niet over de grens
r = call({ pin, action: "move", row: 3, check: "Vanilya Latte", direction: -1 });
assert.ok(r.ok, r.error);
assert.strictEqual(names()[0], "Vanilya Latte");
const firstIced = names().indexOf("Iced Pumpkin Latte") + 2;
r = call({ pin, action: "move", row: firstIced, check: "Iced Pumpkin Latte", direction: -1 });
assert.ok(r.ok, r.error);
assert.strictEqual(names()[firstIced - 2], "Iced Pumpkin Latte"); // niet verplaatst
console.log("move ok");

// 11. Verwijderen
const fw = names().indexOf("Flat White") + 2;
r = call({ pin, action: "delete", row: fw, check: "Flat White" });
assert.ok(r.ok, r.error);
assert.ok(!names().includes("Flat White"));
console.log("delete ok");

// 12. Instelling wijzigen en nieuwe toevoegen
r = call({ pin, action: "setting", key: "Telefon", value: "0216 000 00 00" });
assert.ok(r.ok, r.error);
assert.strictEqual(sheets.ayarlar.data.find(x => x[0] === "Telefon")[1], "0216 000 00 00");
r = call({ pin, action: "setting", key: "Arka Plan", value: "kraft" });
assert.ok(r.ok, r.error);
assert.strictEqual(sheets.ayarlar.data[sheets.ayarlar.data.length - 1][0], "Arka Plan");
console.log("settings ok");

// 13. Lege naam geweigerd
r = call({ pin, action: "add", fields: { urun: " ", kategori: "Çay" } });
assert.strictEqual(r.ok, false);

// 14. Lockout na te veel foute pogingen
for (let i = 0; i < 8; i++) call({ pin: "1", action: "list" });
r = call({ pin, action: "list" });
assert.strictEqual(r.ok, false);
assert.ok(/Çok fazla/.test(r.error));
console.log("lockout ok");

console.log("ALLE TESTS GESLAAGD");
