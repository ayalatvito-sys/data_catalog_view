/**
 * RefreshContext – lets pages register a "hard refresh" callback so the
 * global Layout toolbar button can trigger a full cache-bypass refresh for
 * whatever page is currently mounted.
 *
 * Usage in a page:
 *   const { registerHardRefresh } = useRefresh();
 *   useEffect(() => {
 *     registerHardRefresh(async () => { ... invalidate + fetch with ?refresh=true });
 *   }, [registerHardRefresh, ...deps]);
 */

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface RefreshContextValue {
  /** Pages call this on mount to register their hard-refresh handler. */
  registerHardRefresh: (fn: () => Promise<void>) => void;
  /** Called by the Layout Refresh button. */
  triggerHardRefresh: () => void;
  /** True while a hard refresh is in progress (for spinner etc.). */
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshContextValue>({
  registerHardRefresh: () => {},
  triggerHardRefresh: () => {},
  isRefreshing: false,
});

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const handlerRef = useRef<(() => Promise<void>) | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  return (
    <RefreshContext.Provider value={{ registerHardRefresh, triggerHardRefresh, isRefreshing }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  return useContext(RefreshContext);
}
