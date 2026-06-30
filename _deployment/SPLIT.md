# Monorepo → 3-Repo Split Guide

## Target Repositories

| Repo name (suggested) | Source in monorepo | Cloud Run service |
|---|---|---|
| `data-catalog-api` | `artifacts/data-catalog-api/` | Backend (FastAPI) |
| `data-catalog-app` | `artifacts/data-catalog/` + `lib/api-client-react/` | Frontend (React/Nginx) |
| `data-catalog-mng` | `DC-SET-DATA/` | Management scripts (no web service) |

> **IGNORE** `artifacts/api-server-OLD/` — deprecated, exclude entirely.

---

## Task 1 — Code Splitting Mapping

### API repo (`data-catalog-api`)

**Include:**
```
artifacts/data-catalog-api/
├── main.py
├── models.py
├── cache_utils.py
├── requirements.txt
├── services/
│   ├── __init__.py
│   ├── bigquery_service.py
│   ├── dataplex_service.py
│   └── translation_service.py
```

**Also add** (from `_deployment/api/`):
```
Dockerfile
.dockerignore
```

**Exclude / do NOT copy:**
```
__pycache__/
.replit-artifact/
tmp.py                  ← scratch file, not production code
*.pyc / *.pyo
.venv / venv / env/
.env / *.env
*.json (service account keys)
```

---

### APP repo (`data-catalog-app`)

The frontend workspace package depends on a shared lib (`lib/api-client-react`),
so that lib travels with it. The APP repo uses its own mini pnpm workspace.

**Repo root — create these files** (from `_deployment/app/`):
```
Dockerfile
.dockerignore
docker-entrypoint.sh
nginx.conf.template
pnpm-workspace.yaml
package.json
tsconfig.base.json      ← copy from monorepo root
```

**Subdirectory `app/`** — contents of `artifacts/data-catalog/`:
```
app/
├── package.json
├── index.html
├── vite.config.ts
├── tsconfig.json        ← ⚠ change extends to "../tsconfig.base.json"
├── components.json
├── src/
│   ├── App.tsx
│   ├── assets/
│   ├── components/
│   ├── contexts/
│   ├── hooks/
│   ├── lib/
│   ├── main.tsx
│   ├── pages/
│   ├── services/
│   ├── theme.ts
│   └── types/
└── public/
    ├── favicon.svg
    ├── opengraph.jpg
    └── robots.txt
```

**Subdirectory `lib/api-client-react/`** — contents of `lib/api-client-react/`:
```
lib/
└── api-client-react/
    ├── package.json
    ├── tsconfig.json    ← ⚠ change extends to "../../tsconfig.base.json" (already correct)
    └── src/
        ├── custom-fetch.ts
        ├── index.ts
        └── generated/
            ├── api.ts
            └── api.schemas.ts
```

**Exclude / do NOT copy:**
```
**/node_modules/
**/dist/
**/.tsbuildinfo
.replit-artifact/
```

**Required tsconfig.json fix in `app/tsconfig.json`:**
```jsonc
// Change this line:
"extends": "../../tsconfig.base.json"
// To:
"extends": "../tsconfig.base.json"
```

After copying, generate the lockfile and commit it — **this must be done before the first Docker build**:
```bash
cd data-catalog-app
pnpm install          # generates pnpm-lock.yaml
git add pnpm-lock.yaml
git commit -m "chore: add pnpm lockfile"
```

> ⚠️ The APP Dockerfile uses `pnpm install --frozen-lockfile`. Docker build will fail if `pnpm-lock.yaml` is missing from the repo root. Always commit the lockfile before pushing an image.

---

### MNG repo (`data-catalog-mng`)

**Include** (contents of `DC-SET-DATA/`):
```
cataloger.py
dataplex_info_monday.py
poc_cataloger.py
requirements.txt
set_insights.py
sync_descriptions.py
sync_descriptions.py
tagger_script.py
tmp_remove_tasks_aspect_from_tables.py
```

**Exclude:**
```
__pycache__/
.venv / venv/
.env / *.env
*.json (service account keys)
```

No Dockerfile is needed — these are management scripts run manually or
via Cloud Run Jobs / Cloud Scheduler, not a persistent web service.
If you want to containerise them later, use the same Python slim base
as the API Dockerfile.

---

## Task 2 — API Dockerfile

See `_deployment/api/Dockerfile` and `_deployment/api/.dockerignore`.

**Key Cloud Run env vars to set in the GCP Console or `gcloud run deploy`:**
```
GCP_PROJECT_ID=<your-project-id>
GCP_LOCATION=me-west1
```

GCP identity: attach a **service account** with the following roles at deploy time
(do NOT ship ADC credentials in the image):
- `roles/bigquery.dataViewer`
- `roles/bigquery.jobUser`
- `roles/dataplex.viewer`
- `roles/cloudtranslate.user`

---

## Task 3 — APP Dockerfile & Nginx

See:
- `_deployment/app/Dockerfile`
- `_deployment/app/.dockerignore`
- `_deployment/app/nginx.conf.template`
- `_deployment/app/docker-entrypoint.sh`

**Required Cloud Run env var:**
```
API_BACKEND_URL=https://data-catalog-api-<hash>-<region>.a.run.app
```

Set this when deploying the APP service. The entrypoint script will fail fast
(non-zero exit) if this variable is missing, so Cloud Run will show a clear error.

---

## Task 4 — Bash Setup Commands

See `_deployment/setup-repos.sh` for the complete, copy-paste-ready script.
