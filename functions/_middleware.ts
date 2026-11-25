// Het oude adres bimola.pages.dev (en de versie-adressen <code>.bimola.pages.dev) wordt niet meer gebruikt:
// alles gaat permanent naar het eigen domein, met pad en parameters (Dogus, 2026-11-25).
// Het adres zelf kan niet weg: het hoort vast bij het Pages-project waar menu.bimolakafe.com op draait.
const MENU_ORIGIN = "https://menu.bimolakafe.com";

export const onRequest: PagesFunction = async ({ request, next }) => {
  const url = new URL(request.url);
  if (url.hostname === "bimola.pages.dev" || url.hostname.endsWith(".bimola.pages.dev")) {
    return new Response(null, {
      status: 301,
      headers: { Location: `${MENU_ORIGIN}${url.pathname}${url.search}`, "Cache-Control": "public, max-age=3600" }
    });
  }
  return next();
};
