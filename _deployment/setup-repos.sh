#!/usr/bin/env bash
# =============================================================================
# setup-repos.sh
# Creates 3 clean local folders ready to be pushed to GitLab.
# Run this from the ROOT of the monorepo.
# =============================================================================
set -euo pipefail

MONOREPO_ROOT="$(pwd)"
DEPLOY_DIR="${MONOREPO_ROOT}/_deployment"

# Destination folders — created as siblings to the monorepo by default.
# Change DEST_PARENT if you want them somewhere else.
DEST_PARENT="$(dirname "${MONOREPO_ROOT}")"
API_DEST="${DEST_PARENT}/data-catalog-api"
APP_DEST="${DEST_PARENT}/data-catalog-app"
MNG_DEST="${DEST_PARENT}/data-catalog-mng"

# Guard: refuse to overwrite existing directories unless --force is passed.
# This prevents accidental data loss on a re-run.
FORCE=false
for arg in "$@"; do
  [ "$arg" = "--force" ] && FORCE=true
done

for DEST in "${API_DEST}" "${APP_DEST}" "${MNG_DEST}"; do
  if [ -d "${DEST}" ] && [ "$FORCE" = "false" ]; then
    echo "ERROR: Destination already exists: ${DEST}"
    echo "Delete it manually or re-run with --force to overwrite."
    exit 1
  fi
done

echo "============================================"
echo "Monorepo root : ${MONOREPO_ROOT}"
echo "Output parent : ${DEST_PARENT}"
echo "============================================"

# ─────────────────────────────────────────────────────────────────────────────
# Sanity check — make sure we're in the right place
# ─────────────────────────────────────────────────────────────────────────────
for required in \
  "artifacts/data-catalog-api" \
  "artifacts/data-catalog" \
  "DC-SET-DATA" \
  "lib/api-client-react"; do
  if [ ! -d "${MONOREPO_ROOT}/${required}" ]; then
    echo "ERROR: Expected directory not found: ${required}"
    echo "Make sure you are running this script from the monorepo root."
    exit 1
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# 1. API REPO — data-catalog-api
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "▶ Creating API repo: ${API_DEST}"
mkdir -p "${API_DEST}"

# Copy application source (exclude junk and any credentials)
rsync -a \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.pyo' \
  --exclude='.replit-artifact' \
  --exclude='tmp.py' \
  --exclude='.env' \
  --exclude='*.env' \
  --exclude='*.json' \
  "${MONOREPO_ROOT}/artifacts/data-catalog-api/" \
  "${API_DEST}/"
# Note: *.json excludes any GCP service-account key files.
# The API has no legitimate JSON source files in its root — requirements.txt
# and Python modules are the only artefacts needed.

# Copy Docker files
cp "${DEPLOY_DIR}/api/Dockerfile"     "${API_DEST}/Dockerfile"
cp "${DEPLOY_DIR}/api/.dockerignore"  "${API_DEST}/.dockerignore"

echo "  ✓ API repo ready at: ${API_DEST}"

# ─────────────────────────────────────────────────────────────────────────────
# 2. APP REPO — data-catalog-app
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "▶ Creating APP repo: ${APP_DEST}"
mkdir -p "${APP_DEST}/app"
mkdir -p "${APP_DEST}/lib/api-client-react"

# Copy app source (artifacts/data-catalog → app/)
rsync -a \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.tsbuildinfo' \
  --exclude='.replit-artifact' \
  --exclude='.env' \
  "${MONOREPO_ROOT}/artifacts/data-catalog/" \
  "${APP_DEST}/app/"

# Copy shared lib (lib/api-client-react → lib/api-client-react/)
rsync -a \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='tsconfig.tsbuildinfo' \
  "${MONOREPO_ROOT}/lib/api-client-react/" \
  "${APP_DEST}/lib/api-client-react/"

# Copy root tsconfig.base.json (needed by both packages)
cp "${MONOREPO_ROOT}/tsconfig.base.json" "${APP_DEST}/tsconfig.base.json"

# Copy Docker / Nginx / workspace files
cp "${DEPLOY_DIR}/app/Dockerfile"             "${APP_DEST}/Dockerfile"
cp "${DEPLOY_DIR}/app/.dockerignore"          "${APP_DEST}/.dockerignore"
cp "${DEPLOY_DIR}/app/docker-entrypoint.sh"   "${APP_DEST}/docker-entrypoint.sh"
cp "${DEPLOY_DIR}/app/nginx.conf.template"    "${APP_DEST}/nginx.conf.template"
cp "${DEPLOY_DIR}/app/pnpm-workspace.yaml"    "${APP_DEST}/pnpm-workspace.yaml"
cp "${DEPLOY_DIR}/app/package.json"           "${APP_DEST}/package.json"

chmod +x "${APP_DEST}/docker-entrypoint.sh"

# Fix tsconfig.json: update "extends" path (../../ → ../)
sed -i 's|"../../tsconfig.base.json"|"../tsconfig.base.json"|g' \
  "${APP_DEST}/app/tsconfig.json"

echo "  ✓ APP repo ready at: ${APP_DEST}"
echo "  ℹ Run 'pnpm install' inside ${APP_DEST} to regenerate the lockfile."

# ─────────────────────────────────────────────────────────────────────────────
# 3. MNG REPO — data-catalog-mng
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "▶ Creating MNG repo: ${MNG_DEST}"
mkdir -p "${MNG_DEST}"

rsync -a \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='*.pyo' \
  --exclude='.venv' \
  --exclude='venv' \
  --exclude='.env' \
  --exclude='*.env' \
  --exclude='*.json' \
  "${MONOREPO_ROOT}/DC-SET-DATA/" \
  "${MNG_DEST}/"
# Note: *.json excludes any GCP service-account key files.

echo "  ✓ MNG repo ready at: ${MNG_DEST}"

# ─────────────────────────────────────────────────────────────────────────────
# 4. Init git + first commit in each repo
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "▶ Initialising git repos…"

for REPO_DIR in "${API_DEST}" "${APP_DEST}" "${MNG_DEST}"; do
  (
    cd "${REPO_DIR}"
    git init -b main
    # Create a minimal .gitignore
    cat > .gitignore <<'GITIGNORE'
# Python
__pycache__/
*.py[cod]
.venv/
venv/
.env

# Node
node_modules/
dist/
.tsbuildinfo

# GCP credentials — NEVER commit these specific credential file patterns
# Do NOT use *.json here — it would also exclude package.json and tsconfig files.
application_default_credentials.json
*-service-account.json
*-sa-key.json
*serviceaccount*.json
*keyfile.json
GITIGNORE

    git add .
    git commit -m "chore: initial commit (split from monorepo)"
  )
  echo "  ✓ git init done: ${REPO_DIR}"
done

# ─────────────────────────────────────────────────────────────────────────────
# Next steps — printed to terminal
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "All 3 repos are ready. Next steps:"
echo ""
echo "1. Regenerate the APP lockfile:"
echo "   cd ${APP_DEST} && pnpm install"
echo ""
echo "2. Add GitLab remotes and push:"
echo "   cd ${API_DEST}"
echo "   git remote add origin git@gitlab.com:<group>/data-catalog-api.git"
echo "   git push -u origin main"
echo ""
echo "   cd ${APP_DEST}"
echo "   git remote add origin git@gitlab.com:<group>/data-catalog-app.git"
echo "   git push -u origin main"
echo ""
echo "   cd ${MNG_DEST}"
echo "   git remote add origin git@gitlab.com:<group>/data-catalog-mng.git"
echo "   git push -u origin main"
echo ""
echo "3. For Cloud Run deployments, set these env vars:"
echo "   API service : GCP_PROJECT_ID, GCP_LOCATION"
echo "   APP service : API_BACKEND_URL=https://<api-cloud-run-url>"
echo "============================================"
