import os
import time

import jwt
from fastapi import APIRouter, HTTPException

router = APIRouter(tags=["auth"])


@router.get("/powersync-token")
async def get_powersync_token() -> dict:
    """
    Returns a signed JWT that PowerSync clients use to authenticate against
    the PowerSync Cloud service.

    Setup required in backends/.env:
        POWERSYNC_PRIVATE_KEY=<RSA private key PEM, with \\n for newlines>

    The matching public key must be registered in the PowerSync Cloud dashboard
    (Instance → Edit → Auth → Add key).
    Since this app has no user accounts, all clients get the same anonymous token.
    """
    raw_key = os.getenv("POWERSYNC_PRIVATE_KEY", "")
    if not raw_key:
        raise HTTPException(
            status_code=503,
            detail="PowerSync not configured (POWERSYNC_PRIVATE_KEY missing)",
        )

    # Support both literal \n (from .env files) and actual newlines
    private_key = raw_key.replace("\\n", "\n")

    now = int(time.time())
    payload = {
        "sub": "household-user",   # fixed subject – no per-user auth
        "iat": now,
        "exp": now + 3600,         # token valid for 1 hour
        "parameters": {},          # PowerSync sync-rule parameters (none needed)
    }

    try:
        token = jwt.encode(payload, private_key, algorithm="RS256")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Token generation failed: {exc}",
        ) from exc

    return {"token": token}
