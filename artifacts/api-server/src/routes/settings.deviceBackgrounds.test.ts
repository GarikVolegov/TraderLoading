process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

import assert from "node:assert/strict";

const { buildSettingsUpdateData } = await import("./settings.js");

const base = {} as Parameters<typeof buildSettingsUpdateData>[1];

// desktop URL is persisted
{
  const { updateData, error } = buildSettingsUpdateData(
    { backgroundUrlDesktop: "/images/backgrounds/desktop/nyc-skyline.webp" },
    base,
  );
  assert.equal(error, undefined);
  assert.equal(updateData.backgroundUrlDesktop, "/images/backgrounds/desktop/nyc-skyline.webp");
}

// mobile URL is persisted
{
  const { updateData } = buildSettingsUpdateData(
    { backgroundUrlMobile: "/images/backgrounds/mobile/forest-path.webp" },
    base,
  );
  assert.equal(updateData.backgroundUrlMobile, "/images/backgrounds/mobile/forest-path.webp");
}

// explicit null clears the selection
{
  const { updateData } = buildSettingsUpdateData({ backgroundUrlDesktop: null }, base);
  assert.equal(updateData.backgroundUrlDesktop, null);
}

// absent fields are not written
{
  const { updateData } = buildSettingsUpdateData({ fontChoice: "inter" }, base);
  assert.equal("backgroundUrlDesktop" in updateData, false);
  assert.equal("backgroundUrlMobile" in updateData, false);
}

console.log("settings.deviceBackgrounds: all assertions passed");
