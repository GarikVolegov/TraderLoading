# AWS ECS Fargate Deployment

This path runs TraderLoadings as a production container on ECS Fargate behind an
Application Load Balancer. Use Amazon RDS PostgreSQL for the database and AWS
Secrets Manager for application secrets.

## Recommended Starting Shape

- ECS service: 2 tasks for rolling update availability.
- Task size: 1 vCPU / 2 GB memory per task for the first production pilot.
- Autoscaling: 2-6 tasks by CPU target tracking.
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
    ApiCorsOrigins=https://app.example.com \
    ViteApiBase=https://app.example.com \
    ViteClerkPublishableKey="$VITE_CLERK_PUBLISHABLE_KEY" \
    AppSecretJson=file://app-secret.json
```

### Rolling Update

The ALB and container health checks use `/api/healthz`. ECS performs Rolling update
deployment with `MinimumHealthyPercent: 100` and `MaximumPercent: 200`,
so new tasks must pass health checks before old tasks are drained.

## Database Migration

Run schema changes before switching traffic for deploys that need them:

```bash
DATABASE_URL="$DATABASE_URL" pnpm run db:migrate
```

For additive changes, prefer expand/contract migrations: add compatible columns
or indexes first, deploy app code second, and remove old schema only after the
new version is stable.

## Notes

- Set `PGPOOL_MAX` so total task connections stay below the RDS connection
  limit.
- Use `PGSSLMODE=require` for RDS TLS.
- Add HTTPS on the ALB with ACM before public production launch.
- For multi-task realtime workloads, move scheduler leadership, transient
  signaling, and uploads to shared services such as ElastiCache/Redis and S3.
