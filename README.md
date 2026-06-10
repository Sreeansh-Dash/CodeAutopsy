# 🔍 CodeAutopsy

[![CI/CD Pipeline](https://github.com/Sreeansh-Dash/CodeAutopsy/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/Sreeansh-Dash/CodeAutopsy/actions/workflows/ci-cd.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)](https://reactjs.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**CodeAutopsy** is a next-generation static analysis and code intelligence platform. It clones a repository, parses files into AST nodes, maps dependency relationships, computes complexity metrics, identifies design patterns, and leverages LLMs to generate high-value architecture, quality, and refactoring insights—all displayed in an interactive force-directed D3.js dependency graph.

---

## ✨ Features

- **📂 Live Git Cloning & Parsing**: Submit any public GitHub repository URL to trigger an automated, multi-stage background analysis pipeline.
- **🌳 AST-based File Parsing**: Uses **Tree-sitter** to parse python/javascript files into structural Abstract Syntax Trees.
- **🕸️ D3.js Force-Directed Graph**: Navigate your codebase visually via an interactive dependency network mapping file imports, parent/child relationships, and size-scaled nodes based on lines of code.
- **📈 Code Quality Metrics**: Under-the-hood metrics engine compute radon-based Cyclomatic Complexity, Maintainability Index, Lines of Code (LoC), and Code Duplication percentage.
- **🧩 Automatic Design Pattern Detection**: Scans AST structure for common structural patterns (e.g., Singleton, Factory, Repository).
- **💡 LLM-Powered Insights**: Generates developer-centric reports on codebase summaries, architectural flows, quality hot-spots, and concrete recommendations using **Groq** (production) or **Ollama** (fully offline local dev).
- **⚡ SSE Progress Streaming**: Server-Sent Events stream live status updates (*cloning* ➔ *parsing* ➔ *analyzing* ➔ *complete*) to the UI in real-time.

---

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI (Asynchronous Python)
- **Async Job Worker**: FastAPI BackgroundTasks + ThreadPoolExecutor (high performance without complex Redis/Celery setups)
- **Database ORM**: SQLAlchemy 2.0 (Asyncpg)
- **Migrations**: Alembic
- **AST Parser**: Tree-sitter & Tree-sitter-python
- **Code Metrics**: Radon (Complexity & Maintainability)

### Frontend
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Network Visualization**: D3.js (Force Simulation)
- **State Management**: Zustand & React Query

### AI & LLM Integration
- **Production**: Groq API (Llama 3.1 70B)
- **Local Dev**: Ollama (Llama 3.1/CodeLlama)

---

## 🗂️ Directory Layout

```
codeautopsy/
├── .github/workflows/      # GitHub Actions CI/CD workflow configuration
│   └── ci-cd.yml
├── backend/
│   ├── app/
│   │   ├── api/            # API Route endpoints & dependency injection
│   │   ├── core/           # Config settings & database session initiation
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── services/       # AST Parser, Metrics Engine, Pattern Detector, LLM Client
│   │   └── workers/        # Asynchronous analysis_job runner
│   ├── alembic/            # Database schema migrations
│   ├── tests/              # Backend pytest suite
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # shadcn, force graph, progress overlay, layout components
│   │   ├── pages/          # Dashboard, login/register, visual analysis views
│   │   └── api/            # Axios API client endpoints
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml      # Local orchestration orchestrating PostgreSQL, backend, & frontend
```

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
Ensure you have the following installed:
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)
- Git

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```
Ensure you set the following in `.env`:
- `SECRET_KEY`: A secure random 32-character string.
- `GITHUB_TOKEN`: A GitHub Personal Access Token (PAT) to avoid API rate limits.
- `LLM_PROVIDER`: Set to `ollama` for offline development, or `groq` for cloud.
- `GROQ_API_KEY`: Required if `LLM_PROVIDER=groq`.
- `DATABASE_URL`: Local default is `postgresql+asyncpg://postgres:postgres@postgres:5432/codeautopsy`

### 3. Spin Up Services
Build and start the PostgreSQL database, FastAPI backend, and React frontend in Docker containers:
```bash
docker compose up --build
```
This starts:
- Frontend on: `http://localhost:5173`
- Backend API Docs on: `http://localhost:8000/docs`

### 4. Run Database Migrations
Initialize the Postgres database schema by executing Alembic migrations:
```bash
docker compose exec backend alembic upgrade head
```

---

## 🧪 Testing

### Backend Unit Tests & Linters
We use `pytest` for endpoint and service tests, and `flake8` for style rules.

Run checks locally:
```bash
# Enter backend container or local virtual environment
cd backend
pytest tests/ -v
flake8 app/ --max-line-length=120 --ignore=E501,W503
```

---

## 🔄 CI/CD Pipeline

CodeAutopsy is integrated with GitHub Actions to maintain code health on every push to `main` and `develop` branches:

1. **Backend Checks**: Installs dependencies, lint-checks with `flake8`, executes alembic migrations against a test PostgreSQL container, and runs `pytest` suites.
2. **Frontend Checks**: Builds the React asset bundle using Vite and verifies all TypeScript/JSX imports are correct.
3. **Automated Deployments**:
   - Backend web service builds and deploys to **Render** via deploy hook.
   - Frontend static files are deployed to **Vercel** production servers.

---

## 📄 Database Schema Overview

CodeAutopsy maintains 7 relational database entities:
- **`users`**: Encrypted credentials and linked GitHub OAuth credentials.
- **`analyses`**: Tracks current pipeline status (`queued`, `cloning`, `parsing`, `analyzing`, `complete`, `failed`).
- **`files`**: Metric metrics tracking paths, LoC, cyclomatic complexity, and maintainability metrics.
- **`dependencies`**: Directed graphs modeling imports (`from_file_id` ➔ `to_file_id`).
- **`patterns`**: Identified software design patterns and confidence weights.
- **`metrics`**: Rollup totals of repo size, languages, average complexity, and debt estimations.
- **`insights`**: AI-generated structural reviews and recommendations.
