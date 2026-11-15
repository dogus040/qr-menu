# QR-menukaart

Een Turkse digitale menukaart in klassieke stijl voor Bi Mola, een kafe (kahve, tatlı, atıştırmalıklar, içecekler), voor achter een QR-code op tafel. Gratis online via GitHub Pages, aan te passen via Google Sheets.

- Menukaart: `https://dogus040.github.io/qr-menu/`
- QR-kaartjes printen: `https://dogus040.github.io/qr-menu/qr.html`

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
| Etiket | Labels, met komma's: `Vejetaryen`, `Vegan`, `Acılı`, `Şefin Önerisi`, `Yeni`. |
| Alerjen | Allergenen, met komma's (optioneel). |
| Göster | `hayır` = tijdelijk verbergen (bijv. op). Leeg of `evet` = tonen. |

### Google Sheet

De kaart leest het menu uit de Google Sheet **QR Menü – Bi Mola** (tabbladen `menu` en `ayarlar`). Pas de sheet aan, op de computer of in de Google Sheets-app op uw telefoon; gasten zien de wijziging zodra ze de kaart (opnieuw) openen.

Voorwaarden, anders valt de kaart terug op de bestanden in `data/`:

- De sheet blijft gedeeld als **Iedereen met de link: Lezer**. Geef bewerkrechten alleen aan personen, nooit aan "iedereen met de link".
- Hernoem of verwijder de tabbladen niet en laat de kolomkoppen in rij 1 staan. Kolommen verplaatsen mag.
- De links staan in `js/config.js`. Een andere sheet koppelen: vervang daar de ID en de `gid`-nummers.

Tip: zet af en toe een kopie van de sheet in `data/menu.csv` en `data/ayarlar.csv` (Bestand → Downloaden → CSV), zodat de reserve actueel blijft.

### Zonder Google Sheet

Maak de links in `js/config.js` leeg (`""`) en pas `data/menu.csv` direct aan op github.com. Na opslaan staat de wijziging binnen ongeveer een minuut online.

## Lokaal bekijken

```bash
python -m http.server 8765
```

Open daarna `http://localhost:8765`.
