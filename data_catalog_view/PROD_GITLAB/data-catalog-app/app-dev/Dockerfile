# ============================================================
# APP — Production Dockerfile for GCP Cloud Run
# Repo: data-catalog-app
# Multi-stage: pnpm build → Nginx static serve
#
# Expected repo layout (see SPLIT.md Task 4 for setup commands):
#   /
#   ├── Dockerfile
#   ├── docker-entrypoint.sh
#   ├── nginx.conf.template
#   ├── tsconfig.base.json         ← copied from monorepo root
#   ├── pnpm-workspace.yaml        ← see below
#   ├── pnpm-lock.yaml             ← regenerate after setup
#   ├── package.json               ← minimal root (workspace scripts)
#   ├── app/                       ← artifacts/data-catalog/ contents
#   │   ├── package.json
#   │   ├── vite.config.ts         ← no changes needed
#   │   ├── tsconfig.json          ← update extends: "../tsconfig.base.json"
#   │   ├── index.html
#   │   ├── src/
#   │   └── public/
#   └── lib/
#       └── api-client-react/      ← lib/api-client-react/ contents
#           ├── package.json
#           └── src/
# ============================================================

# # ---- Stage 1: Build the React app ----
# FROM node:22-slim AS builder

# # Install pnpm
# RUN corepack enable && corepack prepare pnpm@latest --activate

# WORKDIR /workspace

# # Copy workspace manifests + lockfile first (layer-cache friendly).
# # pnpm-lock.yaml must exist in the APP repo root before building.
# # Generate it once with: cd data-catalog-app && pnpm install
# COPY pnpm-workspace.yaml ./
# COPY package.json ./
# COPY pnpm-lock.yaml ./
# COPY tsconfig.base.json ./

# # Copy lib package manifests
# COPY lib/api-client-react/package.json ./lib/api-client-react/

# # Copy app package manifest
# COPY app/package.json ./app/

# # Install all dependencies (both workspace packages)
# # RUN pnpm install --frozen-lockfile
# RUN pnpm install --no-frozen-lockfile --config.strict-dep-builds=false

# # Copy full source (after install to leverage cache)
# COPY lib/api-client-react/src ./lib/api-client-react/src
# COPY lib/api-client-react/tsconfig.json ./lib/api-client-react/

# COPY app/src       ./app/src
# COPY app/public    ./app/public
# COPY app/index.html         ./app/
# COPY app/vite.config.ts     ./app/
# COPY app/tsconfig.json      ./app/
# COPY app/components.json    ./app/

# # Build the Vite app (output lands in app/dist/public/)
# RUN pnpm --filter @workspace/data-catalog run build


# # ---- Stage 2: Nginx runtime ----
# FROM nginx:1.27-alpine AS runtime

# # Install envsubst (part of gettext) for runtime config templating
# RUN apk add --no-cache gettext

# # Remove default nginx config
# RUN rm /etc/nginx/conf.d/default.conf

# # Copy the nginx template and entrypoint directly from the build context
# # (docker-entrypoint.sh never enters the builder stage — copy it here directly)
# COPY docker-entrypoint.sh /docker-entrypoint.sh
# COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template

# RUN chmod +x /docker-entrypoint.sh

# # Copy built static assets
# COPY --from=builder /workspace/app/dist/public /usr/share/nginx/html

# # Cloud Run uses port 8080
# EXPOSE 8080

# # API_BACKEND_URL must be set as a Cloud Run env var at deploy time
# ENV API_BACKEND_URL=""

# ENTRYPOINT ["/docker-entrypoint.sh"]

# ============================================================
# APP — Production Dockerfile for GCP Cloud Run
# ============================================================

# ---- Stage 1: Build the React app ----
    FROM node:22-slim AS builder

    # Install pnpm
    RUN corepack enable && corepack prepare pnpm@latest --activate
    
    # ביטול חסימות האבטחה של pnpm באופן גלובלי בתוך השרת
    RUN pnpm config set strict-dep-builds false
    
    WORKDIR /workspace
    
    # Copy workspace manifests + lockfile
    COPY pnpm-workspace.yaml ./
    COPY package.json ./
    COPY pnpm-lock.yaml ./
    COPY tsconfig.base.json ./
    
    # Copy lib package manifests
    COPY lib/api-client-react/package.json ./lib/api-client-react/
    
    # Copy app package manifest
    COPY app/package.json ./app/
    
    # Install all dependencies (ההתקנה תעבור עכשיו חלק)
    RUN pnpm install --no-frozen-lockfile
    
    # Copy full source
    COPY lib/api-client-react/src ./lib/api-client-react/src
    COPY lib/api-client-react/tsconfig.json ./lib/api-client-react/
    
    COPY app/src       ./app/src
    COPY app/public    ./app/public
    COPY app/index.html         ./app/
    COPY app/vite.config.ts     ./app/
    COPY app/tsconfig.json      ./app/
    COPY app/components.json    ./app/
    
    # Build the Vite app (פקודת הבנייה גם תעבור חלק בלי להיתקע)
    RUN pnpm --filter @workspace/data-catalog run build
    
    
    # ---- Stage 2: Nginx runtime ----
    FROM nginx:1.27-alpine AS runtime
    
    # RUN apk add --no-cache gettext
    RUN apk add --no-cache gettext curl
    RUN rm /etc/nginx/conf.d/default.conf
    
    COPY docker-entrypoint.sh /docker-entrypoint.sh
    COPY nginx.conf.template /etc/nginx/templates/nginx.conf.template
    
    RUN chmod +x /docker-entrypoint.sh
    RUN sed -i 's/\r$//' /docker-entrypoint.sh
    
    COPY --from=builder /workspace/app/dist/public /usr/share/nginx/html
    # COPY --from=builder /workspace/app/dist /usr/share/nginx/html
    
    EXPOSE 8080
    ENV API_BACKEND_URL="https://dev-datalake-catalog-api-cr-XXXXXXX.me-west1.run.app"
    
    ENTRYPOINT ["/docker-entrypoint.sh"]