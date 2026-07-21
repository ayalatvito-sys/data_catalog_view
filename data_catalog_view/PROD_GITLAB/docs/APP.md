# תיעוד Frontend (app-dev) — קטלוג הנתונים

> **שפת תיעוד:** עברית. כל שמות הקלאסים, הפונקציות, המשתנים, שירותי GCP, פקודות ו-code snippets — נשמרים באנגלית.

---

## תוכן עניינים

1. [סקירה](#1-סקירה)
2. [Stack וסביבת פיתוח](#2-stack-וסביבת-פיתוח)
3. [מבנה הקבצים](#3-מבנה-הקבצים)
4. [RTL ו-Hebrew — ארבע שכבות](#4-rtl-ו-hebrew--ארבע-שכבות)
5. [MUI Theme](#5-mui-theme)
6. [Provider Stack — סדר העטיפה ב-App.tsx](#6-provider-stack--סדר-העטיפה-ב-apptsx)
7. [React Query — ניהול מצב שרת](#7-react-query--ניהול-מצב-שרת)
8. [ניתוב (Routing)](#8-ניתוב-routing)
9. [עמודים (Pages)](#9-עמודים-pages)
10. [רכיבים (Components)](#10-רכיבים-components)
11. [RefreshContext — מנגנון הרענון הגלובאלי](#11-refreshcontext--מנגנון-הרענון-הגלובאלי)
12. [שכבת ה-Services](#12-שכבת-ה-services)
13. [Generated API Client (`lib/api-client-react`)](#13-generated-api-client-libapi-client-react)
14. [Profile Feature — תת-מערכת עצמאית](#14-profile-feature--תת-מערכת-עצמאית)
15. [docker-entrypoint.sh — Token Refresh Loop](#15-docker-entrypointsh--token-refresh-loop)
16. [Nginx ו-Cloud Run](#16-nginx-ו-cloud-run)
17. [Monorepo — מבנה ה-pnpm workspace](#17-monorepo--מבנה-ה-pnpm-workspace)
18. [Build ו-Dev](#18-build-ו-dev)
19. [דגשים חשובים למתחזק](#19-דגשים-חשובים-למתחזק)

---

## 1. סקירה

ה-frontend הוא אפליקציית React SPA (Single Page Application) הבנויה עם Vite. היא מוגשת על-ידי Nginx ב-Cloud Run, שמשמש גם כ-reverse proxy ל-API backend.

ממשק המשתמש הוא **עברי RTL במלואו** — החל מ-`<html dir="rtl">` ועד ל-MUI Emotion cache. כל הטקסטים, שגיאות, ותוויות הם בעברית.

---

## 2. Stack וסביבת פיתוח

| טכנולוגיה | גרסה | תפקיד |
|---|---|---|
| React | 19.1.0 | UI framework |
| Vite | ^7.3.2 (catalog) | Build tool + dev server |
| Material UI (MUI) | v9 | Component library ראשי |
| `@emotion/cache` + `stylis-plugin-rtl` | — | RTL support ל-MUI |
| TanStack React Query | ^5.90.21 | Server state management |
| React Router DOM | v7 | Client-side routing |
| TypeScript | — | Type safety |
| Tailwind CSS | ^4.1.14 | Utility CSS (נכלל; לא בשימוש ראשי) |

**תלויות ייחודיות:**

```json
"dependencies": {
  "@emotion/cache": "...",
  "stylis-plugin-rtl": "...",
  "@mui/material": "...",
  "@mui/icons-material": "...",
  "react-router-dom": "..."
}
```

---

## 3. מבנה הקבצים

```
app-dev/
├── docker-entrypoint.sh            # Token refresh loop + nginx startup
├── nginx.conf.template             # Nginx config עם placeholder ${API_BACKEND_URL}
├── Dockerfile                      # Multi-stage build
├── pnpm-workspace.yaml             # Monorepo: packages = app + lib/*
├── app/
│   ├── index.html                  # <html lang="he" dir="rtl"> — RTL שכבה ראשונה
│   ├── vite.config.ts              # Vite config + dev proxy
│   ├── tsconfig.json               # מפנה ל-lib/api-client-react כ-project reference
│   └── src/
│       ├── main.tsx                # createRoot → <App />
│       ├── App.tsx                 # Provider stack + Router + Routes
│       ├── theme.ts                # MUI theme (direction: 'rtl', Heebo, Google palette)
│       ├── assets/index.css        # גופנים גלובאליים + direction: rtl
│       ├── pages/
│       │   ├── CatalogPage.tsx     # עמוד ראשי — grid datasets
│       │   ├── DatasetPage.tsx     # עמוד dataset — טבלאות + ForceGraph
│       │   └── TableProfilePage.tsx # עמוד פרופיל עמודות
│       ├── components/
│       │   ├── Layout.tsx          # עטיפה מבנית (שומר RefreshContext חי)
│       │   ├── DatasetCard.tsx     # כרטיסיית dataset בגריד
│       │   ├── StatsBar.tsx        # שורת סטטיסטיקות
│       │   ├── PipelineStatusDrawer.tsx # מגירת סטטוס pipelines
│       │   ├── profile/
│       │   │   ├── ColumnCard.tsx       # כרטיסיית עמודה בפרופיל
│       │   │   ├── MetricBar.tsx        # Progress bar RTL-aware
│       │   │   ├── StatsPanel.tsx       # סטטיסטיקות לפי data_type
│       │   │   ├── TopValuesPanel.tsx   # Bar chart ערכים קטגוריאליים
│       │   │   ├── ProfileHeader.tsx    # כותרת עמוד פרופיל
│       │   │   └── profileTokens.ts     # Design tokens + semantic color
│       │   └── ui/                 # shadcn/ui components (40+ רכיבים — לא בשימוש ראשי)
│       ├── contexts/
│       │   └── RefreshContext.tsx  # Context לרענון גלובאלי
│       ├── services/
│       │   ├── profileService.ts   # fetch לפרופיל עמודות
│       │   └── pipelineService.ts  # fetch לסטטוס pipelines
│       ├── types/
│       │   └── profile.ts          # TypeScript interfaces לפיצ'ר Profile
│       ├── hooks/
│       │   ├── use-mobile.tsx      # useIsMobile — breakpoint 768px
│       │   └── use-toast.ts        # Toast state machine (shadcn pattern)
│       └── lib/
│           └── utils.ts            # cn() = clsx + twMerge
└── lib/
    └── api-client-react/
        ├── package.json            # name: @workspace/api-client-react
        ├── src/
        │   ├── index.ts            # re-exports generated + setBaseUrl/setAuthTokenGetter
        │   ├── custom-fetch.ts     # Fetch wrapper עם base URL + auth token support
        │   └── generated/
        │       ├── api.ts          # React Query hooks (נוצר ע"י Orval)
        │       └── api.schemas.ts  # TypeScript types (נוצר ע"י Orval)
        └── tsconfig.json
```

---

## 4. RTL ו-Hebrew — ארבע שכבות

RTL מוגדר ב**ארבע** שכבות עצמאיות ומשלימות:

### שכבה 1 — HTML Root (`index.html`)

```html
<html lang="he" dir="rtl">
```

הדפדפן עצמו מקבל הוראה ש-direction של כל הדף הוא RTL. גופנים נטענים כאן:

```html
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### שכבה 2 — CSS גלובאלי (`index.css`)

```css
html, body, #root {
  direction: rtl;
}
body {
  font-family: 'Heebo', sans-serif;
  background-color: #f8f9fa;
}
```

גופן ראשי: **Heebo** (עברי). גופן משני ל-identifiers: **Roboto Mono**.

### שכבה 3 — MUI Emotion RTL Cache (`App.tsx`)

```tsx
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";

const cacheRtl = createCache({
  key: "muirtl",
  stylisPlugins: [rtlPlugin],
});
```

`stylis-plugin-rtl` ממיר CSS שנוצר על-ידי MUI אוטומטית: `margin-right` → `margin-left`, `float: left` → `float: right`, `padding-right` → `padding-left` וכו'. מבטיח שכל רכיבי MUI מתנהגים נכון ב-RTL ללא override ידני.

### שכבה 4 — MUI Theme Direction (`theme.ts`)

```typescript
export const theme = createTheme({
  direction: 'rtl',
  ...
});
```

הודעה ל-MUI component system עצמו לחשב layout ב-RTL (למשל: `Drawer` נפתח מימין, `Badge` מוצב בפינה הנכונה).

---

## 5. MUI Theme

```typescript
export const theme = createTheme({
  direction: 'rtl',
  typography: {
    fontFamily: '"Heebo", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    // h1–h6: fontWeight: 600
  },
  palette: {
    primary:    { main: '#1a73e8' },   // Google Blue
    background: { default: '#f8f9fa', paper: '#ffffff' },
    text:       { primary: '#202124', secondary: '#5f6368' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px rgba(60,64,67,0.15)',
          '&:hover': { boxShadow: '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px rgba(60,64,67,0.15)' },
        },
      },
    },
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none' } },
    },
  },
});
```

עיצוב בהשראת **Google Material Design** — palette, shadow ו-typography תואמים ל-Google Workspace.

---

## 6. Provider Stack — סדר העטיפה ב-`App.tsx`

```tsx
function App() {
  return (
    <QueryClientProvider client={queryClient}>     {/* 1. React Query */}
      <CacheProvider value={cacheRtl}>             {/* 2. Emotion RTL cache */}
        <ThemeProvider theme={theme}>              {/* 3. MUI Theme */}
          <CssBaseline />                          {/* 4. CSS reset */}
          <BrowserRouter>                          {/* 5. Router */}
            <RefreshProvider>                      {/* 6. Refresh context */}
              <AppRoutes />                        {/* 7. Routes */}
            </RefreshProvider>
          </BrowserRouter>
        </ThemeProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}
```

**סדר חשוב:** `CacheProvider` חייב להיות בתוך `QueryClientProvider` (כי `QueryClientProvider` לא ניגע ב-CSS) ומחוץ ל-`ThemeProvider` (כי ה-theme צריך את ה-cache כבר מוכן). `RefreshProvider` בתוך `BrowserRouter` כדי שיוכל לקרוא `useNavigate` אם יצטרך בעתיד.

**הערה על גרסאות:** ב-`App.tsx` קיים comment של config ישן עם `staleTime: 5 min`. ה-config הפעיל הוא `staleTime: 24h`.

---

## 7. React Query — ניהול מצב שרת

### הגדרת ה-QueryClient

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            1000 * 60 * 60 * 24, // 24 שעות
      gcTime:               1000 * 60 * 60 * 24, // 24 שעות
      refetchOnWindowFocus: false,
      refetchOnMount:       false,
      retry:                1,
    },
  },
});
```

**`staleTime: 24h`** — נתונים לא נחשבים ל-stale למשך 24 שעות. כל עוד הנתונים "טריים", React Query לא ישלח בקשה חדשה לשרת. זוהי **החלטה מכוונת** להפחית עומס על GCP API, שכן נתוני BigQuery אינם משתנים לעיתים קרובות.

**`refetchOnMount: false`** — קומפוננטה שנטענת מחדש לא תבקש נתונים אוטומטית אם יש cache קיים.

### מי משתמש ב-Generated Hooks ומי ב-Fetch ישיר

| נתונים | אופן שליפה | סיבה |
|---|---|---|
| Datasets list | `useListDatasets()` hook (generated) | חלק מה-OpenAPI spec |
| Catalog stats | `useGetCatalogStats()` hook (generated) | חלק מה-OpenAPI spec |
| Locations | `useGetLocations()` hook (generated) | חלק מה-OpenAPI spec |
| Tables list | `useQuery` + `fetch()` ישיר (מקומי ב-DatasetPage) | אינו בspec |
| Relationships | `useQuery` + `fetch()` ישיר (מקומי ב-DatasetPage) | אינו בspec |
| Table Profile | `useQuery` + `fetchTableProfile()` service | אינו בspec |
| Pipeline Status | `useQuery` + `fetchPipelineStatuses()` service | אינו בspec |

### Query Keys של ה-Generated Client

```typescript
getListDatasetsQueryKey(params?)   // → ['/api/datasets', params?]
getGetDatasetQueryKey(datasetId)   // → ['/api/datasets/{id}']
getGetCatalogStatsQueryKey()       // → ['/api/catalog/stats']
getListLocationsQueryKey()         // → ['/api/catalog/locations']
```

---

## 8. ניתוב (Routing)

```tsx
<Routes>
  <Route path="/"                                             element={<CatalogPage />} />
  <Route path="/dataset/:dataset_id"                          element={<DatasetPage />} />
  <Route path="/datasets/:datasetId/tables/:tableId/profile"  element={<TableProfilePage />} />
  <Route path="*"                                             element={<div>404 — עמוד לא נמצא</div>} />
</Routes>
```

**אי-עקביות בפרמטרים:** CatalogPage → DatasetPage משתמש ב-`/dataset/:dataset_id` (singular, underscore). DatasetPage → TableProfilePage משתמש ב-`/datasets/:datasetId/tables/:tableId` (plural, camelCase). שתי הצורות תקינות פונקציונלית אך **אינן עקביות**.

---

## 9. עמודים (Pages)

### `CatalogPage.tsx` — עמוד ראשי

**Data fetching:**

```tsx
// Generated hooks
const { data, isLoading, isError, refetch } = useListDatasets(queryParams, {
  query: { queryKey: getListDatasetsQueryKey(queryParams) }
});
const { data: statsData } = useGetCatalogStats({
  query: { queryKey: getGetCatalogStatsQueryKey() }
});

// Pre-fetch pipeline statuses לbadge
const { data: pipelineData } = useQuery({
  queryKey: PIPELINE_STATUS_QUERY_KEY,
  queryFn: () => fetchPipelineStatuses(false),
});
```

**מיון אוטומטי:** `sort_dir` נגזר אוטומטית — `tables_count` → `desc`, `name` → `asc`.

```tsx
const queryParams = {
  search: search || undefined,
  sort_by: sortBy,
  sort_dir: (sortBy === 'tables_count' ? 'desc' : 'asc') as 'asc' | 'desc'
};
```

**Badge על Pipeline button:**

```tsx
const failedCount = pipelineData?.pipelines.filter(
  (p) =>
    p.current_status?.toUpperCase() === 'FAILED' ||
    p.current_status?.toUpperCase() === 'FAILURE',
).length ?? 0;
```

Badge מוצג רק אם `failedCount > 0`. צבע הכפתור עצמו משתנה ל-`error` (אדום) אם יש כשלים.

**Chip של Project ID** ב-AppBar: `statsData?.project_id` מוצג רק כאשר הנתונים נטענו.

**Hard Refresh Flow — `queryClient.clear()`:**

```tsx
registerHardRefresh(async () => {
  // 1. שלח ?refresh=true לכל ה-endpoints במקביל — עוקף backend cache
  await Promise.allSettled([
    fetch(`/api/datasets?refresh=true`),
    fetch(`/api/catalog/stats?refresh=true`),
    fetch(`/api/pipelines/status?refresh=true`),
  ]);
  // 2. מחיקה מוחלטת של כל ה-React Query cache
  queryClient.clear();
});
```

**למה `queryClient.clear()` ולא `invalidateQueries`?** הערה בקוד מסבירה: כדי להימנע מ"ניחוש" של מבנה ה-query key שנוצר אוטומטית על-ידי Orval (שכולל את ה-params כחלק מה-key). `clear()` מוחק הכל בלי צורך לדעת את הkey המדויק.

**Empty State:** מוצגת תיבה דקורטיבית עם אייקון `<Search />` והודעה "נסה לשנות את מילות החיפוש".

**Loading Skeleton:** 8 `Skeleton` cards ב-Grid.

---

### `DatasetPage.tsx` — עמוד Dataset

**Fetchers מקומיים** (מוגדרים בתוך הקובץ, לא ב-services/):

```typescript
async function fetchTables(datasetId: string, refresh = false): Promise<TableDetail[]> {
  const url = `/api/datasets/${datasetId}/tables${refresh ? '?refresh=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('שגיאה בטעינת טבלאות');
  return (await res.json()).tables ?? [];
}

async function fetchRelationships(datasetId: string, refresh = false): Promise<Relationship[]> {
  const url = `/api/datasets/${datasetId}/relationships?min_confidence=0.5${refresh ? '&refresh=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) return [];  // ← שגיאה מחזירה מערך ריק (silent)
  return (await res.json()).relationships ?? [];
}
```

**שים לב:** `fetchRelationships` שולח `min_confidence=0.5` hardcoded ומחזיר `[]` ב-error במקום להזרוק חריגה.

**TypeScript interfaces מקומיים** ב-`DatasetPage.tsx`:
- `TableDetail`: `table_id`, `table_type`, `row_count`, `size_bytes`, `is_financial`, `financial_columns`, `is_geographical`, `geographical_columns`, `is_sensitive`, `sensitive_columns`, `project_name`, `system_name`, `project_manager`, `characterization_link`
- `Relationship`: `edge_id`, `source_dataset`, `source_table`, `target_dataset`, `target_table`, `relationship_type`, `confidence_score`, `description_edge`

**Helpers:**
```typescript
function formatBytes(bytes: number): string  // B/KB/MB/GB
function confidenceColor(score: number): string  // ≥0.8: ירוק | ≥0.5: צהוב | <0.5: אדום
```

**Tabs:**
- טאב 1 — **רשימת טבלאות**: `TableRow` עם `TableIcons` (אייקוני סיווג)
- טאב 2 — **גרף קשרים**: `ForceGraph` + טבלת summary

**`TableIcons` component — אייקוני סיווג עם Tooltip מורכב:**

```tsx
function TableIcons({ table }: { table: TableDetail }) {
  return (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {table.is_financial && (
        <Tooltip title={<Box>...<strong>עמודות:</strong> {table.financial_columns}<br/></Box>}>
          <AttachMoney sx={{ fontSize: 18, color: '#1e8e3e' }} />
        </Tooltip>
      )}
      {table.is_geographical && (
        <Tooltip title={...}><LocationOn sx={{ color: '#1a73e8' }} /></Tooltip>
      )}
      {table.is_sensitive && (
        <Tooltip title={...}><Security sx={{ color: '#d93025' }} /></Tooltip>
      )}
    </Box>
  );
}
```

צבעי אייקונים: ירוק=פיננסי, כחול=גאוגרפי, אדום=רגיש.

**`ForceGraph` component — SVG force-directed פנימי:**

גרף קשרים ממומש כ-SVG פנימי עם force simulation ב-`useEffect` + `requestAnimationFrame`. אין תלות ב-`d3` או library חיצונית אחרת. צמתים = טבלאות, קשתות = קשרים. הקשתות מקבלות צבע מ-`confidenceColor(confidence_score)`. צמתי dataset פנימיים מוצגים עם circle מלא; חיצוניים עם circle עם stroke.

**Hard Refresh:**

```tsx
registerHardRefresh(async () => {
  await Promise.allSettled([
    fetch(`/api/datasets/${datasetId}/tables?refresh=true`),
    fetch(`/api/datasets/${datasetId}/relationships?min_confidence=0.5&refresh=true`),
  ]);
  queryClient.clear();
});
```

---

### `TableProfilePage.tsx` — עמוד פרופיל עמודות

**Data fetching:**

```tsx
const queryKey = ['tableProfile', datasetId, tableId];
useQuery({
  queryKey,
  queryFn: () => fetchTableProfile(datasetId!, tableId!),
  enabled: Boolean(datasetId && tableId),
});
```

**Hard Refresh — `removeQueries` + `fetchQuery`:**

```tsx
registerHardRefresh(async () => {
  queryClient.removeQueries({ queryKey });  // מחיקה מוחלטת (לא invalidate)
  await queryClient.fetchQuery({
    queryKey,
    queryFn: () => fetchTableProfile(datasetId!, tableId!, true), // ?refresh=true
  });
});
```

**למה `removeQueries` ולא `invalidateQueries`?** `invalidateQueries` מסמן כ-stale אבל React Query לא יטריג refetch אם ה-`staleTime` גדול. `removeQueries` מוחק לחלוטין מה-cache, מה שמכריח fetch בקריאה הבאה.

**Error State:** מציג הודעה "ודא שתהליך פרופיל הנתונים הסתיים בהצלחה ב-GCP" — מרמז על תלות ב-DataScan.

**Layout:**
```
AppBar (חזרה + כותרת monospace + כפתור Refresh)
└── Container (dir="rtl")
    ├── ProfileHeader (שם טבלה, עמודות, שורות שנסרקו)
    └── [ColumnCard, ColumnCard, ...]
```

---

## 10. רכיבים (Components)

### `DatasetCard.tsx`

כרטיסיית dataset עם:
- `borderRight: 4px solid transparent` → `primary.main` ב-hover (אפקט accent)
- `translateY(-2px)` + box-shadow על hover
- שם dataset: `dir="ltr"` + monospace (מזהים תמיד LTR)
- לחיצה → ניווט, אייקון `InfoOutlined` → Dialog עם תיאור מלא (`stopPropagation`)
- `dataset.last_modified || dataset.created_at` עם label "עודכן"/"נוצר" בהתאם

**שדה `last_modified`:** `DatasetCard` מקבל `dataset: Dataset & { last_modified?: string | null }` — הרחבה של ה-generated `Dataset` type שלא כולל את השדה הזה ב-OpenAPI spec.

---

### `StatsBar.tsx`

```tsx
const { data: statsData, isLoading } = useGetCatalogStats();
```

ארבע כרטיסיות:
- **מאגרי נתונים** (`total_datasets`)
- **טבלאות** (`total_tables`)
- **אזורים** (`locations_count`)
- **עדכון אחרון** (`last_updated` — פורמט עברי)

בזמן טעינה: `<Skeleton>` לכל ערך.

---

### `PipelineStatusDrawer.tsx`

**Query Key (מיוצא):**

```tsx
export const PIPELINE_STATUS_QUERY_KEY = ['pipelines', 'status'] as const;
```

מיוצא ממודול זה כדי ש-`CatalogPage` יוכל לבצע pre-fetch ולחשב את מספר ה-failures לbadge.

**Status Styling — `getStatusStyle()`:**

| Status | צבע | אייקון |
|---|---|---|
| `SUCCESS` / `SUCCEEDED` | `#1e8e3e` ירוק | `CheckCircle` |
| `FAILED` / `FAILURE` | `#d93025` אדום | `Error` |
| `RUNNING` / `IN_PROGRESS` | `#1a73e8` כחול | `Sync` |
| `PENDING` / `WAITING` | `#fdd663` צהוב | `HourglassEmpty` |
| אחר | `#5f6368` אפור | `FiberManualRecord` |

**Grouping:** pipelines מקובצים לפי `environment` עם `EnvironmentSection` לכל קבוצה.

**Snackbar שגיאה:** על כשל ברענון — `Snackbar` עם Alert "שגיאה בביצוע הרענון".

---

### `MetricBar.tsx` — RTL CSS Logical Properties

```tsx
<Box
  sx={{
    position: 'absolute',
    insetInlineEnd: 0,    // ← CSS logical property: right ב-LTR, left ב-RTL
    top: 0,
    height: '100%',
    width: `${Math.min(Math.max(value, 0), 100)}%`,
    bgcolor: color,
    transition: 'width 0.3s ease-in-out',
  }}
/>
```

`insetInlineEnd` עוגן את הbar-fill לצד ה-RTL start (ימין בעברית). ללא זה, ה-fill היה גדל מצד שמאל.

---

### `Layout.tsx`

```tsx
export default function Layout({ children }: LayoutProps) {
  useRefresh(); // שומר את הContext חי ברמה זו
  return <Box sx={{ minHeight: '100vh' }}>{children}</Box>;
}
```

כפתור הרענון **מרונדר בתוך כל עמוד בנפרד** בה-AppBar — לא כאן. `Layout` הוא עטיפה מבנית בלבד.

---

## 11. RefreshContext — מנגנון הרענון הגלובאלי

### הבעיה

כפתור הרענון חי ב-AppBar של כל עמוד. כל עמוד יודע בעצמו אילו query keys לרענן ועם אילו פרמטרים. הכפתור עצמו לא יכול "לדעת" על לוגיקת ה-invalidation הספציפית לעמוד.

### הפתרון — Ref-based Handler Pattern

```tsx
const handlerRef = useRef<(() => Promise<void>) | null>(null);

const registerHardRefresh = useCallback((fn: () => Promise<void>) => {
  handlerRef.current = fn;
}, []);

const triggerHardRefresh = useCallback(async () => {
  if (!handlerRef.current || isRefreshing) return;
  setIsRefreshing(true);
  try {
    await handlerRef.current();
  } finally {
    setIsRefreshing(false);
  }
}, [isRefreshing]);
```

- **`registerHardRefresh(fn)`** — נקרא על-ידי כל עמוד ב-`useEffect` בטעינה
- **`triggerHardRefresh()`** — נקרא על-ידי כפתור הרענון בכל עמוד
- **`isRefreshing`** — boolean ל-spinner ול-disable על הכפתור

### שימוש בעמוד

```tsx
const { registerHardRefresh, triggerHardRefresh, isRefreshing } = useRefresh();

useEffect(() => {
  registerHardRefresh(async () => {
    // לוגיקה ספציפית לעמוד זה
    await Promise.allSettled([fetch('/api/...?refresh=true')]);
    queryClient.clear();
  });
}, [registerHardRefresh, queryClient]);
```

---

## 12. שכבת ה-Services

שני ה-services הם plain fetch wrappers בלא תלות ב-React Query. הם מזרקים ל-React Query דרך `queryFn`.

### `profileService.ts`

```typescript
export async function fetchTableProfile(
  datasetId: string,
  tableId: string,
  refresh = false,
): Promise<ProfileResponse> {
  const url = `/api/datasets/${datasetId}/tables/${tableId}/profile${refresh ? '?refresh=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('שגיאה בשליפת פרופיל הנתונים');
  return response.json();
}
```

### `pipelineService.ts`

```typescript
export interface PipelineStatus {
  pipeline_name: string | null;
  environment:   string | null;
  as_of_date:    string | null;  // ISO datetime string
  current_status: string | null;
}

export async function fetchPipelineStatuses(refresh = false): Promise<PipelineStatusResponse> {
  const url = `/api/pipelines/status${refresh ? '?refresh=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('שגיאה בשליפת סטטוס התהליכים');
  return response.json();
}
```

**למה לא generated hooks?** endpoints אלו אינם ב-OpenAPI spec ואין להם generated code.

---

## 13. Generated API Client (`lib/api-client-react`)

### מבנה החבילה

```
lib/api-client-react/
├── package.json           # name: "@workspace/api-client-react"
├── src/
│   ├── index.ts           # Public API: exports generated + setBaseUrl + setAuthTokenGetter
│   ├── custom-fetch.ts    # Fetch wrapper
│   └── generated/
│       ├── api.schemas.ts # TypeScript types (Orval v8.9.1)
│       └── api.ts         # React Query hooks (Orval v8.9.1)
```

### `custom-fetch.ts` — Fetch Wrapper

`customFetch` הוא wrapper על `window.fetch` עם יכולות נוספות:

```typescript
// הגדרות ברמת ה-module
let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void { ... }
export function setAuthTokenGetter(getter: AuthTokenGetter | null): void { ... }
```

**ב-web app** — שני הפונקציות לא נקראות. Base URL הוא `/` (יחסי), ואין צורך ב-auth token (session cookies עובדים אוטומטית).

**בנוסף:** `setAuthTokenGetter` מיועד לשימוש Expo/mobile שצריך Bearer token מפורש. ה-`index.ts` מייצא אותם לשימוש עתידי.

**`ApiError` class** — exception מובנה:

```typescript
class ApiError<T = unknown> extends Error {
  status: number;
  data: T;
  requestInfo: { method: string; url: string };
}
```

**Content-type auto-detection:** `customFetch` מזהה אוטומטית אם ה-body הוא JSON לפי `looksLikeJson()` ומוסיף `Content-Type: application/json`.

**Response parsing:** לפי `Content-Type` של ה-response — JSON, text, או blob. Status 204/205/304 מחזירים `undefined`.

### `api.schemas.ts` — Generated Types

```typescript
export interface Dataset {
  dataset_id: string;
  description?: string | null;
  description_he?: string | null;
  location: string;
  tables_count: number;
  created_at: string;
  // הערה: last_modified אינו בspec! DatasetCard מוסיף אותו ידנית
}

export interface CatalogStats {
  total_datasets: number;
  total_tables: number;
  locations_count: number;
  project_id: string;
  last_updated?: string | null;
}

export type ListDatasetsSortBy = 'name' | 'tables_count';
export type ListDatasetsSortDir = 'asc' | 'desc';
```

### Hooks זמינים

```typescript
useListDatasets(params?, options?)       // GET /api/datasets
useGetDataset(datasetId, options?)       // GET /api/datasets/{id}
useGetCatalogStats(options?)             // GET /api/catalog/stats
useListLocations(options?)               // GET /api/catalog/locations

// QueryKey helpers
getListDatasetsQueryKey(params?)
getGetDatasetQueryKey(datasetId)
getGetCatalogStatsQueryKey()
getListLocationsQueryKey()
```

### Import

```typescript
import {
  useListDatasets,
  getListDatasetsQueryKey,
  setBaseUrl,
} from '@workspace/api-client-react';
```

**לא** לייבא מנתיב יחסי.

### עדכון ה-Generated Code

```bash
# לאחר שינוי ב-OpenAPI spec ב-api-dev:
pnpm --filter @workspace/api-spec run codegen
# → מעדכן lib/api-client-react/src/generated/
```

---

## 14. Profile Feature — תת-מערכת עצמאית

### `types/profile.ts`

```typescript
export interface ProfileResponse {
  table_id: string;
  scanned_rows?: number;
  columns: ColumnProfile[];
}

export interface ColumnProfile {
  column_name: string;
  data_type: string;      // "NUMERIC" | "STRING" | "DATETIME" | "ARRAY" | "BOOLEAN" | "UNKNOWN"
  nullness: number;       // 0.0–1.0 (0.0 = אין ערכים חסרים)
  uniqueness: number;     // 0.0–1.0 (1.0 = כל הערכים ייחודיים)
  top_n: TopNValue[];
  numeric_stats?: NumericStats;
  string_stats?: StringStats;
  datetime_stats?: DatetimeStats;
}
```

### `profileTokens.ts` — Design Tokens + Semantic Color

```typescript
export function getNullnessTone(nullness: number) {
  if (nullness < 0.05) return { main: '#1e8e3e', label: 'תקין' };   // ירוק
  if (nullness < 0.20) return { main: '#f9ab00', label: 'שים לב' }; // צהוב
  return                       { main: '#d93025', label: 'קריטי' };  // אדום
}
```

**Semantic Color:** צבע accent של `ColumnCard` = `getNullnessTone(nullness).main` — נותן איתות ויזואלי מיידי על איכות הנתונים.

### `StatsPanel.tsx` — לפי `data_type`

| `data_type` | Stats שמוצגות |
|---|---|
| `NUMERIC` | ממוצע, סטיית תקן, min, Q1, median, Q3, max |
| `STRING` | אורך ממוצע, אורך מינימלי/מקסימלי |
| `DATETIME` | תאריך מוקדם/מאוחר, פורמט |
| אחר | "אין סטטיסטיקות נוספות" |

### `TopValuesPanel.tsx` — Relative Bar Chart

```typescript
const top = values.slice(0, 6);
const maxPct = Math.max(...top.map(v => v.percentage ?? 0));
// width = (value.percentage / maxPct) * 100 + '%'  ← יחסי לmax, לא ל-100%
```

---

## 15. `docker-entrypoint.sh` — Token Refresh Loop

ה-entrypoint הוא Script מורכב עם לולאת רענון Token רצה ברקע:

### Flow הפעלה

```
1. בדיקת API_BACKEND_URL (יציאה עם שגיאה אם חסר)
2. יצירת קובץ token ריק: /tmp/auth_token.conf
3. עיבוד nginx.conf.template → /etc/nginx/conf.d/default.conf (envsubst)
4. בדיקת syntax של nginx config (nginx -t)
5. הפעלת refresh_loop ברקע (&)
6. הפעלת nginx בfirst-plane (exec nginx -g 'daemon off;')
```

### `refresh_loop` — רענון Token כל 45 דקות

```sh
refresh_loop() {
  while true; do
    TOKEN=$(curl -sf -H "Metadata-Flavor: Google" \
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${API_BACKEND_URL}")
    if [ -n "$TOKEN" ]; then
      printf 'set $api_id_token "%s";\n' "$TOKEN" > /tmp/auth_token.conf.tmp
      mv /tmp/auth_token.conf.tmp /tmp/auth_token.conf   # ← atomic write
      nginx -s reload
      sleep 2700   # 45 דקות
    else
      sleep 5      # retry מהיר אם ה-fetch נכשל
    fi
  done
}
```

**GCP Identity Token:** נשלף מ-GCP Metadata Server. `audience` = ה-URL של ה-API backend ב-Cloud Run. Token זה מוחדר לכל בקשת `/api/*` ב-`Authorization: Bearer` header.

**Atomic Write:** כתיבה ל-`.tmp` ואז `mv` — מונע מצב שבו nginx קורא קובץ חלקי תוך כדי כתיבה.

**nginx reload:** לאחר כל רענון token מבוצע `nginx -s reload` כדי ש-nginx יטען את קובץ ה-token החדש.

**Token TTL:** Identity Tokens של GCP תקפים כשעה, לכן רענון כל 45 דקות (2700 שניות) עם מרווח בטחון.

---

## 16. Nginx ו-Cloud Run

### `nginx.conf.template`

```nginx
# Static SPA
location / {
    try_files $uri $uri/ /index.html;
}

# API Proxy → Cloud Run backend
location /api/ {
    proxy_pass          ${API_BACKEND_URL};
    proxy_set_header    Authorization "Bearer $api_id_token";  # מוזרק מ-token file
    proxy_read_timeout  60s;
}

# Static asset caching (Vite file hashing)
location ~* \.(js|css|png|jpg|...)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Cloud Run health check
location /healthz {
    access_log off;
    return 200 "ok\n";
}
```

**`${API_BACKEND_URL}`** — מוחלף ב-startup על-ידי `docker-entrypoint.sh` עם `envsubst`.

**`$api_id_token`** — משתנה nginx שנטען מקובץ `/tmp/auth_token.conf` (מופק ע"י ה-refresh loop).

**SPA fallback:** `try_files $uri $uri/ /index.html` — כל route שאינו קובץ סטטי מקבל את `index.html`. מאפשר ל-React Router לעבוד.

**Static asset caching:** Vite מבצע content hashing לשמות קבצים (`main.abc123.js`). לכן ניתן לשים cache ל-1 שנה בבטחה.

---

## 17. Monorepo — מבנה ה-pnpm workspace

```yaml
# pnpm-workspace.yaml
packages:
  - "app"
  - "lib/*"

minimumReleaseAge: 1440  # supply-chain defense: packages ≥1440 דקות (יום אחד) ישנים

catalog:
  react: 19.1.0
  '@tanstack/react-query': ^5.90.21
  vite: ^7.3.2
  # ... כל הגרסאות המשותפות
```

**`minimumReleaseAge: 1440`** — pnpm לא יתקין packages שפורסמו לפני פחות מיום. הגנה מפני supply-chain attacks שבהם גרסה זדונית מפורסמת ונשלפת מיד.

**`catalog:`** — גרסאות משותפות. Package.json בודד מציין `"@tanstack/react-query": "catalog:"` — הגרסה נלקחת מה-catalog. מבטיח עקביות גרסאות בין `app` ל-`lib/api-client-react`.

**TypeScript Project References:**
```json
// app/tsconfig.json
"references": [{ "path": "../lib/api-client-react" }]
```

מאפשר ל-TypeScript לבנות את `lib/api-client-react` בנפרד ולהשתמש ב-type information שלו ב-`app` בלי bundle.

---

## 18. Build ו-Dev

### `vite.config.ts`

```typescript
export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
    dedupe: ["react", "react-dom"],   // ← מונע duplicate React instances
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
  },
  server: {
    port: 5000,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: { "/api": "http://localhost:8000" },  // dev proxy → API מקומי
  },
});
```

**`dedupe: ["react", "react-dom"]`** — מונע duplicate React instances כאשר `@workspace/api-client-react` מייבא React. ללא זה, hooks עלולים לכשול עם "hooks can only be called inside a function component".

**`strictPort: true`** — אם port 5000 תפוס, Vite ייכשל במקום לעבור לport אחר.

**Dev Proxy:** `"/api" → "http://localhost:8000"` — בסביבת dev, `/api/*` מנותב ל-API שרץ מקומית. ב-production, Nginx מטפל בניתוב זה.

### פקודות

```bash
# פיתוח מקומי
pnpm --filter @workspace/data-catalog run dev

# בניית production
pnpm --filter @workspace/data-catalog run build
# → dist/public/

# typecheck בלי emit
pnpm --filter @workspace/data-catalog run typecheck
```

---

## 19. דגשים חשובים למתחזק

### 19.1 `last_modified` לא ב-OpenAPI Spec

`DatasetCard` מקבל `Dataset & { last_modified?: string | null }`. השדה `last_modified` **אינו** ב-OpenAPI spec ולכן לא ב-generated types. ה-API מחזיר אותו, אך אם תרצה להוסיפו ל-spec עליך לשנות גם את ה-`api.schemas.ts` Generated type.

### 19.2 `fetchTables` ו-`fetchRelationships` מוגדרים בתוך `DatasetPage.tsx`

לא ב-`services/` — בניגוד ל-`profileService.ts` ו-`pipelineService.ts`. אם הם יצטרכו שימוש ב-component נוסף, יש להעבירם ל-`services/`.

### 19.3 `fetchRelationships` — שגיאה שקטה

מחזיר `[]` על HTTP error במקום להזרוק. אם ה-relationships endpoint נכשל, הגרף יוצג ריק ללא הודעת שגיאה למשתמש.

### 19.4 `ForceGraph` — לא Library חיצונית

מימוש SVG פנימי עם force simulation. אין `d3`. שינוי ה-layout מצריך הבנת הקוד הפנימי.

### 19.5 RTL — תמיד `dir="ltr"` על מזהים טכניים

שמות עמודות, dataset_ids, table_ids — מוצגים עם `dir="ltr"` מפורש גם ב-app RTL. ללא זה מחרוזות עם underscores/dots יתהפכו.

### 19.6 `queryClient.clear()` ב-CatalogPage

Hard refresh ב-`CatalogPage` קורא ל-`queryClient.clear()` — **מוחק את כל ה-cache**, לא רק את ה-datasets. זה מכוון (ראה הערה בקוד) אבל יגרום לרענון של כל הנתונים בכל ה-עמודים בפתיחה הבאה.

### 19.7 `minimumReleaseAge: 1440` ב-pnpm-workspace

הגדרת אבטחה. אם pnpm מסרב להתקין package חדש, בדוק אם הוא פורסם לאחרונה — המתן לפני התקנה.

### 19.8 Token Refresh — תלות ב-GCP Metadata Server

ה-`docker-entrypoint.sh` תלוי ב-`http://metadata.google.internal` לשליפת Identity Token. **בסביבת dev מקומית** (ללא GCP) ה-token fetch ייכשל אבל ה-script ממשיך עם token ריק. ה-nginx proxy במקרה כזה לא יוסיף Authorization header — מה שמסביר מדוע **dev מקומי** עובד עם API ישיר (port 5000 → proxy → 8000).

### 19.9 shadcn/ui Components — נכללים אך לא בשימוש ראשי

`components/ui/` מכיל 40+ רכיבים מ-shadcn/ui. כל ה-styling הפעיל נעשה דרך MUI `sx` prop. רכיבי shadcn נשמרים לפיתוח עתידי אם תרצה לשלב Tailwind-based components.
