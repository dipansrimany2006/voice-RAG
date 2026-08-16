"""Small dependency-free retry decorator used across the harness."""

import functools
import time


def retry(attempts: int = 2, exceptions: tuple = (Exception,), backoff_s: float = 0.2):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as exc:  # noqa: BLE001 - intentionally broad, caller decides fallback
                    last_exc = exc
                    if attempt < attempts:
                        time.sleep(backoff_s * attempt)
            raise last_exc

        return wrapper

    return decorator
