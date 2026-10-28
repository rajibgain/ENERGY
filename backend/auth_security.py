import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session, joinedload

import models
from database import get_db


COOKIE_NAME = "syncspace_session"
SESSION_SECONDS = 60 * 60 * 12
ENVIRONMENT = os.getenv("APP_ENV", "development").lower()
_configured_secret = os.getenv("AUTH_SECRET_KEY")
if ENVIRONMENT == "production" and (not _configured_secret or len(_configured_secret) < 32):
    raise RuntimeError("AUTH_SECRET_KEY must be at least 32 characters in production.")
_secret_key = (_configured_secret or secrets.token_urlsafe(48)).encode("utf-8")


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=64)
    return "scrypt$16384$" + _b64encode(salt) + "$" + _b64encode(digest)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, cost, salt_text, digest_text = stored_hash.split("$", 3)
        if algorithm != "scrypt" or cost != "16384":
            return False
        salt = _b64decode(salt_text)
        expected = _b64decode(digest_text)
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_session_token(user_id: int, organization_id: int) -> str:
    now = int(time.time())
    header = _b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload = _b64encode(json.dumps({
        "sub": str(user_id),
        "org": int(organization_id),
        "iat": now,
        "exp": now + SESSION_SECONDS,
        "jti": secrets.token_urlsafe(12),
    }, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header}.{payload}".encode("ascii")
    signature = hmac.new(_secret_key, signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64encode(signature)}"


def decode_session_token(token: str) -> dict:
    try:
        header, payload, signature = token.split(".", 2)
        expected = hmac.new(_secret_key, f"{header}.{payload}".encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(signature)):
            raise ValueError("bad signature")
        token_header = json.loads(_b64decode(header))
        claims = json.loads(_b64decode(payload))
        if token_header.get("alg") != "HS256" or int(claims.get("exp", 0)) <= int(time.time()):
            raise ValueError("expired token")
        return claims
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")


def set_session_cookie(response: Response, user_id: int, organization_id: int):
    response.set_cookie(
        key=COOKIE_NAME,
        value=create_session_token(user_id, organization_id),
        httponly=True,
        secure=ENVIRONMENT == "production",
        samesite="lax",
        max_age=SESSION_SECONDS,
        path="/",
    )


def clear_session_cookie(response: Response):
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=ENVIRONMENT == "production",
        samesite="lax",
        path="/",
    )


@dataclass
class AuthContext:
    user: models.User
    organization: models.Organization
    membership: models.Membership


def get_current_context(request: Request, db: Session = Depends(get_db)) -> AuthContext:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")
    claims = decode_session_token(token)
    try:
        user_id = int(claims["sub"])
        organization_id = int(claims["org"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")

    membership = (
        db.query(models.Membership)
        .options(joinedload(models.Membership.user), joinedload(models.Membership.organization))
        .filter(
            models.Membership.user_id == user_id,
            models.Membership.organization_id == organization_id,
            models.Membership.is_active.is_(True),
        )
        .first()
    )
    if not membership or not membership.user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="This account no longer has workspace access.")
    return AuthContext(user=membership.user, organization=membership.organization, membership=membership)


def require_roles(*allowed_roles: str):
    def dependency(context: AuthContext = Depends(get_current_context)) -> AuthContext:
        if context.membership.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your role does not allow this action.")
        return context
    return dependency
