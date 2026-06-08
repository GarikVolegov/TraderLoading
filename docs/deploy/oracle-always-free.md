# Oracle Always Free Deploy

This deploy runs TraderLoadings on one Oracle Cloud Always Free VM with Docker Compose:

- `caddy` terminates HTTPS on ports `80` and `443`.
- `app` runs the built Express API and serves the React frontend from the same domain.
- `postgres` stores user settings, push subscriptions, and scheduled call data.

Use an Oracle `VM.Standard.A1.Flex` instance. Oracle documents the Always Free Ampere A1 allowance as 3,000 OCPU hours and 18,000 GB hours per month, equivalent to 4 OCPUs and 24 GB RAM for Always Free tenancies. A practical starting point is 1 OCPU, 6 GB RAM, Ubuntu 24.04, and a 50 GB boot volume.

## 1. Create The VM

There are two supported paths:

- Manual Oracle Console setup, described below.
- Terraform/OpenTofu setup in `infra/oracle/terraform`.

For Terraform/OpenTofu:

```bash
cd infra/oracle/terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars
terraform init
terraform apply
terraform output public_ip
terraform output ssh_command
```

Then point your domain `A` record to the `public_ip` output.

In Oracle Cloud:

1. Create a Compute instance in your home region.
2. Choose an Always Free-eligible Ubuntu image.
3. Choose shape `VM.Standard.A1.Flex`.
4. Allocate 1 OCPU and 6 GB RAM.
5. Add your SSH public key.
6. Open ingress rules for TCP `22`, `80`, and `443` in the VM security list or network security group.

Point a domain to the VM public IP. Cloudflare DNS-only mode works well while Caddy issues the first certificate. After HTTPS is working, proxied mode can be enabled if desired.

## 2. Install Docker On The VM

SSH into the VM, then run:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
```

After cloning the repository, you can let the repo bootstrap Docker and the VM firewall:

```bash
bash deploy/oracle/bootstrap-ubuntu.sh
```

Log out and log back in after bootstrap so your Docker group membership is active.

## 3. Upload The App

Clone the repository on the VM:

```bash
git clone <your-repo-url> TraderLoadingsLOCALE
cd TraderLoadingsLOCALE
```

Create the production env file:

```bash
cp .env.oracle.example .env.oracle
nano .env.oracle
```

Set at least:

- `APP_DOMAIN`
- `API_CORS_ORIGINS`
- `POSTGRES_PASSWORD`
- `DATABASE_URL` with the same Postgres password
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_EMAIL`

Generate VAPID keys locally before copying them:

```bash
pnpm push:vapid
```

Do not commit `.env.oracle`.

Validate it before deploying:

```bash
bash deploy/oracle/validate-env.sh
```

## 4. Build And Start

Use the deployment helper:

```bash
bash deploy/oracle/deploy.sh
```

The script builds the app image, starts Postgres, runs `pnpm run db:push`, starts Caddy/app/Postgres, and checks `https://$APP_DOMAIN/api/healthz`.

Equivalent manual commands:

```bash
docker compose --env-file .env.oracle -f compose.oracle.yml build
docker compose --env-file .env.oracle -f compose.oracle.yml up -d postgres
```

Create or update database tables:

```bash
docker compose --env-file .env.oracle -f compose.oracle.yml run --rm --workdir /app app pnpm run db:push
```

Start the app and HTTPS proxy:

```bash
docker compose --env-file .env.oracle -f compose.oracle.yml up -d
```

Check health:

```bash
curl -fsS https://$APP_DOMAIN/api/healthz
docker compose --env-file .env.oracle -f compose.oracle.yml ps
docker compose --env-file .env.oracle -f compose.oracle.yml logs -f app
```

Or use:

```bash
bash deploy/oracle/status.sh
```

Expected health response:

```json
{"status":"ok"}
```

## 5. Enable Push Calls

Open the deployed app in the browser, log in, go to settings, enable push notifications, and allow the browser permission. The server must stay running for scheduled push calls to be sent while the app is closed.

## 6. Update Deploy

On the VM:

```bash
bash deploy/oracle/update.sh
```

This runs `git pull --ff-only`, rebuilds the app image, pushes DB schema changes, and restarts the stack.

## 7. Useful Operations

Restart:

```bash
docker compose --env-file .env.oracle -f compose.oracle.yml restart app
```

Back up Postgres:

```bash
docker compose --env-file .env.oracle -f compose.oracle.yml exec postgres pg_dump -U traderloading traderloading > traderloading-backup.sql
```

See Caddy certificate logs:

```bash
docker compose --env-file .env.oracle -f compose.oracle.yml logs -f caddy
```
