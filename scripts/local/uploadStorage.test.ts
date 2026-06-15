import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const uploadHelperPath = "../../artifacts/api-server/src/lib/uploads.ts";
assert.equal(
  existsSync(new URL(uploadHelperPath, import.meta.url)),
  true,
  "API server should centralize upload paths",
);

const uploadHelper = read("artifacts/api-server/src/lib/uploads.ts");
assert.match(uploadHelper, /UPLOADS_DIR/);
assert.match(uploadHelper, /export function getUploadsDir/);
assert.match(uploadHelper, /export function resolveUploadPath/);

for (const path of [
  "artifacts/api-server/src/app.ts",
  "artifacts/api-server/src/routes/community.ts",
  "artifacts/api-server/src/routes/journal.ts",
  "artifacts/api-server/src/routes/library.ts",
  "artifacts/api-server/src/routes/milestones.ts",
  "artifacts/api-server/src/routes/profile.ts",
  "artifacts/api-server/src/routes/settings.ts",
  "artifacts/api-server/src/routes/social.ts",
]) {
  const source = read(path);
  assert.doesNotMatch(source, /path\.join\(process\.cwd\(\), "uploads"/, `${path} should not hardcode cwd uploads`);
}

const dockerfile = read("Dockerfile.aws");
assert.match(dockerfile, /ENV UPLOADS_DIR=\/app\/uploads/);
assert.match(dockerfile, /mkdir -p \/app\/uploads/);

const envExample = read(".env.production.example");
assert.match(envExample, /UPLOADS_DIR=/);

const cloudformation = read("infra/aws/cloudformation/ecs-fargate.yml");
for (const token of [
  "AWS::EFS::FileSystem",
  "AWS::EFS::MountTarget",
  "AWS::EFS::AccessPoint",
  "TransitEncryption: ENABLED",
  "AuthorizationConfig:",
  "AccessPointId:",
  "Volumes:",
  "MountPoints:",
  "ContainerPath: /app/uploads",
  "FromPort: 2049",
  "UPLOADS_DIR",
]) {
  assert.match(cloudformation, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

const docs = read("docs/deploy/aws-ecs-fargate.md");
assert.match(docs, /EFS/);
assert.match(docs, /\/app\/uploads/);
assert.doesNotMatch(docs, /move runtime uploads to shared storage before running more than one task/i);

console.log("upload storage checks passed");
