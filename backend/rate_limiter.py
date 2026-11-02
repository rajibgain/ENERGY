"""Rate limiter supporting Redis backend with automatic in-memory fallback for dev/test,
and mandatory Redis enforcement in production mode.

Configured via environment variables:
  APP_ENV: (e.g. 'production', 'development', 'testing')
  REDIS_URL: (e.g. redis://localhost:6379/0)
"""
import logging
import os
import threading
import time
from typing import Dict, List

from fastapi import HTTPException

logger = logging.getLogger("syncspace.ratelimit")

APP_ENV = os.getenv("APP_ENV", "development").lower()
REDIS_URL = os.getenv("REDIS_URL", "").strip()
_redis_client = None


def init_redis_client(app_env: str = APP_ENV, redis_url: str = REDIS_URL):
    """Initializes and verifies the Redis client according to environment rules."""
    global _redis_client
    if app_env == "production":
        if not redis_url:
            raise RuntimeError(
                "REDIS_URL environment variable is mandatory in production mode (APP_ENV=production) "
                "for distributed multi-worker rate limiting."
            )
        try:
            import redis
            client = redis.Redis.from_url(redis_url, decode_responses=True)
            client.ping()
            _redis_client = client
            logger.info(f"Connected to production Redis rate limiter at {redis_url}")
            return client
        except Exception as exc:
            _redis_client = None
            raise RuntimeError(
                f"Failed to connect to mandatory production Redis instance at '{redis_url}': {exc}"
            ) from exc
    else:
        # Development / Testing: Optional Redis with graceful in-memory fallback
        if redis_url:
            try:
                import redis
                client = redis.Redis.from_url(redis_url, decode_responses=True)
                client.ping()
                _redis_client = client
                logger.info(f"Connected to Redis rate limiter at {redis_url}")
                return client
            except Exception as exc:
                logger.warning(f"Failed to connect to optional Redis ({exc}); falling back to in-memory rate limiting.")
                _redis_client = None
        else:
            _redis_client = None
    return None


# Initialize on import
try:
    init_redis_client()
except RuntimeError as err:
    # Only re-raise if explicitly running in production
    if APP_ENV == "production":
        raise


class RateLimiter:
    """Sliding-window rate limiter with Redis backend and thread-safe in-memory fallback."""

    def __init__(self, max_attempts: int, window_seconds: int, prefix: str = "rl"):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.prefix = prefix
        self._memory_store: Dict[str, List[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str, custom_error_message: str | None = None) -> None:
        """Checks rate limit for the given key. Raises HTTPException(429) if exceeded."""
        full_key = f"{self.prefix}:{key}"
        now = time.time()
        cutoff = now - self.window_seconds
        env = os.getenv("APP_ENV", APP_ENV).lower()

        if _redis_client is not None:
            try:
                pipe = _redis_client.pipeline()
                pipe.zremrangebyscore(full_key, 0, cutoff)
                pipe.zcard(full_key)
                pipe.zadd(full_key, {str(now): now})
                pipe.expire(full_key, self.window_seconds + 5)
                _, count, _, _ = pipe.execute()

                if count >= self.max_attempts:
                    msg = custom_error_message or f"Too many attempts. Wait {int(self.window_seconds / 60)} minutes and try again."
                    raise HTTPException(status_code=429, detail=msg)
                return
            except HTTPException:
                raise
            except Exception as exc:
                if env == "production":
                    logger.error(f"Production Redis rate limiter error: {exc}")
                    raise HTTPException(status_code=503, detail="Rate limiter service is currently unavailable.")
                logger.warning(f"Redis rate limit check failed ({exc}); falling back to memory check in dev/test.")

        # In production, do NOT fall back to in-memory store
        if env == "production":
            raise HTTPException(
                status_code=503,
                detail="Production environment requires an active Redis rate limiter connection."
            )

        # In-memory sliding window fallback for development & testing
        with self._lock:
            attempts = [ts for ts in self._memory_store.get(full_key, []) if ts >= cutoff]
            if len(attempts) >= self.max_attempts:
                msg = custom_error_message or f"Too many attempts. Wait {int(self.window_seconds / 60)} minutes and try again."
                raise HTTPException(status_code=429, detail=msg)
            attempts.append(now)
            self._memory_store[full_key] = attempts

    def clear(self, key: str) -> None:
        """Clears the rate limit count for a key upon successful action."""
        full_key = f"{self.prefix}:{key}"
        if _redis_client is not None:
            try:
                _redis_client.delete(full_key)
            except Exception as exc:
                logger.warning(f"Redis delete failed for {full_key}: {exc}")
        with self._lock:
            self._memory_store.pop(full_key, None)


# Default pre-configured limiters
login_limiter = RateLimiter(max_attempts=10, window_seconds=15 * 60, prefix="syncspace:auth:login")
advisor_limiter = RateLimiter(max_attempts=10, window_seconds=60, prefix="syncspace:advisor")

