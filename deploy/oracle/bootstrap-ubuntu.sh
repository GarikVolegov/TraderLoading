#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This bootstrap script is intended for Ubuntu/Linux on Oracle Cloud." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi

sudo usermod -aG docker "$USER"

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

docker --version || true
docker compose version || true

cat <<'EOF'

Bootstrap complete.

Important:
1. Log out and log back in so your docker group membership is active.
2. In Oracle Cloud, also open ingress TCP ports 80 and 443 on the VM security list or NSG.
3. Then run: bash deploy/oracle/deploy.sh
EOF
