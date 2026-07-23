import assert from "node:assert/strict";
import test from "node:test";

import nextConfig from "../../next.config.ts";

test("the permissions policy allows geolocation for this site", async () => {
  assert.equal(typeof nextConfig.headers, "function");

  const headerRules = await nextConfig.headers();
  const siteRule = headerRules.find((rule) => rule.source === "/:path*");
  const permissionsPolicy = siteRule?.headers.find(
    (header) => header.key === "Permissions-Policy",
  );

  assert.equal(
    permissionsPolicy?.value,
    "camera=(), microphone=(), geolocation=(self)",
  );
});
