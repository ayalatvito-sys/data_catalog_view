# Data Catalog

A Hebrew-language enterprise data catalog for exploring BigQuery datasets, tables, and pipeline statuses. Connects to Google Cloud (BigQuery, Dataplex, Translation APIs).

## Run & Operate

### Frontend (React + Vite)
- Workflow: **Start application** — runs on port 5000
- Command: `pnpm --filter @workspace/data-catalog run dev`
- Proxy: `/api/*` → `http://localhost:8000` (backend)

### Backend (FastAPI)
- Workflow: **Backend API** — runs on port 8000
- Command: `cd artifacts/data-catalog-api && uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- Requires Google Cloud auth (see below)

### Useful commands
- `pnpm install` — install all Node.js dependencies
- `pnpm --filter @workspace/data-catalog exec tsc --noEmit` — typecheck the frontend
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas from OpenAPI spec
- `bash _deployment/setup-repos.sh` — split monorepo into API/APP/MNG folders for GitLab deployment

## Required Secrets / Environment

| Variable | Where used | Notes |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | Backend | e.g. `dgt-gcp-econ-dev-datalake` |
| `DATABASE_URL` | Backend | Postgres connection string |

### Google Cloud authentication (local dev)
```bash
rm -rf ~/.config/gcloud/
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth login
gcloud auth application-default login --disable-quota-project
gcloud config set project dgt-gcp-econ-dev-datalake
```

## Stack

- **Frontend**: React 19, Vite 7, TypeScript 5.9, MUI v7, TanStack Query, Tailwind CSS 4, Wouter
- **Backend**: Python 3.12, FastAPI, Uvicorn
- **Cloud**: BigQuery, Dataplex, Cloud Translation
- **Package manager**: pnpm workspaces

## Where things live

| Path | What it is |
|---|---|
| `artifacts/data-catalog/src/` | React frontend source |
| `artifacts/data-catalog/src/pages/` | Page-level components (CatalogPage, DatasetPage, TableProfilePage) |
| `artifacts/data-catalog/src/components/` | Shared UI components |
| `artifacts/data-catalog/src/contexts/RefreshContext.tsx` | Global hard-refresh state |
| `artifacts/data-catalog/src/services/` | Fetch service layer (one file per domain) |
| `artifacts/data-catalog-api/main.py` | FastAPI app + all routes |
| `artifacts/data-catalog-api/models.py` | Pydantic models |
| `lib/` | Shared workspace packages (`@workspace/api-spec`, etc.) |
| `DC-SET-DATA/` | Data loading scripts |
| `_deployment/setup-repos.sh` | GitLab deployment split script |

## Architecture decisions

- **24-hour React Query cache** (`staleTime` + `gcTime`): data is expensive to fetch from GCP; the global Refresh button is the intentional invalidation path.
- **RefreshContext pattern**: pages register a `hardRefresh` callback that hits the backend with `?refresh=true` (bypasses server-side TTL cache) then calls `queryClient.clear()` to wipe all React Query state.
- **RTL layout**: MUI theme is set to `direction: 'rtl'` with the Emotion RTL plugin. All MUI `sx` shorthand props must be inside `sx={}` (not as direct JSX attributes).
- **Vite proxy**: frontend runs on port 5000; `/api/*` is proxied to the FastAPI backend on port 8000.

## Gotchas

- MUI v7 uses `slotProps.paper` not `PaperProps` on Drawer/Dialog components.
- MUI v7 uses `slotProps.input` not `InputProps` on TextField.
- All MUI system shorthand props (`display`, `mb`, `fontWeight`, etc.) must go inside `sx={}`, not as direct JSX attributes (TypeScript will error otherwise).
- The `_deployment/setup-repos.sh` script splits the monorepo for GitLab. Re-run it after any frontend change to update the production APP folder.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._


python:
cd ~/data_catalog_view/artifacts/data-catalog-api
pip install -r requirements.txt --break-system-packages
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

react:5000
cd ~/data_catalog_view
npm install -g pnpm
pnpm install
pnpm --filter @workspace/data-catalog run dev

fuser -k 5000/tcp


login:
rm -rf ~/.config/gcloud/
unset GOOGLE_APPLICATION_CREDENTIALS
gcloud auth login
gcloud auth application-default login --disable-quota-project
gcloud config set project dgt-gcp-econ-dev-datalake

sudo apt-get update && sudo apt-get install rsync -y
bash _deployment/setup-repos.sh