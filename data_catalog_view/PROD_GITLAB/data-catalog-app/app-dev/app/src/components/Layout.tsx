/**
 * Layout – wraps every page.
 * Renders the persistent global AppBar with a Refresh button that triggers
 * the current page's registered hard-refresh handler via RefreshContext.
 */

import { Box } from '@mui/material';
import { useRefresh } from '../contexts/RefreshContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // The Refresh button is rendered inside each page's own AppBar/Toolbar
  // (CatalogPage, DatasetPage, TableProfilePage) so the button stays
  // contextual.  Layout's job here is purely structural – it provides the
  // RefreshContext bridge.  Individual pages call useRefresh() to wire up.
  useRefresh(); // keep context alive at this level

  return <Box sx={{ minHeight: '100vh' }}>{children}</Box>;
}
