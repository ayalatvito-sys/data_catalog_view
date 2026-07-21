#!/bin/sh
set -e

if [ -z "$API_BACKEND_URL" ]; then
  echo "ERROR: API_BACKEND_URL environment variable is not set."
  exit 1
fi

echo "Configuring nginx → API backend: $API_BACKEND_URL"

TOKEN_FILE="/tmp/auth_token.conf"
METADATA_URL="http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${API_BACKEND_URL}"

echo "Writing initial empty token file to $TOKEN_FILE"
printf 'set $api_id_token "";\n' > "$TOKEN_FILE"
echo "Initial token file written OK"

fetch_token() {
  curl -sf -H "Metadata-Flavor: Google" "$METADATA_URL" 2>&1
}

write_token() {
  TOKEN="$(fetch_token)"
  RC=$?
  if [ $RC -ne 0 ] || [ -z "$TOKEN" ]; then
    echo "WARN: token fetch failed (curl exit code $RC)"
    return 1
  fi
  printf 'set $api_id_token "%s";\n' "$TOKEN" > "${TOKEN_FILE}.tmp"
  mv "${TOKEN_FILE}.tmp" "$TOKEN_FILE"
  echo "Token refreshed OK"
  return 0
}

echo "Rendering nginx config from template..."
envsubst '${API_BACKEND_URL}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf
echo "Config rendered."

echo "Testing nginx config syntax..."
nginx -t
echo "Config syntax OK."

refresh_loop() {
  while true; do
    if write_token; then
      nginx -s reload 2>&1 || echo "WARN: reload failed"
      sleep 2700
    else
      sleep 5
    fi
  done
}
refresh_loop &

echo "Starting nginx..."
exec nginx -g "daemon off;"


