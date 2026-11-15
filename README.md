# QR-menukaart

Een Turkse digitale menukaart in klassieke stijl, voor achter een QR-code op tafel. Gratis online via GitHub Pages, aan te passen via Google Sheets.

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

### Google Sheet koppelen (eenmalig)

1. Maak een nieuwe Google Sheet met twee tabbladen: `menu` en `ayarlar`.
2. Importeer `data/menu.csv` in tabblad `menu` en `data/ayarlar.csv` in `ayarlar` (Bestand → Importeren → Uploaden → *Huidig blad vervangen*).
3. Bestand → Delen → **Publiceren op internet**. Kies tabblad `menu`, formaat **CSV**, klik Publiceren en kopieer de link. Herhaal voor `ayarlar`.
4. Plak beide links in `js/config.js` (op github.com: open het bestand, potloodje, *Commit changes*).

Daarna past u alleen nog de sheet aan; de kaart toont wijzigingen binnen ongeveer 5 minuten (Google ververst gepubliceerde sheets niet sneller). Is de sheet onbereikbaar, dan toont de kaart automatisch de bestanden in `data/`.

### Zonder Google Sheet

Pas `data/menu.csv` direct aan op github.com. Na opslaan staat de wijziging binnen ongeveer een minuut online.

## Lokaal bekijken

```bash
python -m http.server 8765
```

Open daarna `http://localhost:8765`.
