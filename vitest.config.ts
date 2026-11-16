// Tests draaien in de echte Workers-runtime (Miniflare) met een lokale D1.
// Voor de login-tests maken we hier een eigen RSA-sleutelpaar: de Worker krijgt
// de publieke sleutel (ACCESS_JWKS_JSON), de tests tekenen tokens met de privésleutel.
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { exportJWK, generateKeyPair } from "jose";

export default defineConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const pub = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  const priv = { ...(await exportJWK(privateKey)), kid: "test-key", alg: "RS256" };

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.admin.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            TEST_PRIVATE_JWK: JSON.stringify(priv),
            ACCESS_JWKS_JSON: JSON.stringify({ keys: [pub] }),
            ACCESS_TEAM_DOMAIN: "test.cloudflareaccess.com",
            ACCESS_AUD: "test-aud",
            ACCESS_DIRECTORY: "d1",
            OWNER_EMAILS: "owner@example.com",
            // Vast zetten: anders wint een lokale .dev.vars.
            PUBLIC_MENU_URL: "https://bimola.pages.dev/"
          }
        }
      })
    ],
    test: {
      setupFiles: ["./tests/setup.ts"],
      // Vitest maakt CSS standaard leeg; tests/themes.test.ts leest deze twee als tekst (?raw).
      css: { include: [/style\.css/, /qr\.css/] }
    }
  };
});
