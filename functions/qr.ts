// /qr bestaat niet meer op de menukaart: de QR-kaartjes staan in de beheerpagina (tabblad QR).
// Deze functie geeft bewust 404 zonder caching. Zonder haar toont pages.dev een oude kopie uit de
// Cloudflare-cache (van de vroegere statische QR-pagina, tot 7 dagen bewaard). Functies gaan vóór die cache.
export const onRequest: PagesFunction = () =>
  new Response("404 – Bulunamadı", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex"
    }
  });
