// Bindings en instellingen van de beheer-Worker (zie wrangler.admin.jsonc).
export interface AdminEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Teamdomein van Cloudflare Zero Trust, bijv. "bimola.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN: string;
  /** Application Audience (AUD) Tag van de Access-applicatie. */
  ACCESS_AUD: string;
  ACCESS_ACCOUNT_ID?: string;
  /** Access-groep met de witte lijst ("Bi Mola beheerders"). */
  ACCESS_GROUP_ID?: string;
  /** Geheim: API-token met alleen het recht Access-groepen te bewerken. */
  CF_API_TOKEN?: string;
  /** Geheim: komma-gescheiden e-mailadressen van de eigenaar(s); altijd toegang, niet te verwijderen. */
  OWNER_EMAILS?: string;
  PUBLIC_MENU_URL?: string;
  /** Alleen tests: JWKS als JSON in plaats van ophalen bij het teamdomein. */
  ACCESS_JWKS_JSON?: string;
  /** Alleen lokaal/tests: "d1" = witte lijst in tabel dev_admin_emails. */
  ACCESS_DIRECTORY?: string;
}

export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 500 | 502,
    message: string
  ) {
    super(message);
  }
}
