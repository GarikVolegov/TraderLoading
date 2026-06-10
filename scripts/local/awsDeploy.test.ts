import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

for (const path of [
  "Dockerfile.aws",
  ".dockerignore",
  "infra/aws/cloudformation/ecs-fargate.yml",
  "docs/deploy/aws-ecs-fargate.md",
]) {
  assert.equal(existsSync(new URL(`../../${path}`, import.meta.url)), true, `${path} should exist`);
}

const dockerfile = read("Dockerfile.aws");
assert.match(dockerfile, /FROM node:24-bookworm-slim AS base/);
assert.match(dockerfile, /FROM base AS deps/);
assert.match(dockerfile, /FROM deps AS build/);
assert.match(dockerfile, /FROM node:24-bookworm-slim AS runtime/);
assert.match(dockerfile, /pnpm install --frozen-lockfile/);
assert.match(dockerfile, /pnpm run build:railway/);
assert.match(dockerfile, /pnpm --filter @workspace\/api-server deploy --legacy --prod \/prod\/api-server/);
assert.doesNotMatch(dockerfile, /pnpm prune --prod/);
assert.match(dockerfile, /useradd --system --uid 10001/);
assert.match(dockerfile, /COPY --from=build --chown=trader:trader/);
assert.match(dockerfile, /\/prod\/api-server \/app\/artifacts\/api-server/);
assert.match(dockerfile, /HEALTHCHECK .*\/api\/healthz/s);
assert.match(dockerfile, /USER trader/);
assert.match(dockerfile, /CMD \["node", "\.\/dist\/index\.cjs"\]/);

const dockerignore = read(".dockerignore");
for (const pattern of [
  ".env*",
  ".git",
  ".local-logs",
  ".superpowers",
  "node_modules",
  "artifacts/api-server/uploads",
]) {
  assert.match(dockerignore, new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
}

const cloudformation = read("infra/aws/cloudformation/ecs-fargate.yml");
for (const token of [
  "AWS::ECS::Cluster",
  "AWS::ECS::TaskDefinition",
  "AWS::ECS::Service",
  "AWS::ElasticLoadBalancingV2::LoadBalancer",
  "AWS::ElasticLoadBalancingV2::TargetGroup",
  "AWS::ApplicationAutoScaling::ScalableTarget",
  "AWS::ApplicationAutoScaling::ScalingPolicy",
  "AWS::ElasticLoadBalancingV2::Listener",
  "AWS::Logs::LogGroup",
  "AWS::IAM::Role",
  "AWS::SecretsManager::Secret",
  "AcmCertificateArn",
  "FARGATE",
  "awsvpc",
  "/api/healthz",
  "ContainerInsights",
  "DesiredCount",
  "TaskCpu",
  "TaskMemory",
]) {
  assert.match(cloudformation, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(cloudformation, /Cpu:\s*!Ref TaskCpu/);
assert.match(cloudformation, /Memory:\s*!Ref TaskMemory/);
assert.match(cloudformation, /MaxCapacity:\s*!Ref MaxTaskCount/);
assert.match(cloudformation, /MinCapacity:\s*!Ref MinTaskCount/);
assert.match(cloudformation, /Name: DATABASE_URL/);
assert.match(cloudformation, /ValueFrom: !Sub "\$\{AppSecret\}:DATABASE_URL::"/);
assert.match(cloudformation, /HasAcmCertificate:/);
assert.match(cloudformation, /FromPort: 443/);
assert.match(cloudformation, /Protocol: HTTPS/);
assert.match(cloudformation, /CertificateArn: !Ref AcmCertificateArn/);
assert.match(cloudformation, /Type: redirect/);
assert.match(cloudformation, /Port: "443"/);
assert.match(cloudformation, /StatusCode: HTTP_301/);

const docs = read("docs/deploy/aws-ecs-fargate.md");
assert.match(docs, /ECS Fargate/);
assert.match(docs, /Amazon RDS PostgreSQL/);
assert.match(docs, /Secrets Manager/);
assert.match(docs, /ACM certificate/);
assert.match(docs, /AcmCertificateArn/);
assert.match(docs, /1 vCPU \/ 2 GB/);
assert.match(docs, /Rolling update/);
assert.match(docs, /\/api\/healthz/);
assert.match(docs, /pnpm run db:migrate/);
assert.match(docs, /aws cloudformation deploy/);

console.log("aws deploy checks passed");
