# Bi Mola – QR-menukaart

Turkse digitale menukaart (kraft-stijl) voor Bi Mola, met een beheerpagina voor de telefoon. Alles draait gratis op Cloudflare.

| Onderdeel | Adres | Waar |
|---|---|---|
| Menukaart (QR-code) | `https://bimola.pages.dev/` | Cloudflare Pages-project `bimola` (+ Pages Functions) |
| QR-kaartjes printen | `https://bimola.pages.dev/qr` | idem |
| Beheerpagina | `https://admin.bimola.workers.dev/` | Worker `admin`, achter Cloudflare Access |
| Data | – | Cloudflare D1-database `bimola` |

Het Pages-project `bimola` **nooit verwijderen**: de geprinte QR-codes wijzen ernaar, en een vrijgekomen naam kan door iemand anders worden geclaimd.

## Hoe het werkt

```
Gast ──► bimola.pages.dev ──(alleen lezen)──► D1 ◄──(lezen + schrijven)── admin ◄── Cloudflare Access ◄── Dogus / Emre
```

- **Menukaart**: `functions/index.ts` bouwt de pagina server-side uit D1 (`src/menu/render.ts`). Werkt zonder JavaScript. Is D1 onbereikbaar, dan toont hij `public/snapshot.json` (nachtelijke kopie).
- **Beheer**: `src/admin/` (Hono). Elke aanvraag moet een geldig Cloudflare Access-token hebben (handtekening, app, uitgever, geldigheid) én een e-mailadres op de witte lijst. Schrijfacties alleen als JSON vanaf de eigen pagina (CSRF-controle).
- **Witte lijst**: de Access-groep "Bi Mola beheerders" (`ACCESS_GROUP_ID`); beheerders passen die aan in het tabblad **Erişim**. De eigenaar (`OWNER_EMAILS`) mag er altijd in en kan niet worden verwijderd.
- **Wijzigingen**: elke wijziging is één D1-transactie met een logregel (wie, wanneer, voor/na). Tabblad **Geçmiş** toont de log met **Geri al** (terugdraaien) en de prullenbak. Twee mensen tegelijk: wie met een verouderde versie opslaat krijgt een melding in plaats van het werk van de ander te overschrijven.
- **Bedragen** staan als hele kuruş in de database (180 TL = 18000).

## Menu bewerken

Open de beheerpagina en log in met Google of een e-mailcode (alleen adressen op de witte lijst):

- **Menü**: schakelaar = satışta/tükendi; tik op een product om naam, prijs (één prijs of Küçük/Büyük), categorie, labels en allergenen te wijzigen, te verplaatsen of te verwijderen. Categorieën via **Düzenle** / **+ Yeni kategori**.
- **Ayarlar**: naam, slogan, adres, telefoon, Instagram, openingstijden, voettekst, achtergrond (thema), valuta, maat-labels.
- **Erişim**: e-mailadressen toevoegen/verwijderen.
- **Geçmiş**: laatste wijzigingen, terugdraaien, prullenbak.

Thema bekijken zonder op te slaan: `https://bimola.pages.dev/?bg=kahve` (kagit, kahve, cini, kraft, espresso).

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

Snelle controle live: `https://bimola.pages.dev/` geeft 200 met het menu; `https://admin.bimola.workers.dev/` geeft 302 naar `tiny-smoke-594d.cloudflareaccess.com`. CI-status: `gh run list --limit 5` of de Actions-tab op GitHub.

Databasewijzigingen alleen via een nieuw bestand in `migrations/` (nooit oude migraties aanpassen).

## Uitrollen

- **Menukaart**: elke push naar `main` → Cloudflare Pages bouwt automatisch.
- **Beheer + migraties**: GitHub Actions (`.github/workflows/ci.yml`) na groene tests op `main`. Secrets in GitHub: `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit, D1: Edit), `CLOUDFLARE_ACCOUNT_ID`.
- Geheimen van de beheer-Worker (eenmalig): `npx wrangler secret put OWNER_EMAILS -c wrangler.admin.jsonc` en `npx wrangler secret put CF_API_TOKEN -c wrangler.admin.jsonc` (account-token met alleen "Access: Groups" Read + Edit).

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
4. Zero Trust: teamnaam, login-methoden One-time PIN (+ Google), Access op de Worker `admin` (alle verkeer; account-subdomein `bimola.workers.dev`), groep "Bi Mola beheerders", policy = groep + eigenaar. AUD-tag en teamdomein in `wrangler.admin.jsonc`.
5. Google-login: OAuth-client in Google Cloud-project "Bi Mola Login" (type Web, redirect `https://tiny-smoke-594d.cloudflareaccess.com/cdn-cgi/access/callback`). De Google-app staat op **Testing**: alleen e-mailadressen in Google Auth Platform → Audience → **Test users** kunnen "Inloggen met Google" gebruiken. Nieuwe beheerders kunnen altijd inloggen met de e-mailcode; voor Google ook daar toevoegen.
