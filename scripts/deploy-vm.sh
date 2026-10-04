#!/usr/bin/env bash
# Ship to a shared VM that already runs Caddy (the lead's box): build here, load the image
# there, run web + worker + db with memory caps on 127.0.0.1:3320, and add one Caddy block.
#
#   scripts/deploy-vm.sh user@host [domain] [ssh-key]
#
# Rules for a shared box: own folder (~/raynet), never touch other services, back up the
# Caddyfile before editing, `caddy validate`, then reload (never restart).
set -euo pipefail

HOST="${1:?usage: scripts/deploy-vm.sh user@host [domain] [ssh-key]}"
DOMAIN="${2:-raynet.in}"
KEY="${3:-$HOME/.ssh/gcp_kgb}"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o ConnectTimeout=20 "$HOST")
cd "$(dirname "$0")/.."

echo "→ building raynet:prod"
docker build -q -t raynet:prod . >/dev/null

echo "→ shipping the image (compressed)"
docker save raynet:prod | gzip -1 | "${SSH[@]}" 'gunzip | docker load' | tail -1

# keys passed through from the local env (only the ones that are set)
pass=""
for k in LLM_PROVIDER LLM_BASE_URL LLM_MODEL LLM_FALLBACK_MODELS LLM_API_KEYS OPENROUTER_API_KEY OPENROUTER_API_KEY_2 ANTHROPIC_API_KEY \
         TYPESAFE_API_KEY OPENAI_API_KEY FISH_API_KEY NAMI_VOICE_ID FISH_MODEL DEEPGRAM_API_KEY \
         TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM PHONE_ALLOWLIST VIDEO_CLINIC_PHONE VIDEO_ARJUN_PHONE VIDEO_MEERA_PHONE ADMIN_PASSWORD; do
  v=$(grep -E "^$k=" .env.local 2>/dev/null | tail -1 | cut -d= -f2- || true)
  [ -n "$v" ] && pass+="$k=$v"$'\n'
done

echo "→ compose file and .env"
"${SSH[@]}" 'mkdir -p ~/raynet'
scp -q -i "$KEY" -o IdentitiesOnly=yes docker-compose.vm.yml "$HOST:raynet/docker-compose.yml"
"${SSH[@]}" "DOMAIN=$DOMAIN bash -s" <<EOF
set -e
cd ~/raynet
keep() { grep -E "^\$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }
gen() { head -c 32 /dev/urandom | base64 | tr -d '/+=' ; }
cs=\$(keep COOKIE_SECRET); [ -n "\$cs" ] || cs=\$(gen)
ct=\$(keep CONTACT_TOKEN_SECRET); [ -n "\$ct" ] || ct=\$(gen)
pg=\$(keep POSTGRES_PASSWORD); [ -n "\$pg" ] || pg=\$(gen)
umask 077
cat > .env <<ENV
APP_URL=https://\$DOMAIN
COOKIE_SECRET=\$cs
CONTACT_TOKEN_SECRET=\$ct
POSTGRES_PASSWORD=\$pg
VOICE_MAX_SESSION_SEC=300
VOICE_SESSIONS_PER_IP_PER_HOUR=6
VOICE_DAILY_MINUTES_CAP=600
$pass
ENV
docker compose up -d --remove-orphans
for i in \$(seq 1 40); do curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3320/ | grep -q 200 && break; sleep 2; done
echo "local web: \$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3320/)"
docker compose ps --format '{{.Service}} {{.Status}}'
EOF

echo "→ Caddy block for $DOMAIN"
"${SSH[@]}" "DOMAIN=$DOMAIN bash -s" <<'EOF'
set -e
if grep -qE "^$DOMAIN[ ,]" /etc/caddy/Caddyfile; then echo "block already there"; exit 0; fi
BAK=/etc/caddy/Caddyfile.bak-raynet-$(date +%Y%m%d-%H%M%S)
sudo cp /etc/caddy/Caddyfile "$BAK"
sudo tee -a /etc/caddy/Caddyfile >/dev/null <<BLOCK

# Raynet (Nami): hackathon demo, web on 127.0.0.1:3320 (~/raynet, docker compose)
$DOMAIN, www.$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:3320
}
BLOCK
if ! sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  sudo cp "$BAK" /etc/caddy/Caddyfile
  echo "caddy validate failed: Caddyfile restored from $BAK, nothing reloaded" >&2
  exit 1
fi
sudo systemctl reload caddy
echo "caddy reloaded"
EOF

echo "→ checking https://$DOMAIN"
for i in $(seq 1 24); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
  [ "$code" = "200" ] && { echo "✓ live: https://$DOMAIN"; exit 0; }
  sleep 5
done
echo "✗ https://$DOMAIN is not answering yet. If DNS doesn't point at the VM yet, that's why; Caddy will fetch the certificate once it does." >&2
exit 1
