// GET /qr  →  printpagina voor QR-tafelkaartjes (in het thema van de menukaart).
import { settingsFromRows } from "../src/shared/menu";
import { renderQrPage } from "../src/menu/render";
import { htmlHeaders } from "../src/menu/headers";

interface QrEnv {
  DB: D1Database;
  PUBLIC_MENU_URL?: string;
}

export const onRequestGet: PagesFunction<QrEnv> = async ({ env, request }) => {
  let rows: { key: string; value: string }[] = [];
  try {
    rows = (await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>()).results;
  } catch (err) {
    console.error("qr: instellingen niet geladen", err);
  }
  // Altijd het vaste adres in de QR-code, ook als deze pagina via een preview-adres is geopend.
  const menuUrl = env.PUBLIC_MENU_URL || new URL("/", request.url).toString();
  return new Response(renderQrPage(settingsFromRows(rows), menuUrl), { headers: htmlHeaders(0) });
};
