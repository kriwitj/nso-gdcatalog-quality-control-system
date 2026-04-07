#!/bin/bash
# setup-ssl.sh — Obtain Let's Encrypt certificate with Certbot
set -euo pipefail

source .env 2>/dev/null || true
DOMAIN="${DOMAIN:?Set DOMAIN in .env}"
EMAIL="${CERT_EMAIL:?Set CERT_EMAIL in .env}"

echo "▶  Setting up SSL for ${DOMAIN}..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    apt-get update && apt-get install -y certbot
fi

# Ensure port 80 is open (temporarily stop nginx if running)
docker compose -f docker-compose.prod.yml stop nginx 2>/dev/null || true

# Obtain certificate (standalone mode)
certbot certonly --standalone \
    --preferred-challenges http \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}"

# Copy certs to nginx/certs/
mkdir -p nginx/certs
cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem nginx/certs/fullchain.pem
cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem   nginx/certs/privkey.pem
chmod 600 nginx/certs/*.pem

# Restart nginx
docker compose -f docker-compose.prod.yml start nginx

echo "✅  SSL certificate installed for ${DOMAIN}"
echo "   Renewal: add to crontab → 0 3 1 * * cd $(pwd) && ./scripts/renew-ssl.sh"
