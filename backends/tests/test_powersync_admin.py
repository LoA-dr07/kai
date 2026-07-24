"""Tests for the /admin/powersync router. The `powersync` CLI subprocess is
mocked out via `_run_cli` – these tests only cover secret-checking and
response wiring, not the real CLI/PowerSync Cloud interaction."""
import app.routers.powersync_admin as powersync_admin


def test_stop_without_secret_is_rejected(client, monkeypatch):
    monkeypatch.setenv("POWERSYNC_ADMIN_SECRET", "s3cret")
    resp = client.post("/admin/powersync/stop")
    assert resp.status_code == 403


def test_stop_with_wrong_secret_is_rejected(client, monkeypatch):
    monkeypatch.setenv("POWERSYNC_ADMIN_SECRET", "s3cret")
    resp = client.post("/admin/powersync/stop", headers={"X-Admin-Secret": "wrong"})
    assert resp.status_code == 403


def test_stop_runs_cli_when_secret_matches(client, monkeypatch):
    monkeypatch.setenv("POWERSYNC_ADMIN_SECRET", "s3cret")
    monkeypatch.setattr(powersync_admin, "_run_cli", lambda args: "instance stopped")

    resp = client.post("/admin/powersync/stop", headers={"X-Admin-Secret": "s3cret"})
    assert resp.status_code == 200
    assert resp.json() == {"status": "stopped", "output": "instance stopped"}


def test_start_runs_cli_when_secret_matches(client, monkeypatch):
    monkeypatch.setenv("POWERSYNC_ADMIN_SECRET", "s3cret")
    monkeypatch.setattr(powersync_admin, "_run_cli", lambda args: "instance deployed")

    resp = client.post("/admin/powersync/start", headers={"X-Admin-Secret": "s3cret"})
    assert resp.status_code == 200
    assert resp.json() == {"status": "started", "output": "instance deployed"}


def test_missing_admin_secret_env_rejects_everything(client, monkeypatch):
    monkeypatch.delenv("POWERSYNC_ADMIN_SECRET", raising=False)
    resp = client.post("/admin/powersync/stop", headers={"X-Admin-Secret": "anything"})
    assert resp.status_code == 403


def test_missing_ps_admin_token_returns_503(client, monkeypatch):
    monkeypatch.setenv("POWERSYNC_ADMIN_SECRET", "s3cret")
    monkeypatch.delenv("PS_ADMIN_TOKEN", raising=False)
    resp = client.post("/admin/powersync/start", headers={"X-Admin-Secret": "s3cret"})
    assert resp.status_code == 503
