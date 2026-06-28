---
name: Full-stack caching architecture
description: How caching is implemented across backend (Python) and frontend (React Query) with a global hard-refresh button.
---

## Backend (Python/FastAPI)

`cache_utils.py` holds a single `@cached(ttl=300)` decorator that:
- Keys on `func.__qualname__ + args[1:]` (skips `self` to avoid identity collisions)
- Pops a `refresh: bool = False` kwarg before forwarding to the real function
- When `refresh=True`, bypasses and overwrites the cache entry

All GCP-fetching service methods in `BigQueryService` and `DataplexService` are decorated. Every endpoint accepts `?refresh=true` (FastAPI `Query(False)`) and forwards it.

**Why:** GCP Dataplex/BigQuery calls are slow (seconds each); caching them in-process avoids repeated round-trips while still allowing forced updates.

## Frontend (React Query)

`App.tsx` sets `staleTime: 5 * 60 * 1000` (matches backend TTL) so navigating "Back" uses cached data instantly.

`DatasetPage` and `TableProfilePage` were converted from `useEffect+fetch` to `useQuery`. `CatalogPage` already used generated hooks.

## Global Refresh Button pattern (`RefreshContext`)

- `RefreshProvider` in `App.tsx` wraps all routes.
- Each page calls `registerHardRefresh(fn)` in a `useEffect` to register its hard-refresh logic.
- Refresh buttons in each page's AppBar call `triggerHardRefresh()` from the context.
- The registered handler: (1) fetches the relevant endpoints with `?refresh=true` to warm the backend cache, (2) calls `queryClient.clear()` (CatalogPage) or `queryClient.removeQueries + fetchQuery` (DatasetPage, TableProfilePage) to force a fresh React Query fetch.

**Why avoid `removeQueries` with raw string keys for CatalogPage:** The generated `@workspace/api-client-react` hooks use URL-based query keys; guessing them by hand is fragile. `queryClient.clear()` is simpler and correct for a full-page refresh.

**How to apply:** Any new page that fetches data should call `registerHardRefresh` in a `useEffect` and wire its AppBar Refresh button to `triggerHardRefresh()`.
