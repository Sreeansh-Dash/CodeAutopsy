import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        res = await client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_register_and_login():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        reg = await client.post("/api/v1/auth/register", json={
            "email": "smoketest@ci.com",
            "password": "smoketest123"
        })
        assert reg.status_code in (200, 201, 400)  # 400 = already exists on re-run

        login = await client.post("/api/v1/auth/login", json={
            "email": "smoketest@ci.com",
            "password": "smoketest123"
        })
        assert login.status_code == 200
        assert "access_token" in login.json()
