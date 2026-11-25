// Het oude adres bimola.pages.dev (en de versie-adressen <code>.bimola.pages.dev) wordt niet meer gebruikt:
// alles gaat permanent naar het eigen domein, met pad en parameters (Dogus, 2026-11-25).
// Het adres zelf kan niet weg: het hoort vast bij het Pages-project waar menu.bimolakafe.com op draait.
// Testomgeving (branch "test", test.bimolakafe.com = test.bimola.pages.dev): wrangler.toml zet daar
// PAGES_DEV_REDIRECT = "off", anders zou de test-uitrol naar het echte menu doorsturen.
const MENU_ORIGIN = "https://menu.bimolakafe.com";

interface MiddlewareEnv {
  PAGES_DEV_REDIRECT?: string;
}

export const onRequest: PagesFunction<MiddlewareEnv> = async ({ request, env, next }) => {
  const url = new URL(request.url);
  const oldHost = url.hostname === "bimola.pages.dev" || url.hostname.endsWith(".bimola.pages.dev");
  if (oldHost && env.PAGES_DEV_REDIRECT !== "off") {
    return new Response(null, {
      status: 301,
      headers: { Location: `${MENU_ORIGIN}${url.pathname}${url.search}`, "Cache-Control": "public, max-age=3600" }
    });
  }
  return next();
};
