# QR-menukaart

Een Turkse digitale menukaart in klassieke stijl voor Bi Mola, een kafe (kahve, tatlı, atıştırmalıklar, içecekler), voor achter een QR-code op tafel. Gratis online via GitHub Pages, aan te passen via Google Sheets.

- Menukaart (QR-adres): `https://bimola.pages.dev/` (Cloudflare Pages, bijgewerkt bij elke push naar main)
- Reserve-adres: `https://dogus040.github.io/qr-menu/`
- QR-kaartjes printen: `https://bimola.pages.dev/qr`

## Menu aanpassen

Het menu staat in twee tabellen:

| Bestand / tabblad | Wat erin staat |
|---|---|
| `menu` (`data/menu.csv`) | Alle gerechten, categorieën en prijzen |
| `ayarlar` (`data/ayarlar.csv`) | Naam, ondertitel, valuta, adres, telefoon, Instagram, openingstijden, voettekst |

### Kolommen van `menu`

| Kolom | Uitleg |
|---|---|
| Kategori | Categorie. De volgorde in de sheet is de volgorde op de kaart. |
| Ürün | Naam van het gerecht. Laat leeg om een notitie bij de categorie te zetten (tekst in Açıklama). |
| Açıklama | Korte omschrijving (optioneel). |
| Fiyat | Alleen het getal, bijv. `250` of `12,50`. Het valutateken komt er vanzelf achter. |
| Küçük / Büyük | Voor drankjes met twee maten: vul deze twee in en laat Fiyat leeg. De kaart toont dan twee prijskolommen. |
| Etiket | Labels, met komma's: `Vejetaryen`, `Vegan`, `Acılı`, `Şefin Önerisi`, `Yeni`. |
| Alerjen | Allergenen, met komma's (optioneel). |
| Göster | `hayır` = tijdelijk verbergen (bijv. op). Leeg of `evet` = tonen. |

### Achtergrond

Vijf achtergronden: `kagit`, `kahve`, `cini`, `kraft`, `espresso`. Bekijken zonder iets te veranderen: zet `?bg=naam` achter de link, bijv. `https://dogus040.github.io/qr-menu/?bg=kahve`. Vast instellen: `arkaPlan` in `js/config.js`, of een regel `Arka Plan` met de naam in het tabblad `ayarlar` (die gaat voor).

### Google Sheet

De kaart leest het menu uit de Google Sheet **Bi Mola – Menü** (tabbladen `menu` en `ayarlar`). Pas de sheet aan, op de computer of in de Google Sheets-app op uw telefoon; gasten zien de wijziging zodra ze de kaart (opnieuw) openen.

Voorwaarden, anders valt de kaart terug op de bestanden in `data/`:

- De sheet blijft gedeeld als **Iedereen met de link: Lezer**. Geef bewerkrechten alleen aan personen, nooit aan "iedereen met de link".
- Hernoem of verwijder de tabbladen niet en laat de kolomkoppen in rij 1 staan. Kolommen verplaatsen mag.
- De links staan in `js/config.js`. Een andere sheet koppelen: vervang daar de ID en de `gid`-nummers.

Tip: zet af en toe een kopie van de sheet in `data/menu.csv` en `data/ayarlar.csv` (Bestand → Downloaden → CSV), zodat de reserve actueel blijft.

### Zonder Google Sheet

Maak de links in `js/config.js` leeg (`""`) en pas `data/menu.csv` direct aan op github.com. Na opslaan staat de wijziging binnen ongeveer een minuut online.

## Beheerpagina (`/yonetim`)

`https://bimola.pages.dev/yonetim` is een Turkse beheerpagina voor de telefoon: prijzen wijzigen, producten toevoegen, verwijderen, verplaatsen, op "tükendi" zetten en de instellingen (`ayarlar`) aanpassen. Inloggen met een PIN. De pagina schrijft via een Google Apps Script-web-app (`apps-script/Code.gs`) rechtstreeks in de Google Sheet.

Eenmalige installatie door de eigenaar van de Sheet:

1. Open de Sheet → **Extensies → Apps Script**. Vervang de inhoud van `Code.gs` door `apps-script/Code.gs` en sla op.
2. **Projectinstellingen** (tandwiel) → **Scripteigenschappen** → eigenschap `ADMIN_PIN` met een PIN van minstens 6 cijfers.
3. **Implementeren → Nieuwe implementatie** → type **Web-app**. Uitvoeren als: **Ik**. Toegang: **Iedereen**. Toestemming geven (bij "Google heeft deze app niet geverifieerd": Geavanceerd → doorgaan; het is je eigen script).
4. Kopieer de web-app-URL (eindigt op `/exec`) en zet die in `js/config.js` bij `adminApiUrl`.

Na een wijziging in `Code.gs`: **Implementeren → Implementaties beheren → bewerken → Nieuwe versie**, dan blijft de URL gelijk. PIN wijzigen kan altijd in de scripteigenschappen. Na 8 foute PIN-pogingen gaat de pagina 15 minuten op slot.

Test van de scriptlogica (zonder Google): `node tests/code_gs.test.js`.

## Lokaal bekijken

```bash
python -m http.server 8765
```

Open daarna `http://localhost:8765`.
