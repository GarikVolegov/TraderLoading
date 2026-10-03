import assert from "node:assert/strict";
import fs from "node:fs";

// Feature-vuota finding: there was no UI control anywhere (creation or
// settings) that could ever set isPublic:false — the shipped "private
// community + owner-approved join" feature was entirely unreachable.
const createModal = fs.readFileSync("src/components/social/CreateCommunityModal.tsx", "utf8");
assert.match(createModal, /isPublic:\s*!isPrivate/, "creating a community must be able to set isPublic:false");
assert.match(createModal, /community\.create\.private_label/, "the create form must label the privacy toggle");

const generalSettings = fs.readFileSync("src/components/social/CommunityGeneralSettings.tsx", "utf8");
assert.match(generalSettings, /isPublic/, "community settings must be able to convert an existing community to private");

console.log("community privacy toggle checks passed");
