// GET /  →  de menukaart, server-side opgebouwd uit D1.
// Valt D1 uit, dan de laatste nachtelijke momentopname (public/snapshot.json).
import { loadPublicMenu, settingsFromRows, THEMES, type PublicMenu } from "../src/shared/menu";
import { renderMenuPage, renderUnavailablePage } from "../src/menu/render";
import { htmlHeaders } from "../src/menu/headers";

export interface MenuEnv {
  DB: D1Database;
  ASSETS: Fetcher;
}

async function loadSnapshot(env: MenuEnv, request: Request): Promise<PublicMenu | null> {
  try {
    const res = await env.ASSETS.fetch(new URL("/snapshot.json", request.url));
    if (!res.ok) return null;
    const data = (await res.json()) as { settings?: { key: string; value: string }[]; categories?: PublicMenu["categories"] };
    if (!Array.isArray(data.categories)) return null;
    return { settings: settingsFromRows(data.settings ?? []), categories: data.categories };
  } catch {
    return null;
  }
}

export const onRequestGet: PagesFunction<MenuEnv> = async ({ env, request }) => {
  let menu: PublicMenu | null;
  try {
    menu = await loadPublicMenu(env.DB);
  } catch (err) {
    console.error("menu: D1 niet bereikbaar, momentopname gebruikt", err);
    menu = await loadSnapshot(env, request);
  }
  if (!menu) return new Response(renderUnavailablePage(), { status: 503, headers: htmlHeaders(0) });

  // ?bg=kahve: ander thema bekijken zonder het op te slaan.
  const preview = new URL(request.url).searchParams.get("bg");
  if (preview && (THEMES as readonly string[]).includes(preview)) {
    menu = { ...menu, settings: { ...menu.settings, theme: preview } };
  }
  return new Response(renderMenuPage(menu), { headers: htmlHeaders(15) });
};
