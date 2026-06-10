import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db, Base
from app.core.config import settings

TEST_DATABASE_URL = settings.DATABASE_URL


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
async def auth_headers(async_client):
    """Register a test user and return auth headers."""
    await async_client.post("/api/v1/auth/register", json={
        "email": "ci@test.com",
        "password": "testpassword123"
    })
    res = await async_client.post("/api/v1/auth/login", json={
        "email": "ci@test.com",
        "password": "testpassword123"
    })
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
