# CodeAutopsy — Project Blueprint (Free Stack)

---

## 1. Tech Stack

| Layer | Technology | Cost | Why |
|-------|-----------|------|-----|
| Frontend | React 18 + Vite | Free | Fast HMR, modern ecosystem |
| UI | Tailwind CSS + shadcn/ui | Free | Production-grade components |
| Graph | D3.js (force-directed) | Free | Best for interactive network graphs |
| State | Zustand | Free | Lightweight, works well with D3 |
| Backend | FastAPI (Python) | Free | Async, auto-docs, Pydantic |
| Async jobs | FastAPI BackgroundTasks + ThreadPoolExecutor | Free | Replaces Celery — no extra infra |
| ORM | SQLAlchemy 2.0 async | Free | Async queries with asyncpg |
| Database | Neon PostgreSQL | Free | Serverless Postgres, 500MB free tier |
| AI (prod) | Groq API | Free | Llama 3.1 70B, 14,400 req/day free |
| AI (local) | Ollama | Free | Run Llama 3.1 / CodeLlama offline |
| Code analysis | Tree-sitter + radon | Free | AST parsing + complexity metrics |
| Containers | Docker + Docker Compose | Free | Local dev environment |
| CI/CD | GitHub Actions | Free | Automated test → build → deploy |
| Frontend host | Vercel | Free | Static + SSR, zero config for React |
| Backend host | Render | Free | Web service, 750 hrs/month free |

**What got removed vs original plan:**
- ~~Railway~~ → Render (backend) + Vercel (frontend)
- ~~Claude API~~ → Groq API (free tier) + Ollama (local)
- ~~Celery + Redis~~ → FastAPI BackgroundTasks (simpler, free, no extra service)
- ~~Flower~~ → not needed without Celery

---

## 2. Folder Structure

```
codeautopsy/
│
├── .github/
│   └── workflows/
│       └── ci-cd.yml
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # App factory, CORS, routers, lifespan
│   │   │
│   │   ├── api/
│   │   │   ├── deps.py                # get_db, get_current_user
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py            # /register /login /github/callback /refresh /logout
│   │   │       ├── analyses.py        # CRUD + SSE status stream
│   │   │       ├── results.py         # /files /dependencies /patterns /metrics /insights
│   │   │       └── users.py           # GET/PUT /me
│   │   │
│   │   ├── core/
│   │   │   ├── config.py              # Pydantic BaseSettings — reads .env
│   │   │   ├── database.py            # Async SQLAlchemy engine + session factory
│   │   │   └── security.py            # JWT encode/decode, bcrypt hashing
│   │   │
│   │   ├── models/                    # SQLAlchemy ORM (one file per table)
│   │   │   ├── user.py
│   │   │   ├── analysis.py
│   │   │   ├── file.py
│   │   │   ├── dependency.py
│   │   │   ├── pattern.py
│   │   │   ├── metrics.py
│   │   │   └── insight.py
│   │   │
│   │   ├── schemas/                   # Pydantic request/response schemas
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── analysis.py
│   │   │   └── results.py
│   │   │
│   │   ├── services/
│   │   │   ├── github.py              # Clone repo, fetch metadata (PyGithub)
│   │   │   ├── ast_parser.py          # Tree-sitter: parse all files → AST
│   │   │   ├── metrics_engine.py      # Cyclomatic complexity + LoC (radon)
│   │   │   ├── graph_builder.py       # Build dependency edges from imports
│   │   │   ├── pattern_detector.py    # Detect Singleton, Factory, Repository, etc.
│   │   │   └── llm_client.py          # LLM abstraction: Groq (prod) / Ollama (local)
│   │   │
│   │   └── workers/
│   │       └── analysis_job.py        # run_analysis() — called via BackgroundTasks
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_analyses.py
│   │   ├── test_results.py
│   │   └── test_services/
│   │       ├── test_ast_parser.py
│   │       └── test_metrics_engine.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                    # React Router + auth guard
│   │   │
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx          # List all analyses + new analysis CTA
│   │   │   └── Analysis.jsx           # Main view: graph + file tree + insights
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   └── AppShell.jsx
│   │   │   ├── graph/
│   │   │   │   ├── DependencyGraph.jsx    # D3 force simulation
│   │   │   │   ├── GraphToolbar.jsx       # Zoom, filter, highlight controls
│   │   │   │   └── NodeTooltip.jsx
│   │   │   ├── analysis/
│   │   │   │   ├── FileTree.jsx
│   │   │   │   ├── InsightsPanel.jsx
│   │   │   │   ├── MetricsPanel.jsx
│   │   │   │   ├── PatternsPanel.jsx
│   │   │   │   └── ProgressOverlay.jsx    # SSE live progress bar
│   │   │   └── common/
│   │   │       ├── AnalysisCard.jsx
│   │   │       └── QualityBadge.jsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSSE.js              # EventSource for live progress
│   │   │   └── useAnalysis.js         # React Query data fetching
│   │   │
│   │   ├── store/
│   │   │   └── analysisStore.js       # Zustand: selectedNode, filterLanguage
│   │   │
│   │   ├── api/
│   │   │   ├── client.js              # Axios + 401 interceptor (auto token refresh)
│   │   │   ├── auth.js
│   │   │   ├── analyses.js
│   │   │   └── results.js
│   │   │
│   │   └── utils/
│   │       ├── graphHelpers.js        # D3 sizing, color-by-language map
│   │       └── formatters.js
│   │
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 3. Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE analysis_status AS ENUM (
  'queued', 'cloning', 'parsing', 'analyzing', 'complete', 'failed'
);

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               VARCHAR(255) UNIQUE NOT NULL,
  password_hash       VARCHAR(255),
  github_username     VARCHAR(100),
  github_access_token TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_url         VARCHAR(500) NOT NULL,
  repo_name        VARCHAR(200),
  repo_owner       VARCHAR(100),
  primary_language VARCHAR(50),
  status           analysis_status DEFAULT 'queued',
  progress         INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);
CREATE INDEX idx_analyses_user   ON analyses(user_id);
CREATE INDEX idx_analyses_status ON analyses(status);

CREATE TABLE files (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id           UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  path                  VARCHAR(1000) NOT NULL,
  language              VARCHAR(50),
  lines_of_code         INTEGER DEFAULT 0,
  complexity_score      FLOAT DEFAULT 0,
  maintainability_index FLOAT
);
CREATE INDEX idx_files_analysis ON files(analysis_id);

CREATE TABLE dependencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id   UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  from_file_id  UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  to_file_id    UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  dep_type      VARCHAR(50) NOT NULL,  -- 'import' | 'extends' | 'calls'
  line_number   INTEGER
);
CREATE INDEX idx_deps_analysis ON dependencies(analysis_id);
CREATE INDEX idx_deps_from     ON dependencies(from_file_id);

CREATE TABLE patterns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id      UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  file_id          UUID REFERENCES files(id) ON DELETE SET NULL,
  pattern_name     VARCHAR(100) NOT NULL,
  confidence_score FLOAT NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  line_start       INTEGER,
  line_end         INTEGER,
  description      TEXT
);

CREATE TABLE metrics (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id          UUID UNIQUE NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  total_files          INTEGER DEFAULT 0,
  total_lines_of_code  INTEGER DEFAULT 0,
  avg_complexity       FLOAT DEFAULT 0,
  max_complexity       FLOAT DEFAULT 0,
  technical_debt_hours FLOAT DEFAULT 0,
  code_duplication_pct FLOAT DEFAULT 0,
  test_coverage_pct    FLOAT,
  languages            JSONB DEFAULT '{}',  -- {"Python": 65.2, "JavaScript": 34.8}
  quality_score        INTEGER DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100)
);

CREATE TABLE insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id  UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  section      VARCHAR(50) NOT NULL,
  -- 'summary' | 'architecture' | 'quality' | 'evolution' | 'recommendations'
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_insights_unique ON insights(analysis_id, section);
```

---

## 4. API Routes

All routes under `/api/v1`. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| POST | `/auth/register` | `{email, password}` | `{user, access_token, refresh_token}` |
| POST | `/auth/login` | `{email, password}` | `{user, access_token, refresh_token}` |
| POST | `/auth/github/callback` | `{code}` | `{user, access_token, refresh_token}` |
| POST | `/auth/refresh` | `{refresh_token}` | `{access_token}` |
| POST | `/auth/logout` | — | `204` |

### Users _(auth required)_

| Method | Endpoint | Response |
|--------|----------|----------|
| GET | `/users/me` | `{id, email, github_username, analyses_count}` |
| PUT | `/users/me` | `{user}` |

### Analyses _(auth required)_

| Method | Endpoint | Notes |
|--------|----------|-------|
| POST | `/analyses` | Body: `{repo_url}`. Kicks off BackgroundTask immediately. |
| GET | `/analyses?page&limit` | Paginated list |
| GET | `/analyses/:id` | Full analysis object |
| DELETE | `/analyses/:id` | `204` |

### Analysis Results _(auth required)_

| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/analyses/:id/status` | **SSE stream** — `data: {status, progress, message}` |
| GET | `/analyses/:id/files` | File tree with per-file metrics |
| GET | `/analyses/:id/dependencies` | `{nodes[], edges[]}` for D3 force graph |
| GET | `/analyses/:id/patterns` | Detected design patterns + confidence scores |
| GET | `/analyses/:id/metrics` | Aggregate quality metrics |
| GET | `/analyses/:id/insights` | AI-generated sections (summary, arch, quality, recs) |

---

## 5. docker-compose.yml (local dev only)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: codeautopsy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      retries: 5

  backend:
    build: { context: ./backend }
    restart: unless-stopped
    depends_on:
      postgres: { condition: service_healthy }
    env_file: .env
    volumes:
      - ./backend:/app
      - repo_cache:/tmp/repos
    ports: ["8000:8000"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build: { context: ./frontend }
    restart: unless-stopped
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports: ["5173:5173"]
    environment:
      VITE_API_URL: http://localhost:8000
    command: npm run dev -- --host 0.0.0.0

volumes:
  postgres_data:
  repo_cache:
```

> **Note:** In local dev, set `LLM_PROVIDER=ollama` and run `ollama pull llama3.1`
> for completely offline AI. In production (Render), set `LLM_PROVIDER=groq`.

---

## 6. CI/CD Pipeline (.github/workflows/ci-cd.yml)

```yaml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: codeautopsy_test
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        ports: ["5432:5432"]
        options: --health-cmd pg_isready
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11", cache: pip }
      - run: pip install -r backend/requirements.txt -r backend/requirements-dev.txt
      - run: cd backend && flake8 app/ && mypy app/
      - run: cd backend && alembic upgrade head
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/codeautopsy_test
      - run: cd backend && pytest tests/ --cov=app --cov-report=xml -v
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/codeautopsy_test
          SECRET_KEY: ci-test-secret-key-32-characters!!
          LLM_PROVIDER: mock   # use a mock LLM in tests — no API key needed

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint && npm run type-check
      - run: cd frontend && npm run test:ci
      - run: cd frontend && npm run build

  # Only runs on push to main (not PRs)
  deploy-backend:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Render
        run: |
          curl -X POST "${{ secrets.RENDER_DEPLOY_HOOK_URL }}"
        # Render gives you a deploy hook URL — just curl it to trigger a deploy

  deploy-frontend:
    needs: [test-backend, test-frontend]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 7. .env.example

```env
# ── Database ────────────────────────────────────────────────────────
# Local dev: postgresql+asyncpg://postgres:postgres@localhost:5432/codeautopsy
# Production: get this from Neon dashboard (neon.tech)
DATABASE_URL=postgresql+asyncpg://user:pass@host/codeautopsy

# ── Auth ────────────────────────────────────────────────────────────
SECRET_KEY=change-me-to-a-random-string-at-least-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# ── GitHub ──────────────────────────────────────────────────────────
GITHUB_CLIENT_ID=your_github_oauth_app_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_secret
GITHUB_TOKEN=ghp_your_personal_access_token

# ── LLM Provider ────────────────────────────────────────────────────
# Options: 'groq' | 'ollama' | 'mock' (for tests)
LLM_PROVIDER=groq

# Groq (production) — free at console.groq.com
GROQ_API_KEY=gsk_your_groq_api_key
GROQ_MODEL=llama-3.1-70b-versatile

# Ollama (local dev) — run: ollama pull llama3.1
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

# ── App ─────────────────────────────────────────────────────────────
ENVIRONMENT=development
DEBUG=true
ALLOWED_ORIGINS=http://localhost:5173

# ── Sentry (optional, free tier available) ──────────────────────────
SENTRY_DSN=

# ── Frontend (Vite) ─────────────────────────────────────────────────
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=CodeAutopsy
```

---

## 8. backend/requirements.txt

```
# Web
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9

# Database
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1

# Validation & settings
pydantic[email]==2.7.1
pydantic-settings==2.3.0

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# AI — Groq (free) + Ollama fallback
groq==0.9.0
httpx==0.27.0        # for Ollama REST calls

# Code analysis
PyGithub==2.3.0
gitpython==3.1.43
tree-sitter==0.23.0
tree-sitter-python==0.23.1
tree-sitter-javascript==0.23.1
radon==6.0.1
```

---

## 9. Key Implementation Notes

### Background Task Flow (`workers/analysis_job.py`)

No Celery needed. FastAPI dispatches the job immediately after returning the response:

```python
# In analyses.py route handler:
@router.post("/")
async def create_analysis(body: AnalysisCreate, background_tasks: BackgroundTasks, ...):
    analysis = await create_analysis_row(db, body.repo_url, current_user.id)
    background_tasks.add_task(run_analysis, analysis.id)   # fire and forget
    return {"id": analysis.id, "status": "queued"}

# In workers/analysis_job.py:
def run_analysis(analysis_id: UUID):
    # Runs in FastAPI's thread pool (non-blocking to the event loop)
    try:
        update_status(analysis_id, "cloning", 5)
        path = github.clone_repo(repo_url)            # step 1
        update_status(analysis_id, "parsing", 20)
        files = ast_parser.parse_all(path)             # step 2
        edges = graph_builder.build(files)             # step 3
        update_status(analysis_id, "analyzing", 50)
        metrics = metrics_engine.calculate(files)      # step 4
        patterns = pattern_detector.run(files)         # step 5
        update_status(analysis_id, "analyzing", 75)
        insights = llm_client.generate_insights(...)   # step 6
        bulk_insert_all(...)                           # step 7
        update_status(analysis_id, "complete", 100)
    except Exception as e:
        update_status(analysis_id, "failed", error=str(e))
    finally:
        shutil.rmtree(path, ignore_errors=True)
```

### LLM Abstraction (`services/llm_client.py`)

Single class that switches between Groq and Ollama based on env:

```python
class LLMClient:
    def __init__(self, provider: str, **kwargs):
        if provider == "groq":
            self.client = groq.Groq(api_key=kwargs["api_key"])
            self.model  = kwargs.get("model", "llama-3.1-70b-versatile")
        elif provider == "ollama":
            self.base_url = kwargs.get("url", "http://localhost:11434")
            self.model    = kwargs.get("model", "llama3.1")

    def generate(self, prompt: str, max_tokens: int = 600) -> str:
        if hasattr(self, "client"):   # Groq path
            resp = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
            )
            return resp.choices[0].message.content
        else:                          # Ollama path
            resp = httpx.post(f"{self.base_url}/api/generate",
                json={"model": self.model, "prompt": prompt, "stream": False})
            return resp.json()["response"]
```

### SSE Progress Stream (`api/v1/analyses.py`)

```python
@router.get("/{analysis_id}/status")
async def stream_status(analysis_id: UUID, db: AsyncSession = Depends(get_db)):
    async def generator():
        while True:
            row = await db.get(Analysis, analysis_id)
            data = json.dumps({"status": row.status, "progress": row.progress})
            yield f"data: {data}\n\n"
            if row.status in ("complete", "failed"):
                break
            await asyncio.sleep(1.5)
    return StreamingResponse(generator(), media_type="text/event-stream")
```

### D3 Force Graph (`components/graph/DependencyGraph.jsx`)

```javascript
useEffect(() => {
  const sim = d3.forceSimulation(nodes)
    .force("link",   d3.forceLink(edges).id(d => d.id).distance(80))
    .force("charge", d3.forceManyBody().strength(-200))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Node radius = Math.sqrt(node.lines_of_code) * 1.5  (bigger = more code)
  // Node color  = LANGUAGE_COLORS[node.language]       (Python=purple, JS=blue, etc.)
  // On click    → setSelectedNode(id) in Zustand       (syncs file tree + right panel)
}, [nodes, edges]);
```

### Free Tier Limits to Know

| Service | Free Limit | Impact |
|---------|-----------|--------|
| Neon Postgres | 500MB storage, 1 project | Fine for a course project |
| Render web service | 750 hrs/month, spins down after 15min idle | First request after idle takes ~30s |
| Vercel | 100GB bandwidth, unlimited deploys | More than enough |
| Groq API | 14,400 req/day, 6,000 tokens/min | ~14,400 analyses/day — plenty |
| GitHub Actions | 2,000 min/month (public repo = unlimited) | Use public repo to stay free |

> **Render spin-down fix:** Add a `/health` endpoint to FastAPI and use UptimeRobot
> (free) to ping it every 14 minutes. Keeps the service warm at zero cost.

---

## 10. Getting Started (local dev)

```bash
# 1. Clone and set up env
git clone https://github.com/you/codeautopsy
cd codeautopsy
cp .env.example .env
# Fill in: GITHUB_TOKEN, GROQ_API_KEY (or set LLM_PROVIDER=ollama), SECRET_KEY

# 2. If using Ollama locally (optional, fully offline):
ollama pull llama3.1

# 3. Start services
docker compose up --build

# 4. Run DB migrations
docker compose exec backend alembic upgrade head

# 5. Open everything
# App:       http://localhost:5173
# API docs:  http://localhost:8000/docs
```

## 11. Production Deployment

```bash
# Frontend → Vercel (one time setup)
npm i -g vercel
cd frontend && vercel --prod
# Set env var VITE_API_URL to your Render backend URL in Vercel dashboard

# Backend → Render (one time setup)
# 1. Create a new Web Service on render.com, connect your GitHub repo
# 2. Set Build Command:  pip install -r requirements.txt
# 3. Set Start Command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
# 4. Add all env vars from .env.example in Render dashboard
# 5. Copy the Deploy Hook URL → paste as RENDER_DEPLOY_HOOK_URL in GitHub secrets

# Database → Neon (one time setup)
# 1. Create project at neon.tech
# 2. Copy connection string → set as DATABASE_URL in Render env vars
# 3. Run migrations: render run --service backend "alembic upgrade head"
```
