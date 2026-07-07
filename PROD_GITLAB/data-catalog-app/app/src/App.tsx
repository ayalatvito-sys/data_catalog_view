import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { theme } from "./theme";
import { RefreshProvider } from "./contexts/RefreshContext";
import CatalogPage from "./pages/CatalogPage";
import DatasetPage from "./pages/DatasetPage";
import TableProfilePage from "./pages/TableProfilePage";

// Emotion cache wired up for RTL
const cacheRtl = createCache({
  key: "muirtl",
  stylisPlugins: [rtlPlugin],
});

// const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       retry: 1,
//       refetchOnWindowFocus: false,
//       // Keep data fresh for 5 minutes — matches backend TTL
//       staleTime: 5 * 60 * 1000,
//     },
//   },
// });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // כמה זמן הנתונים נחשבים "טריים"? (24 שעות באלפיות שנייה)
      staleTime: 1000 * 60 * 60 * 24, 
      // כמה זמן לשמור אותם בזיכרון הפיזי גם אם לא מסתכלים עליהם? (24 שעות)
      gcTime: 1000 * 60 * 60 * 24, 
      // לא לרענן אוטומטית כשעוברים בין חלונות בדפדפן
      refetchOnWindowFocus: false,
      // לא לרענן אוטומטית בכל פעם שהקומפוננטה נטענת מחדש
      refetchOnMount: false,
      // לנסות שוב פעם אחת בלבד במקרה של שגיאה (במקום 3 פעמים כברירת מחדל)
      retry: 1,
    },
  },
});

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<CatalogPage />} />
      <Route path="/dataset/:dataset_id" element={<DatasetPage />} />
      <Route
        path="/datasets/:datasetId/tables/:tableId/profile"
        element={<TableProfilePage />}
      />
      <Route
        path="*"
        element={
          <div style={{ padding: 20, textAlign: "center" }}>
            <h2>404 - עמוד לא נמצא</h2>
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CacheProvider value={cacheRtl}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <RefreshProvider>
              <AppRoutes />
            </RefreshProvider>
          </BrowserRouter>
        </ThemeProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}

export default App;
