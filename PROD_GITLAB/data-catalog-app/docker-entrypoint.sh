#!/bin/sh
# docker-entrypoint.sh
# Substitutes env vars into nginx.conf.template → /etc/nginx/conf.d/default.conf
# then starts nginx in the foreground.
set -e

# Require the API backend URL to be set
if [ -z "$API_BACKEND_URL" ]; then
  echo "ERROR: API_BACKEND_URL environment variable is not set."
  echo "Set it to your FastAPI Cloud Run service URL, e.g.:"
  echo "  https://data-catalog-api-xxxx-ew.a.run.app"
  exit 1
fi

echo "Configuring nginx → API backend: $API_BACKEND_URL"

envsubst '${API_BACKEND_URL}' \
  < /etc/nginx/templates/nginx.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
