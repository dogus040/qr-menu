import type { D1Migration } from "@cloudflare/vitest-plugin";
import type { AdminEnv } from "../src/admin/env";

declare global {
  namespace Cloudflare {
    interface Env extends AdminEnv {
      TEST_MIGRATIONS: D1Migration[];
      TEST_PRIVATE_JWK: string;
    }
  }
}
