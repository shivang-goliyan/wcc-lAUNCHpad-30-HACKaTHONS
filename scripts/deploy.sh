#!/usr/bin/env bash
# Ship the app to a VM and (re)start it with Docker Compose + Caddy (HTTPS).
#
#   scripts/deploy.sh user@host [domain]        e.g. scripts/deploy.sh ubuntu@1.2.3.4 raynet.in
#
# First run: the VM needs Docker with the compose plugin, ports 80/443 open, and the
# domain's A record pointing at it. Secrets are read from your local .env.local and
# written to the VM's .env (mode 600); COOKIE/CONTACT secrets and the DB password are
# generated once there and kept on later deploys. Nothing secret goes into git.
set -euo pipefail

HOST="${1:?usage: scripts/deploy.sh user@host [domain]}"
DOMAIN="${2:-raynet.in}"
DIR="${REMOTE_DIR:-nami}"
cd "$(dirname "$0")/.."

echo "→ syncing code to $HOST:~/$DIR"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude .git --exclude preview \
  --exclude '.env*' --exclude '*.log' --exclude eval/results \
  ./ "$HOST:$DIR/"

# keys we pass through from the local env (only the ones that are set)
pass=""
for k in OPENROUTER_API_KEY OPENROUTER_API_KEY_2 LLM_PROVIDER LLM_BASE_URL LLM_MODEL LLM_FALLBACK_MODELS ANTHROPIC_API_KEY \
         OPENAI_API_KEY FISH_API_KEY NAMI_VOICE_ID FISH_MODEL DEEPGRAM_API_KEY \
         TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM PHONE_ALLOWLIST VIDEO_CLINIC_PHONE VIDEO_ARJUN_PHONE VIDEO_MEERA_PHONE ADMIN_PASSWORD; do
  v=$(grep -E "^$k=" .env.local 2>/dev/null | tail -1 | cut -d= -f2- || true)
  [ -n "$v" ] && pass+="$k=$v"$'\n'
done

echo "→ writing .env on the VM"
ssh "$HOST" "DIR=$DIR DOMAIN=$DOMAIN bash -s" <<EOF
set -e
cd ~/\$DIR
keep() { grep -E "^\$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }
gen() { head -c 32 /dev/urandom | base64 | tr -d '/+=' ; }
cs=\$(keep COOKIE_SECRET); [ -n "\$cs" ] || cs=\$(gen)
ct=\$(keep CONTACT_TOKEN_SECRET); [ -n "\$ct" ] || ct=\$(gen)
pg=\$(keep POSTGRES_PASSWORD); [ -n "\$pg" ] || pg=\$(gen)
umask 077
cat > .env <<ENV
DOMAIN=\$DOMAIN
APP_URL=https://\$DOMAIN
COOKIE_SECRET=\$cs
CONTACT_TOKEN_SECRET=\$ct
POSTGRES_PASSWORD=\$pg
VOICE_MAX_SESSION_SEC=300
VOICE_SESSIONS_PER_IP_PER_HOUR=6
VOICE_DAILY_MINUTES_CAP=600
$pass
ENV
docker compose up -d --build
docker compose ps
EOF

echo "→ checking https://$DOMAIN"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/" || true)
  [ "$code" = "200" ] && { echo "✓ live: https://$DOMAIN (try: https://$DOMAIN/try)"; exit 0; }
  sleep 5
done
echo "✗ https://$DOMAIN did not answer 200 yet — check DNS and 'docker compose logs caddy web' on the VM" >&2
exit 1
