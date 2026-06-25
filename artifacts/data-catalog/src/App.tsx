import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { theme } from "./theme";
import CatalogPage from "./pages/CatalogPage";
import DatasetPage from "./pages/DatasetPage";
import TableProfilePage from "./pages/TableProfilePage";

// Emotion cache wired up for RTL (stylis-plugin-rtl flips all physical
// CSS properties to their logical equivalents at the stylesheet level).
const cacheRtl = createCache({
  key: "muirtl",
  stylisPlugins: [rtlPlugin],
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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
            <AppRoutes />
          </BrowserRouter>
        </ThemeProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}

export default App;
