import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import rtlPlugin from "stylis-plugin-rtl";
import { theme } from "./theme";
import CatalogPage from "./pages/CatalogPage";
import DatasetPage from "./pages/DatasetPage";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={CatalogPage} />
      <Route path="/dataset/:dataset_id" component={DatasetPage} />
      <Route>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <h2>404 - עמוד לא נמצא</h2>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CacheProvider value={cacheRtl}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </ThemeProvider>
      </CacheProvider>
    </QueryClientProvider>
  );
}

export default App;