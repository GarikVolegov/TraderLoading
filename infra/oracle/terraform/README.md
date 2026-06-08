# Oracle Terraform/OpenTofu

This folder creates the Oracle Always Free infrastructure for TraderLoadings:

- VCN
- public subnet
- internet gateway
- route table
- security list for TCP `22`, `80`, and `443`
- `VM.Standard.A1.Flex` Ubuntu instance
- cloud-init bootstrap that installs Docker and clones the repo

## Prerequisites

Install Terraform or OpenTofu and configure an Oracle Cloud API key. You need:

- tenancy OCID
- user OCID
- API key fingerprint
- API private key path
- region
- compartment OCID
- availability domain
- Ubuntu image OCID for your region
- SSH public key

## Create The VM

```bash
cd infra/oracle/terraform
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars
terraform init
terraform plan
terraform apply
terraform output public_ip
terraform output ssh_command
```

Point your DNS `A` record to `terraform output public_ip`.

## Deploy The App

SSH into the VM:

```bash
$(terraform output -raw ssh_command)
cd /opt/traderloadings/app
cp .env.oracle.example .env.oracle
nano .env.oracle
bash deploy/oracle/validate-env.sh
bash deploy/oracle/deploy.sh
```

The deploy helper builds the Docker image, starts Postgres, runs `pnpm run db:push`, starts Caddy, and checks `/api/healthz`.

## Update Later

```bash
cd /opt/traderloadings/app
bash deploy/oracle/update.sh
```
