import base64
import os
import time

import jwt
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["auth"])

_JWKS_CACHE: dict | None = None
_KID = "powersync-key-2"


def _build_jwks(public_key_pem: str) -> dict:
    pub = load_pem_public_key(public_key_pem.encode())
    nums = pub.public_numbers()  # type: ignore[union-attr]

    def to_b64url(n: int) -> str:
        length = (n.bit_length() + 7) // 8
        return base64.urlsafe_b64encode(n.to_bytes(length, "big")).rstrip(b"=").decode()

    return {
        "keys": [
            {
                "kty": "RSA",
                "use": "sig",
                "alg": "RS256",
                "kid": _KID,
                "n": to_b64url(nums.n),
                "e": to_b64url(nums.e),
            }
        ]
    }


@router.get("/jwks.json")
async def get_jwks() -> dict:
    """
    JWKS endpoint – register this URL in the PowerSync Cloud dashboard
    under Client Auth → JWKS.

    Setup required in backends/.env:
        POWERSYNC_PUBLIC_KEY=<RSA public key PEM, with \\n for newlines>
    """
    global _JWKS_CACHE
    if _JWKS_CACHE is not None:
        return _JWKS_CACHE

    raw = os.getenv("POWERSYNC_PUBLIC_KEY", "")
    if not raw:
        raise HTTPException(
            status_code=503,
            detail="PowerSync not configured (POWERSYNC_PUBLIC_KEY missing)",
        )

    try:
        _JWKS_CACHE = _build_jwks(raw.replace("\\n", "\n"))
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"JWKS generation failed: {exc}",
        ) from exc

    return _JWKS_CACHE


@router.get("/powersync-token")
async def get_powersync_token() -> dict:
    """
    Returns a signed JWT that PowerSync clients use to authenticate against
    the PowerSync Cloud service.

    Setup required in backends/.env:
        POWERSYNC_PRIVATE_KEY=<RSA private key PEM, with \\n for newlines>
    """
    raw_key = os.getenv("POWERSYNC_PRIVATE_KEY", "")
    if not raw_key:
        raise HTTPException(
            status_code=503,
            detail="PowerSync not configured (POWERSYNC_PRIVATE_KEY missing)",
        )

    private_key = raw_key.replace("\\n", "\n")

    now = int(time.time())
    powersync_url = os.getenv("POWERSYNC_URL", "")
    payload = {
        "sub": "household-user",
        "iat": now,
        "exp": now + 3600,
        "aud": powersync_url,
        "parameters": {},
    }

    try:
        token = jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": _KID})
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Token generation failed: {exc}",
        ) from exc

    return {"token": token}
