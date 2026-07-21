"""
Centralized in-memory TTL cache for GCP service calls.

Usage:
    from cache_utils import cached

    @cached(ttl=300)
    async def my_async_method(self, arg1, arg2, *, refresh: bool = False):
        ...  # actual GCP call

When `refresh=True` is passed the existing entry is discarded and the result
is re-fetched and stored afresh.
"""

import time
import functools
import logging
from typing import Any, Dict, Tuple

logger = logging.getLogger(__name__)

# Global store: cache_key -> (value, stored_at_timestamp)
_STORE: Dict[str, Tuple[Any, float]] = {}

DEFAULT_TTL: float = 300.0  # 5 minutes


# ─── Public helpers ───────────────────────────────────────────────────────────

def cached(ttl: float = DEFAULT_TTL):
    """
    Decorator for *async* service methods that caches the return value.

    The decorated function may declare a keyword-only `refresh: bool = False`
    parameter.  The decorator pops it before forwarding to the real function
    so callers can pass `refresh=True` without the underlying implementation
    needing to know about it.

    Cache key = "<qualname>:<positional-args>".
    The `self` argument (first positional) IS included in the key, but because
    Python service objects are typically singletons the key still collapses
    identically for every call with the same data arguments.
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            refresh: bool = kwargs.pop("refresh", False)

            # Build a stable string key from positional args
            # (skip `self` for readability but keep the class name via qualname)
            key = f"{func.__qualname__}:{args[1:]}"

            now = time.time()

            if not refresh:
                cached_entry = _STORE.get(key)
                if cached_entry is not None:
                    value, stored_at = cached_entry
                    if now - stored_at < ttl:
                        logger.debug("Cache HIT  %s", key)
                        return value
                    logger.debug("Cache STALE %s", key)
                else:
                    logger.debug("Cache MISS  %s", key)
            else:
                logger.info("Cache BYPASS (refresh=True) %s", key)

            result = await func(*args, **kwargs)
            _STORE[key] = (result, time.time())
            return result

        def invalidate(*args):
            """Remove a specific key from the cache."""
            key = f"{func.__qualname__}:{args}"
            _STORE.pop(key, None)

        wrapper.invalidate = invalidate  # type: ignore[attr-defined]
        return wrapper

    return decorator


def clear_all() -> None:
    """Wipe the entire cache (useful for testing or a global reset)."""
    _STORE.clear()
    logger.info("Cache cleared (all entries removed)")
