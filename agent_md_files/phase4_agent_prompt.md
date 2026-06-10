# CodeAutopsy — Phase 4 Agent Prompt
# CI/CD Pipeline + Production Deployment
# Prerequisites: Phase 1, 2, and 3 complete and working locally.
# Goal: deploy to Render (backend) + Vercel (frontend) + Neon (DB),
#       automated via GitHub Actions on every push to main.
---

## WHAT PHASE 4 BUILDS

1. A `/health` endpoint so Render and UptimeRobot can probe the backend
2. A production-ready `backend/Dockerfile`
3. A `frontend/vercel.json` for Vercel SPA routing
4. A complete GitHub Actions CI/CD pipeline that:
   - Runs backend tests (pytest) + linting (flake8) on every push/PR
   - Runs frontend lint + build check on every push/PR
   - Deploys backend to Render on merge to main
   - Deploys frontend to Vercel on merge to main
5. A one-line fix for missing dependency graph edges (relative imports)

After the files are created, this document walks you through the one-time
platform setup (Neon → Render → Vercel → GitHub secrets) step by step.

---

## PART A — FILES TO CREATE / UPDATE

---

### FIX: backend/app/services/graph_builder.py

The dependency graph shows no edges because Flask uses relative imports
(`from . import x`, `from .helpers import y`) which the current builder skips.
Add relative import resolution.

Find the `build_dependency_edges` function and replace it with:

```python
def _resolve_relative(import_str: str, from_path: str, all_paths: set[str]) -> str | None:
    """Resolve a relative import like '.' or '.helpers' from the importing file's directory."""
    parts = from_path.replace("\\", "/").split("/")
    # Count leading dots to find how many directory levels to go up
    dots = len(import_str) - len(import_str.lstrip("."))
    base_parts = parts[:-(dots)]  # directory of the importing file, n levels up
    suffix = import_str.lstrip(".")
    if suffix:
        candidates = [
            "/".join(base_parts + [suffix.replace(".", "/")]) + ".py",
            "/".join(base_parts + [suffix.replace(".", "/"), "__init__.py"]),
        ]
    else:
        candidates = [
            "/".join(base_parts + ["__init__.py"]),
        ]
    for c in candidates:
        if c in all_paths:
            return c
    return None


def build_dependency_edges(parsed_files: list[ParsedFile]) -> list[DependencyEdge]:
    """Build directed import edges between files."""
    all_paths_normalized = {f.path.replace("\\", "/") for f in parsed_files}
    edges = []
    seen = set()

    for pf in parsed_files:
        from_path = pf.path.replace("\\", "/")

        for import_str in pf.imports:
            if not import_str:
                continue

            if import_str.startswith("."):
                # Relative import
                resolved = _resolve_relative(import_str, from_path, all_paths_normalized)
            else:
                # Absolute import
                resolved = resolve_import(import_str, all_paths_normalized)

            if resolved and resolved != from_path:
                key = (from_path, resolved)
                if key not in seen:
                    seen.add(key)
                    edges.append(DependencyEdge(
                        from_path=from_path,
                        to_path=resolved,
                        dep_type="import",
                    ))

    return edges
```

Also update `ast_parser.py` — the Python import extractor currently misses
relative imports. Find `extract_python_imports` and add this at the top of the
loop body (before the existing regex matches):

```python
    # Relative imports: from . import x  /  from .module import y
    m = re.match(r"^from\s+(\.+\w*)\s+import", line)
    if m:
        imports.append(m.group(1))
        continue
```

---

### NEW FILE: backend/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# git is required by gitpython to clone repositories
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Working directory for cloned repos (ephemeral, fine for containers)
RUN mkdir -p /tmp/repos

EXPOSE 8000

# Render injects $PORT; fall back to 8000 for local docker compose
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

---

### UPDATE: backend/app/main.py

Add a health check endpoint. Find the line where the router includes are
declared and add this block right after all `app.include_router(...)` calls:

```python
@app.get("/health", tags=["system"])
async def health_check():
    """Used by Render health checks and UptimeRobot keep-alive pings."""
    return {"status": "ok"}
```

---

### NEW FILE: frontend/vercel.json

Vercel serves the React SPA as static files. Without this, any direct URL
like `/analysis/abc123` returns a 404 because Vercel doesn't know to serve
`index.html` for deep links.

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### NEW FILE: .github/workflows/ci-cd.yml

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:

  # ──────────────────────────────────────────────────────────────
  # 1. Backend tests + lint
  # ──────────────────────────────────────────────────────────────
  test-backend:
    name: Backend — test & lint
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB:       codeautopsy_test
          POSTGRES_USER:     postgres
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      DATABASE_URL:                 postgresql+asyncpg://postgres:postgres@localhost:5432/codeautopsy_test
      SECRET_KEY:                   ci-secret-key-minimum-32-characters-long
      ACCESS_TOKEN_EXPIRE_MINUTES:  30
      REFRESH_TOKEN_EXPIRE_DAYS:    30
      LLM_PROVIDER:                 mock
      GITHUB_TOKEN:                 ""
      ALLOWED_ORIGINS:              http://localhost:5173

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: pip

      - name: Install dependencies
        run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt

      - name: Lint — flake8
        run: cd backend && flake8 app/ --max-line-length=120 --ignore=E501,W503

      - name: Run migrations
        run: cd backend && alembic upgrade head

      - name: Run tests
        run: cd backend && pytest tests/ -v --tb=short

  # ──────────────────────────────────────────────────────────────
  # 2. Frontend build check
  # ──────────────────────────────────────────────────────────────
  test-frontend:
    name: Frontend — lint & build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: cd frontend && npm ci

      - name: Lint
        run: cd frontend && npm run lint

      - name: Build
        run: cd frontend && npm run build
        env:
          VITE_API_URL: https://placeholder.onrender.com

  # ──────────────────────────────────────────────────────────────
  # 3. Deploy backend to Render  (main branch only)
  # ──────────────────────────────────────────────────────────────
  deploy-backend:
    name: Deploy — Render
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - name: Trigger Render deploy hook
        run: |
          curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"

  # ──────────────────────────────────────────────────────────────
  # 4. Deploy frontend to Vercel  (main branch only)
  # ──────────────────────────────────────────────────────────────
  deploy-frontend:
    name: Deploy — Vercel
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install Vercel CLI
        run: npm install -g vercel@latest

      - name: Deploy to Vercel (production)
        run: |
          cd frontend
          vercel pull --yes --environment=production \
            --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod \
            --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod \
            --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID:     ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

### NEW FILE: backend/requirements-dev.txt

If this file doesn't already exist, create it:

```
pytest==8.2.2
pytest-asyncio==0.23.7
pytest-cov==5.0.0
httpx==0.27.0
flake8==7.1.0
```

---

### NEW FILE: backend/tests/conftest.py

If a `conftest.py` doesn't already exist in `backend/tests/`:

```python
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
```

---

### NEW FILE: backend/tests/test_health.py

A minimal smoke test so pytest has something to run even if other test files
don't exist yet:

```python
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
```

---

### UPDATE: backend/app/core/config.py

Make sure `pytest.ini` or `pyproject.toml` sets asyncio mode. If neither
exists, create `backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
```

---

## PART B — ONE-TIME PLATFORM SETUP

Do this after the agent has applied all files above.
You need accounts on: **Neon**, **Render**, **Vercel**.
All have free tiers — no credit card required.

---

### STEP 1 — Neon (Production PostgreSQL)

1. Go to https://neon.tech and sign up (GitHub login works).
2. Click **New Project** → name it `codeautopsy` → region closest to you.
3. After creation, go to **Connection Details**.
4. Select connection string format: **asyncpg**.
5. Copy the string — it looks like:
   ```
   postgresql+asyncpg://user:pass@ep-xxx.us-east-2.aws.neon.tech/codeautopsy?sslmode=require
   ```
6. Save it — you'll paste it into Render in the next step.

---

### STEP 2 — Render (Backend)

1. Go to https://render.com and sign up (GitHub login works).
2. Click **New → Web Service**.
3. Connect your GitHub repo.
4. Configure:
   - **Name:** `codeautopsy-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Docker`  ← Render will use your Dockerfile
   - **Branch:** `main`
   - **Region:** same as Neon (reduces latency)
5. Under **Environment Variables**, add every key from `.env.example`:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Your Neon connection string from Step 1 |
   | `SECRET_KEY` | Run `python -c "import secrets; print(secrets.token_hex(32))"` and paste |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `30` |
   | `GITHUB_TOKEN` | Your GitHub PAT (classic, `public_repo` scope) |
   | `GITHUB_CLIENT_ID` | From your GitHub OAuth App (or leave blank if not using GitHub OAuth login) |
   | `GITHUB_CLIENT_SECRET` | Same as above |
   | `LLM_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | Your key from console.groq.com |
   | `GROQ_MODEL` | `llama-3.1-70b-versatile` |
   | `ENVIRONMENT` | `production` |
   | `DEBUG` | `false` |
   | `ALLOWED_ORIGINS` | Your Vercel URL (fill in after Step 3, or use `*` temporarily) |

6. Under **Health Check Path**, enter `/health`.
7. Click **Create Web Service**. First deploy starts. It'll take ~5 minutes.
8. Once it's live, copy your service URL (e.g. `https://codeautopsy-backend.onrender.com`).
9. Go to **Settings → Deploy Hook** → copy the hook URL.
   Save it as `RENDER_DEPLOY_HOOK_URL` — you'll add it to GitHub secrets in Step 5.
10. Run migrations on the production DB:
    ```bash
    # From your local machine with the Neon DATABASE_URL set
    DATABASE_URL="postgresql+asyncpg://..." cd backend && alembic upgrade head
    ```
    Or use Render's **Shell** tab in the service dashboard:
    ```bash
    alembic upgrade head
    ```

---

### STEP 3 — Vercel (Frontend)

**Option A — Dashboard (recommended, easiest):**
1. Go to https://vercel.com and sign up (GitHub login).
2. Click **Add New → Project**.
3. Import your GitHub repo.
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | Your Render backend URL from Step 2 |
   | `VITE_APP_NAME` | `CodeAutopsy` |

6. Click **Deploy**. Vercel will build and give you a URL like
   `https://codeautopsy.vercel.app`.
7. Copy this URL → go back to Render → update `ALLOWED_ORIGINS` to this URL.
   Restart the Render service so CORS picks up the change.

**Option B — CLI (needed for the GitHub Actions workflow):**
```bash
npm i -g vercel
cd frontend
vercel login        # opens browser for GitHub OAuth
vercel link         # links local dir to the Vercel project created above
```
After `vercel link`, two IDs are written to `frontend/.vercel/project.json`:
```json
{ "orgId": "team_xxx", "projectId": "prj_xxx" }
```
Save those — you'll need them for GitHub secrets in Step 5.

---

### STEP 4 — UptimeRobot (Keep Render warm)

Render's free tier spins down after 15 minutes of inactivity.
The `/health` endpoint + UptimeRobot pings every 14 minutes prevents this.

1. Go to https://uptimerobot.com and sign up (free).
2. Click **Add New Monitor**:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** CodeAutopsy Backend
   - **URL:** `https://your-render-url.onrender.com/health`
   - **Monitoring Interval:** 14 minutes
3. Click **Create Monitor**. Done.

---

### STEP 5 — GitHub Actions Secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**

Add each of these:

| Secret Name | Where to get it |
|-------------|-----------------|
| `RENDER_DEPLOY_HOOK_URL` | Render → your service → Settings → Deploy Hook |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → Create Token |
| `VERCEL_ORG_ID` | `frontend/.vercel/project.json` → `orgId` field |
| `VERCEL_PROJECT_ID` | `frontend/.vercel/project.json` → `projectId` field |

---

### STEP 6 — Push and verify the pipeline

```bash
git add .
git commit -m "feat: phase 4 - CI/CD and production deployment"
git push origin main
```

Go to your repo → **Actions** tab. You should see the workflow running.

Expected result:
- ✅ `Backend — test & lint` — passes (smoke test hits /health)
- ✅ `Frontend — lint & build` — passes (Vite builds successfully)
- ✅ `Deploy — Render` — triggers the webhook, Render pulls and redeploys
- ✅ `Deploy — Vercel` — builds and pushes to production

---

## PART C — VERIFY END TO END

Once both deploys are green:

```bash
# 1. Health check
curl https://your-backend.onrender.com/health
# Expected: {"status":"ok"}

# 2. Register a user
curl -X POST https://your-backend.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"yourpassword"}'

# 3. Open the frontend
# Navigate to https://your-project.vercel.app
# Log in with the account you just created
# Submit https://github.com/pallets/flask
# Watch the live progress overlay
# Once complete: file tree, graph with edges, metrics, AI insights
```

---

## TROUBLESHOOTING

**CORS error in browser after deploy:**
Render's `ALLOWED_ORIGINS` must exactly match the Vercel URL including protocol
and no trailing slash. E.g. `https://codeautopsy.vercel.app` not
`https://codeautopsy.vercel.app/`.

**Alembic migration fails on first Render deploy:**
The Render service starts and tries to run the app before migrations run.
Either run migrations manually via Render Shell, or add this to `main.py`
inside the lifespan context manager (runs on startup):
```python
# In lifespan, before yield:
from alembic.config import Config
from alembic import command
alembic_cfg = Config("alembic.ini")
command.upgrade(alembic_cfg, "head")
```

**Frontend build fails — "VITE_API_URL is not defined":**
The `npm run build` in the Actions workflow passes a placeholder URL.
The real URL is only needed at runtime in the browser (Vite bakes it in at
build time). Make sure you set `VITE_API_URL` in the Vercel dashboard under
Environment Variables → Production, not just locally.

**Graph still shows no edges locally:**
After applying the relative import fix to `graph_builder.py` and
`ast_parser.py`, re-run the analysis on Flask. The existing completed analysis
won't update automatically — submit the URL again to create a fresh one.

**Groq rate limit (429) in production:**
The free tier allows 14,400 requests/day and 6,000 tokens/minute. Each
analysis makes 4 LLM calls (summary, architecture, quality, recommendations).
At 4 calls/analysis you can do 3,600 analyses/day. If you hit limits, set
`LLM_PROVIDER=mock` temporarily.
