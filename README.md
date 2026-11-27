# Bi Mola – QR-menukaart

Turkse digitale menukaart (kraft-stijl) voor Bi Mola, met een beheerpagina voor de telefoon. Alles draait gratis op Cloudflare; alleen het eigen domein `bimolakafe.com` kost geld (± $11/jaar).

| Onderdeel | Adres | Waar |
|---|---|---|
| Menukaart (QR-code) | `https://menu.bimolakafe.com/` | Cloudflare Pages-project `bimola` (+ Pages Functions), custom domain |
| Beheerpagina | `https://admin.bimolakafe.com/` | Worker `admin` (custom domain), achter Cloudflare Access |
| QR-kaartjes printen | tabblad **QR** in de beheerpagina | idem, alleen na inloggen |
| Data | – | Cloudflare D1-database `bimola` |

**Waarom een eigen domein:** in Turkije zijn `*.pages.dev` en `*.workers.dev` als geheel geblokkeerd (sinds november 2025, opnieuw gemeld augustus 2026). `bimolakafe.com` en `www.bimolakafe.com` sturen door naar het menu.

**Oude adressen (opgeruimd 2026-11-25):** `admin.bimola.workers.dev` staat uit (`"workers_dev": false` in `wrangler.admin.jsonc`). `bimola.pages.dev` kan niet weg (het hoort vast bij het Pages-project), dus `functions/_middleware.ts` stuurt het, en de versie-adressen `<code>.bimola.pages.dev`, permanent (301) door naar `https://menu.bimolakafe.com` met pad en parameters (niet in de testomgeving, zie hieronder).

**Domein:** `bimolakafe.com`, gekocht via Cloudflare Registrar op 2026-11-19, verloopt 2027-11-19, automatisch verlengen aan. Laat het nooit verlopen: dan werken de QR-kaartjes niet meer.

Het Pages-project `bimola` **nooit verwijderen**: het eigen domein hangt eraan, en een vrijgekomen naam kan door iemand anders worden geclaimd.

## Hoe het werkt

```
Gast ──► menu.bimolakafe.com ──(alleen lezen)──► D1 ◄──(lezen + schrijven)── admin ◄── Cloudflare Access ◄── Dogus / Emre
```

- **`/qr` op de menukaart** bestaat niet meer: `functions/qr.ts` geeft 404 zonder caching, zodat een oude kopie uit de Cloudflare-cache niet terugkomt.
- **Menukaart**: `functions/index.ts` bouwt de pagina server-side uit D1 (`src/menu/render.ts`). Werkt zonder JavaScript. Is D1 onbereikbaar, dan toont hij `public/snapshot.json` (nachtelijke kopie).
- **Beheer**: `src/admin/` (Hono). Elke aanvraag moet een geldig Cloudflare Access-token hebben (handtekening, app, uitgever, geldigheid) én een e-mailadres op de witte lijst. Schrijfacties alleen als JSON vanaf de eigen pagina (CSRF-controle).
- **QR-kaartjes**: tabblad QR in de beheerpagina (`admin-public/app.js`, `admin-public/qr.css`). De link in de QR-code is `PUBLIC_MENU_URL`; alleen de eigenaar (`OWNER_EMAILS`) kan hem voor een afdruk wijzigen (niet opgeslagen). Afdrukken toont alleen de kaartjes. De themakleuren in `qr.css` zijn een kopie uit `public/css/style.css` (`tests/themes.test.ts` bewaakt dat ze gelijk blijven). Het QR-script komt van cdnjs, vastgepind met een SRI-hash; de CSP staat alleen dat ene bestand toe.
- **Witte lijst**: de Access-groep "Bi Mola beheerders" (`ACCESS_GROUP_ID`); beheerders passen die aan in het tabblad **Erişim**. De eigenaar (`OWNER_EMAILS`) mag er altijd in en kan niet worden verwijderd.
- **Wijzigingen**: elke wijziging is één D1-transactie met een logregel (wie, wanneer, voor/na). Tabblad **Geçmiş** toont de log met **Geri al** (terugdraaien) en de prullenbak. Twee mensen tegelijk: wie met een verouderde versie opslaat krijgt een melding in plaats van het werk van de ander te overschrijven.
- **Bedragen** staan als hele kuruş in de database (180 TL = 18000).
- **Snelheidslimieten** (2026-11-27):
  - Beheer (`ratelimits` in `wrangler.admin.jsonc`): per IP 300 verzoeken per minuut (vóór de login-controle), per account (Access-e-mail) 60 wijzigingen per minuut. Daarboven 429 met `Retry-After: 60`. De Cloudflare-limiter telt per locatie en ongeveer; valt hij uit, dan gaat het verzoek door. Test heeft eigen tellers (`namespace_id` 2001/2002).
  - Hele domein: Cloudflare-regel (Security → WAF → Rate limiting rules, gratis: 1 regel, alleen per IP): meer dan 100 verzoeken per 10 seconden vanaf één IP → 10 seconden geblokkeerd.
  - Geen "apparaat-ID" voor gasten: dat zou een cookie zijn die een aanvaller gewoon weglaat of vernieuwt. Het account (door Access gecontroleerd) is de ID in het beheer.
- **Daglimiet**: het gratis plan staat 100.000 verzoeken per dag toe voor alle code (menu + beheer), daarna foutpagina's tot 00:00 UTC (03:00 Istanbul), nooit een rekening. `public/_routes.json` houdt CSS, JavaScript en `snapshot.json` buiten de code (gratis en onbeperkt), zodat een menubezoek 1 verzoek kost in plaats van 3. Gevolg: `bimola.pages.dev/css/…` stuurt niet door (onschadelijk).

## Menu bewerken

Open de beheerpagina en log in met Google of een e-mailcode (alleen adressen op de witte lijst):

- **Menü**: schakelaar = satışta/tükendi; tik op een product om naam, prijs (één prijs of twee maten: Küçük/Orta), categorie, labels en de **allergeentekst** te wijzigen, te verplaatsen of te verwijderen. Categorieën via **Düzenle** / **+ Yeni kategori**.
- **Allergeentekst** (`Alerjen metni`): vrije tekst per product, op de kaart precies zo onder het product (bijv. "Alerjen: Süt"); leeg = niets. Knop **Temizle** wist hem. De oude allergenenlijst (kolom `allergens`) staat nog in de database maar wordt niet meer gebruikt.
- **Taal** (TR / EN, rechtsboven): Turks of Engels voor de beheerpagina (ook het QR-tabblad) en de foutmeldingen. Per apparaat onthouden (cookie `admin_lang`). Het menu voor gasten blijft Turks.
- **Ayarlar**: naam, slogan, adres, telefoon, Instagram, openingstijden, voettekst, achtergrond (thema), valuta, maat-labels (standaard Küçük en Orta; de beheerpagina gebruikt dezelfde namen).
- **Erişim**: e-mailadressen toevoegen/verwijderen.
- **Geçmiş**: laatste wijzigingen, terugdraaien, prullenbak.
- **QR**: tafelkaartjes printen (4 per A4) of de QR-code als PNG downloaden. De menulink kan alleen de eigenaar wijzigen.

Thema bekijken zonder op te slaan: `https://menu.bimolakafe.com/?bg=kahve` (kagit, kahve, cini, kraft, espresso).

## Ontwikkelen

```bash
npm ci
npm test                 # Vitest in de Workers-runtime, lokale D1
npm run typecheck
npm run db:migrate:local
npm run dev:menu         # http://localhost:8788
npm run dev:admin        # beheer lokaal; .dev.vars met test-instellingen (niet in git)
```
`.dev.vars` (alleen lokaal) bevat: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ACCESS_JWKS_JSON` (publieke testsleutel), `ACCESS_DIRECTORY=d1`, `OWNER_EMAILS`, `PUBLIC_MENU_URL`. Inloggen lokaal = een met de bijbehorende privésleutel getekend token als cookie `CF_Authorization`. Zie `vitest.config.ts` voor hetzelfde patroon in de tests.

Snelle controle live: `https://menu.bimolakafe.com/` geeft 200 met het menu; `https://admin.bimolakafe.com/` geeft 302 naar `tiny-smoke-594d.cloudflareaccess.com`; `https://bimolakafe.com/` stuurt door naar het menu. Vanuit Turkije testen: check-host.net (nodes tr1/tr2) of iemand op een Turks netwerk. CI-status: `gh run list --limit 5` of de Actions-tab op GitHub.

Databasewijzigingen alleen via een nieuw bestand in `migrations/` (nooit oude migraties aanpassen).

## Uitrollen

Altijd eerst naar de **testomgeving** (hieronder); pas na controle daar naar `main`. Een push naar `main` is meteen live.

- **Menukaart**: elke push naar `main` → Cloudflare Pages bouwt automatisch.
- **Beheer + migraties**: GitHub Actions (`.github/workflows/ci.yml`) na groene tests op `main`. Secrets in GitHub: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit), `CLOUDFLARE_ACCOUNT_ID`.
- Geheimen van de beheer-Worker (eenmalig): `npx wrangler secret put OWNER_EMAILS -c wrangler.admin.jsonc` en `npx wrangler secret put CF_API_TOKEN -c wrangler.admin.jsonc` (account-token met alleen "Access: Groups" Read + Edit).

## Testomgeving

Opgezet 2026-11-25 (Dogus: eerst testen, dan live). Gratis, zelfde Cloudflare-account.

| Onderdeel | Adres | Waar |
|---|---|---|
| Menukaart (test) | `https://test.bimolakafe.com/` | Pages-preview van branch `test` (custom domain, CNAME → `test.bimola.pages.dev`) |
| Beheer (test) | `https://admin-test.bimolakafe.com/` | Worker `admin-test` (`env.test` in `wrangler.admin.jsonc`), achter dezelfde Access-app als het echte beheer |
| Data (test) | – | D1 `bimola-test`: kopie van het echte menu (instellingen, categorieën, producten) |

- **Werkwijze**: wijziging op branch `test` committen en pushen → CI (tests, migraties op `bimola-test`, Worker `admin-test`) en Pages (preview) rollen uit. Controleren op de testadressen. Goed? Dan `test` in `main` mergen en pushen (live).
- **Wat anders is dan live**:
  - eigen database: wat je in het testbeheer wijzigt, raakt het echte menu niet;
  - witte lijst in de testdatabase (tabel `dev_admin_emails`, tab Erişim) in plaats van de Access-groep. Access laat nog steeds alleen de echte beheerders (groep + eigenaar) door, dus de testlijst kan alleen inperken;
  - `PAGES_DEV_REDIRECT = "off"` (`wrangler.toml`, `[env.preview]`): de test-uitrol stuurt niet door naar het echte menu. Elke andere branch dan `main` gebruikt voor Pages ook de testdatabase.
- **QR-tab in de test** wijst naar `https://test.bimolakafe.com/`: nooit kaartjes uit de testomgeving printen.
- **Testdata verversen** met een kopie van live: per tabel `npx wrangler d1 export bimola --remote --table <settings|categories|items> --no-schema --output <bestand>.sql -c wrangler.admin.jsonc`; in de testdatabase eerst `DELETE FROM items; DELETE FROM categories; DELETE FROM settings;`, daarna de bestanden (settings, categories, items) uitvoeren met `npx wrangler d1 execute bimola-test --remote --env test -c wrangler.admin.jsonc --file <bestand>.sql`.
- **Eenmalig (Dogus)**: `npx wrangler secret put OWNER_EMAILS -c wrangler.admin.jsonc --env test`.
- **Dashboard (gedaan)**: Pages → `bimola` → Custom domains → `test.bimolakafe.com`, daarna in DNS het CNAME-doel veranderd van `bimola.pages.dev` naar `test.bimola.pages.dev` (anders toont het adres het live menu); in Zero Trust → Access → app "bimola-admin - Cloudflare Workers" de hostname `admin-test.bimolakafe.com` toegevoegd (zelfde AUD, dus geen nieuwe app).

## Backup en herstel

- **Elke nacht** (`.github/workflows/backup.yml`): `backup/menu.json` (alle menutabellen) en `public/snapshot.json` worden gecommit. Geen e-mailadressen of log.
- **D1 Time Travel**: herstel naar elk moment van de laatste 7 dagen: `npx wrangler d1 time-travel restore bimola --timestamp=<ISO-tijd, bijv. 2026-11-16T08:00:00Z>`. Let op: dit zet de **hele** database terug, dus ook instellingen en het wijzigingslog. Eerst kijken: `npx wrangler d1 time-travel info bimola --timestamp=<ISO-tijd>`.
- **Eén wijziging**: in de beheerpagina via Geçmiş → Geri al.

## Buitengesloten?

De eigenaar staat in het geheim `OWNER_EMAILS` en in de Access-policy zelf, niet alleen in de groep. Lukt inloggen toch niet: in het Cloudflare-dashboard (met 2FA) Zero Trust → Access → de policy van Worker `admin` controleren, of `OWNER_EMAILS` opnieuw zetten met `wrangler secret put`.

Eigenaar wijzigen: `npx wrangler secret put OWNER_EMAILS -c wrangler.admin.jsonc` (komma-gescheiden) én het e-mailadres aanpassen in de Access-policy "Bi Mola beheer" (Zero Trust → Access controls → Policies).

## Eenmalige inrichting (gedaan bij de overstap)

1. `npx wrangler d1 create bimola --location eeur` → ID in `wrangler.toml` en `wrangler.admin.jsonc`; `npm run db:migrate:remote`.
2. Gegevens importeren: `node scripts/seed-from-csv.ts <menu.csv> <ayarlar.csv> > seed/seed.sql` en `npx wrangler d1 execute bimola --remote --file seed/seed.sql`.
3. Pages-project `bimola`: D1-binding komt uit `wrangler.toml`.
4. Zero Trust: teamnaam, login-methoden One-time PIN (+ Google), Access op de Worker `admin` (eerst via het account-subdomein `bimola.workers.dev`, inmiddels uitgezet; nu hostname `admin.bimolakafe.com`), groep "Bi Mola beheerders", policy = groep + eigenaar. AUD-tag en teamdomein in `wrangler.admin.jsonc`.
5. Eigen domein (2026-11-19): `bimolakafe.com` via Cloudflare Registrar in hetzelfde account. Menu: Pages-project `bimola` → Custom domains → `menu.bimolakafe.com`. Beheer: `routes` met `custom_domain: true` in `wrangler.admin.jsonc` (uitrol via CI) én de hostname `admin.bimolakafe.com` toegevoegd aan de Access-applicatie van Worker `admin`. Hoofddomein en `www`: proxied placeholder-records (AAAA `100::`) + Redirect Rule naar `https://menu.bimolakafe.com/`.
6. Google-login: OAuth-client in Google Cloud-project "Bi Mola Login" (type Web, redirect `https://tiny-smoke-594d.cloudflareaccess.com/cdn-cgi/access/callback`). De Google-app staat op **Testing**: alleen e-mailadressen in Google Auth Platform → Audience → **Test users** kunnen "Inloggen met Google" gebruiken. Nieuwe beheerders kunnen altijd inloggen met de e-mailcode; voor Google ook daar toevoegen.
