# AWS ECS Fargate Deployment

This path runs TraderLoadings as a production container on ECS Fargate behind an
Application Load Balancer. Use Amazon RDS PostgreSQL for the database and AWS
Secrets Manager for application secrets.

## Recommended Starting Shape

- ECS service: 2 tasks for rolling update availability.
- Task size: 1 vCPU / 2 GB memory per task for the first production pilot.
- Autoscaling: 2-6 tasks by CPU target tracking.
- TLS: public production traffic should terminate on the ALB with an ACM certificate.
- Database: Amazon RDS PostgreSQL or Aurora PostgreSQL, sized separately from
  the app tasks.
- Uploads: move runtime uploads to shared storage before running more than one
  task if those files must be durable across replicas.

## Build And Push

```bash
aws ecr create-repository --repository-name traderloadings
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com

docker build \
  -f Dockerfile.aws \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY" \
  --build-arg VITE_CLERK_PROXY_URL="$VITE_CLERK_PROXY_URL" \
  --build-arg VITE_API_BASE="$VITE_API_BASE" \
  -t traderloadings:latest .

docker tag traderloadings:latest <account>.dkr.ecr.<region>.amazonaws.com/traderloadings:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/traderloadings:latest
```

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
  "VAPID_EMAIL": "mailto:noreply@example.com"
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
    ContainerImage=<account>.dkr.ecr.<region>.amazonaws.com/traderloadings:latest \
    VpcId=<vpc-id> \
    PublicSubnetIds=<public-subnet-1>,<public-subnet-2> \
    PrivateSubnetIds=<private-subnet-1>,<private-subnet-2> \
    AcmCertificateArn=arn:aws:acm:<region>:<account>:certificate/<certificate-id> \
    ApiCorsOrigins=https://app.example.com \
    ViteApiBase=https://app.example.com \
    ViteClerkPublishableKey="$VITE_CLERK_PUBLISHABLE_KEY" \
    SentryDsn="$SENTRY_DSN" \
    AppSecretJson=file://app-secret.json
```

### Health And Rolling Update

When `AcmCertificateArn` is set, the ALB listens on HTTPS/443 with the ACM
certificate and redirects HTTP/80 to HTTPS. Leave it empty only for private
smoke tests before attaching a production domain.

The ALB target group uses `/api/healthz` as a lightweight liveness probe. The
container health check uses `/api/readyz`, which verifies the API process and
database connectivity before ECS keeps the task in service. `/api/status`
returns the same readiness payload for operators and uptime monitors.

ECS performs Rolling update deployment with `MinimumHealthyPercent: 100` and
`MaximumPercent: 200`, so new tasks must pass health checks before old tasks are
drained.

## Observability

CloudWatch Logs is enabled through the `awslogs` driver and the template keeps
30 days of logs in `/ecs/<AppName>`. Container Insights is enabled on the ECS
cluster for CPU, memory, network, and task-level metrics.

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

- Set `PGPOOL_MAX` so total task connections stay below the RDS connection
  limit.
- Use `PGSSLMODE=require` for RDS TLS.
- For multi-task realtime workloads, move scheduler leadership, transient
  signaling, and uploads to shared services such as ElastiCache/Redis and S3.
