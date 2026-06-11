# AWS ECS Fargate Deployment

This path runs TraderLoadings as a production container on ECS Fargate behind an
Application Load Balancer. Use Amazon RDS PostgreSQL for the database and AWS
Secrets Manager for application secrets.

## Recommended Starting Shape

- ECS service: 2 tasks for rolling update availability.
- Task size: 1 vCPU / 2 GB memory per task for the first production pilot.
- Autoscaling: 2-6 tasks by CPU target tracking.
- Cache: ElastiCache Redis with two nodes for shared low-latency API cache.
- TLS: public production traffic should terminate on the ALB with an ACM certificate.
- Database: Amazon RDS PostgreSQL or Aurora PostgreSQL, sized separately from
  the app tasks.
- Networking: private task subnets need NAT gateways or VPC endpoints for ECR,
  Secrets Manager, CloudWatch Logs, and outbound broker/news provider APIs.
- Uploads: the template mounts encrypted EFS at `/app/uploads` and sets
  `UPLOADS_DIR=/app/uploads`, so runtime files are shared across rolling tasks.

## Build And Push

```bash
aws ecr create-repository --repository-name traderloadings
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

docker build \
  -f Dockerfile.aws \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY" \
  --build-arg VITE_CLERK_PROXY_URL="$VITE_CLERK_PROXY_URL" \
  --build-arg VITE_API_BASE="$VITE_API_BASE" \
  --build-arg VITE_STRIPE_PUBLISHABLE_KEY="$VITE_STRIPE_PUBLISHABLE_KEY" \
  -t traderloadings:$RELEASE_SHA .

docker tag traderloadings:$RELEASE_SHA <account>.dkr.ecr.<region>.amazonaws.com/traderloadings:$RELEASE_SHA
docker push <account>.dkr.ecr.<region>.amazonaws.com/traderloadings:$RELEASE_SHA
```

Use an immutable image tag or digest for every release. Reusing `latest` can
leave CloudFormation with an unchanged `ContainerImage` parameter and skip the
new task definition/deployment you expected.

`PrivateSubnetIds` must contain at least two subnets. The template creates EFS
mount targets in the first two private subnets and only allows NFS/2049 from
the ECS service security group.

The template also creates an ElastiCache Redis replication group in the private
subnets and injects `REDIS_URL` into the ECS task. Redis is used as a
distributed cache for read-heavy data such as the economic calendar, with an
in-process fallback when `REDIS_URL` is absent in local development.

## Secrets

The CloudFormation template creates an AWS Secrets Manager secret from
`AppSecretJson`. Store at least:

```json
{
  "DATABASE_URL": "postgresql://user:password@host:5432/db?sslmode=require",
  "CLERK_SECRET_KEY": "",
  "BROKER_VAULT_KEY": "",
  "VAPID_PUBLIC_KEY": "",
  "VAPID_PRIVATE_KEY": "",
  "VAPID_EMAIL": "mailto:noreply@example.com",
  "STRIPE_SECRET_KEY": "",
  "STRIPE_WEBHOOK_SECRET": "",
  "STRIPE_PRO_MONTHLY_PRICE_ID": ""
}
```

Use Secrets Manager or SSM Parameter Store in real CI/CD instead of passing raw
JSON on a shell command line.

## Deploy

```bash
aws cloudformation deploy \
  --template-file infra/aws/cloudformation/ecs-fargate.yml \
  --stack-name traderloadings-prod \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    AppName=traderloadings \
    ContainerImage=<account>.dkr.ecr.<region>.amazonaws.com/traderloadings:$RELEASE_SHA \
    VpcId=<vpc-id> \
    PublicSubnetIds=<public-subnet-1>,<public-subnet-2> \
    PrivateSubnetIds=<private-subnet-1>,<private-subnet-2> \
    AcmCertificateArn=arn:aws:acm:<region>:<account>:certificate/<certificate-id> \
    ApiCorsOrigins=https://app.example.com \
    ViteApiBase=https://app.example.com \
    AppBaseUrl=https://app.example.com \
    ViteClerkPublishableKey="$VITE_CLERK_PUBLISHABLE_KEY" \
    SentryDsn="$SENTRY_DSN" \
    AlarmEmail=ops@example.com \
    AppSecretJson=file://app-secret.json
```

### Health And Rolling Update

When `AcmCertificateArn` is set, the ALB listens on HTTPS/443 with the ACM
certificate and adds an HTTP/80 redirect rule to HTTPS. The HTTP listener still
keeps a default target group association so ECS can create the service without
a target-group race. Leave the certificate empty only for private smoke tests
before attaching a production domain.

The ALB target group and container health check use `/api/readyz`, which
verifies the API process and database connectivity before ECS keeps the task in
service. `/api/status` returns the same readiness payload for operators and
uptime monitors; `/api/healthz` remains a lightweight process liveness probe.

ECS performs Rolling update deployment with `MinimumHealthyPercent: 100` and
`MaximumPercent: 200`, so new tasks must pass health checks before old tasks are
drained. The ECS deployment circuit breaker is enabled with rollback, and tasks
get a 90 second health check grace period for startup and first DB readiness.

## Runtime Uploads

Runtime uploads are written under `UPLOADS_DIR`, which the AWS image and
CloudFormation template set to `/app/uploads`. That path is an encrypted EFS
access point mounted into every task with transit encryption enabled. This keeps
avatars, journal images, chat files, library files, milestone files, and Brain
scan artifacts durable and visible during rolling updates and horizontal
scaling. The EFS file system resource is retained on stack deletion and
replacement, so CloudFormation changes do not silently remove uploaded user
data.

## Distributed Cache

`REDIS_URL` points to the private ElastiCache endpoint using `rediss://`.
The API cache helper falls back to memory when Redis is unavailable, so a cache
incident should degrade performance rather than fail requests. The economic
calendar currently uses Redis with a four-hour TTL to avoid repeated upstream
Forex Factory fetches across every ECS task.

## Observability

CloudWatch Logs is enabled through the `awslogs` driver and the template keeps
30 days of logs in `/ecs/<AppName>`. Container Insights is enabled on the ECS
cluster for CPU, memory, network, and task-level metrics.

Set `AlarmEmail` to create an SNS topic, subscribe the operations email, and
enable CloudWatch alarms for ALB target `HTTPCode_Target_5XX_Count` spikes and
ECS service `CPUUtilization` above 80%. AWS sends a confirmation email before
notifications are delivered; confirm it immediately after stack creation.

Sentry is optional. Set `SENTRY_DSN`, `SENTRY_ENVIRONMENT=production`,
`SENTRY_TRACES_SAMPLE_RATE`, and `APP_VERSION` to receive process and Express
errors with release context. Start with `SENTRY_TRACES_SAMPLE_RATE=0.05` and
increase only when you need deeper traces. The template passes Sentry through
the optional `SentryDsn` parameter rather than a Secrets Manager JSON key, so
tasks still start when Sentry is not configured.

Datadog and New Relic are prepared through standard environment names
(`DD_SERVICE`, `NEW_RELIC_APP_NAME`). To fully enable APM, add the vendor
sidecar/agent, API keys, and Node loader required by the vendor in a follow-up
infrastructure change.

## Database Migration

Run schema changes before switching traffic for deploys that need them:

```bash
DATABASE_URL="$DATABASE_URL" pnpm run db:migrate
```

For additive changes, prefer expand/contract migrations: add compatible columns
or indexes first, deploy app code second, and remove old schema only after the
new version is stable.

The checked-in Drizzle baseline migration is intended for a fresh production
database. If an existing environment was previously created with `db:push`,
manual SQL, or an older unversioned schema, do not run the baseline blindly on
that database. First compare the live schema with the Drizzle snapshot; then
either migrate into a fresh database/restore, or mark the verified baseline as
applied in the migration journal before running later migrations.

## Notes

- Set `PGPOOL_MAX` so total task connections stay below the database connection
  limit. With Neon pooled Postgres, start at `PGPOOL_MAX=4` for the default 2-6
  task range and raise only after checking the plan's pooled connection cap.
- Use `PGSSLMODE=require` for RDS or Neon TLS.
- For multi-task realtime workloads, move scheduler leadership and transient
  signaling to shared services such as ElastiCache/Redis.
