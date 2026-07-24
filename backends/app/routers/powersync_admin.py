import os
import secrets
import subprocess
from pathlib import Path

from fastapi import APIRouter, Header, HTTPException

from app.schemas.powersync_admin import PowerSyncActionResponse

router = APIRouter(prefix="/admin/powersync", tags=["admin"])

# backends/powersync/ – created once via `powersync link cloud` (see README.md there)
CLI_DIR = Path(__file__).resolve().parents[2] / "powersync"


def _check_admin_secret(x_admin_secret: str | None) -> None:
    expected = os.getenv("POWERSYNC_ADMIN_SECRET", "")
    if not expected or not x_admin_secret or not secrets.compare_digest(x_admin_secret, expected):
        raise HTTPException(status_code=403, detail="Invalid admin secret")


def _run_cli(args: list[str]) -> str:
    """
    Run a `powersync` CLI command against the linked PowerSync Cloud instance.

    Requires backends/powersync/cli.yaml (created once via `powersync link cloud`,
    see backends/powersync/README.md) and the PS_ADMIN_TOKEN env var (a personal
    access token from the PowerSync Dashboard, set as a fly.io secret).
    """
    if not os.getenv("PS_ADMIN_TOKEN"):
        raise HTTPException(status_code=503, detail="PS_ADMIN_TOKEN not configured")
    if not CLI_DIR.exists():
        raise HTTPException(
            status_code=503,
            detail="PowerSync CLI not linked (backends/powersync/cli.yaml missing)",
        )

    try:
        result = subprocess.run(
            ["powersync", *args],
            cwd=CLI_DIR,
            capture_output=True,
            text=True,
            timeout=300,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=500, detail="powersync CLI is not installed in this container"
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="powersync command timed out") from exc

    if result.returncode != 0:
        raise HTTPException(
            status_code=502,
            detail=f"powersync {args[0]} failed: {result.stderr.strip()[-500:]}",
        )
    return result.stdout.strip()[-500:]


@router.post("/stop", response_model=PowerSyncActionResponse)
async def stop_powersync(
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
) -> PowerSyncActionResponse:
    """
    Deprovisions the PowerSync Cloud instance, closing its replication
    connection to Neon so Neon can auto-suspend. Restart via /start.
    """
    _check_admin_secret(x_admin_secret)
    output = _run_cli(["stop", "--confirm=yes"])
    return PowerSyncActionResponse(status="stopped", output=output)


@router.post("/start", response_model=PowerSyncActionResponse)
async def start_powersync(
    x_admin_secret: str | None = Header(default=None, alias="X-Admin-Secret"),
) -> PowerSyncActionResponse:
    """Redeploys the PowerSync Cloud instance after it was stopped."""
    _check_admin_secret(x_admin_secret)
    output = _run_cli(["deploy"])
    return PowerSyncActionResponse(status="started", output=output)
