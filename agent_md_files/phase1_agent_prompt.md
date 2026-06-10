# CodeAutopsy — Phase 1 Agent Prompt
# Feed this entire file to your coding agent (Claude Code, Cursor, Windsurf, etc.)
# Goal: by the end, the backend is running, auth works, and the frontend scaffolds.
---

## YOUR TASK

Build Phase 1 of **CodeAutopsy** — a web app that analyzes GitHub repos and generates
dependency graphs, quality metrics, and AI-powered insights.

Phase 1 scope: project scaffold + database models + JWT auth + basic analysis CRUD + React frontend shell.

**Success criteria (how you know Phase 1 is done):**
1. `docker compose up --build` starts without errors
2. `GET http://localhost:8000/health` returns `{"status": "ok"}`
3. `POST http://localhost:8000/api/v1/auth/register` creates a user and returns tokens
4. `POST http://localhost:8000/api/v1/auth/login` returns tokens
5. `GET http://localhost:8000/api/v1/users/me` with a Bearer token returns the user
6. React app loads at `http://localhost:5173`

Do NOT build the analysis engine, LLM calls, or D3 graph yet. That is Phase 2.

---

## EXACT TECH STACK

```
Python:     3.11
Node:       20
FastAPI:    0.111.0
SQLAlchemy: 2.0.30 (async mode)
asyncpg:    0.29.0
Alembic:    1.13.1
pydantic:   2.7.1
pydantic-settings: 2.3.0
python-jose[cryptography]: 3.3.0
passlib[bcrypt]: 1.7.4
uvicorn[standard]: 0.30.0
python-multipart: 0.0.9

React:      18
Vite:       5
Tailwind:   3
react-router-dom: 6
axios:      1.7
zustand:    4.5
@tanstack/react-query: 5
```

---

## STEP 1 — Create the full folder structure

Create all directories and empty `__init__.py` where needed:

```
codeautopsy/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       └── analyses.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── security.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── analysis.py
│   │   │   ├── file.py
│   │   │   ├── dependency.py
│   │   │   ├── pattern.py
│   │   │   ├── metrics.py
│   │   │   └── insight.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── analysis.py
│   │   │   └── results.py
│   │   ├── services/
│   │   │   └── __init__.py
│   │   └── workers/
│   │       └── __init__.py
│   ├── alembic/
│   │   └── versions/
│   ├── tests/
│   │   └── conftest.py
│   ├── Dockerfile
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   └── (Vite will scaffold this — see Step 5)
├── docker-compose.yml
├── .env
└── .env.example
```

---

## STEP 2 — Root config files

### docker-compose.yml
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
      timeout: 5s
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

### .env (also copy to .env.example with placeholder values)
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/codeautopsy

SECRET_KEY=dev-secret-key-change-this-in-production-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_TOKEN=

LLM_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-70b-versatile
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1

ENVIRONMENT=development
DEBUG=true
ALLOWED_ORIGINS=http://localhost:5173
```

---

## STEP 3 — Backend files (create exactly as shown)

### backend/requirements.txt
```
fastapi==0.111.0
uvicorn[standard]==0.30.0
python-multipart==0.0.9
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.1
pydantic[email]==2.7.1
pydantic-settings==2.3.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
groq==0.9.0
httpx==0.27.0
PyGithub==2.3.0
gitpython==3.1.43
tree-sitter==0.23.0
radon==6.0.1
```

### backend/requirements-dev.txt
```
pytest==8.2.0
pytest-asyncio==0.23.7
pytest-cov==5.0.0
httpx==0.27.0
flake8==7.0.0
mypy==1.10.0
```

### backend/Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### backend/app/core/config.py
```python
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_TOKEN: Optional[str] = None

    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-70b-versatile"
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1"

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()
```

### backend/app/core/database.py
```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### backend/app/core/security.py
```python
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        raise ValueError(f"Invalid token: {e}")
```

### backend/app/models/user.py
```python
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255))
    github_username: Mapped[Optional[str]] = mapped_column(String(100))
    github_access_token: Mapped[Optional[str]] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
```

### backend/app/models/analysis.py
```python
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Integer, Text, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    repo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    repo_name: Mapped[Optional[str]] = mapped_column(String(200))
    repo_owner: Mapped[Optional[str]] = mapped_column(String(100))
    primary_language: Mapped[Optional[str]] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(50), default="queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100", name="progress_range"),
    )
```

### backend/app/models/file.py
```python
import uuid
from typing import Optional
from sqlalchemy import String, Integer, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class File(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    path: Mapped[str] = mapped_column(String(1000), nullable=False)
    language: Mapped[Optional[str]] = mapped_column(String(50))
    lines_of_code: Mapped[int] = mapped_column(Integer, default=0)
    complexity_score: Mapped[float] = mapped_column(Float, default=0)
    maintainability_index: Mapped[Optional[float]] = mapped_column(Float)
```

### backend/app/models/dependency.py
```python
import uuid
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Dependency(Base):
    __tablename__ = "dependencies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    from_file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    to_file_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    dep_type: Mapped[str] = mapped_column(String(50), nullable=False)
    line_number: Mapped[Optional[int]] = mapped_column(Integer)
```

### backend/app/models/pattern.py
```python
import uuid
from typing import Optional
from sqlalchemy import String, Float, Integer, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Pattern(Base):
    __tablename__ = "patterns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    file_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="SET NULL"))
    pattern_name: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    line_start: Mapped[Optional[int]] = mapped_column(Integer)
    line_end: Mapped[Optional[int]] = mapped_column(Integer)
    description: Mapped[Optional[str]] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("confidence_score >= 0 AND confidence_score <= 1", name="confidence_range"),
    )
```

### backend/app/models/metrics.py
```python
import uuid
from typing import Optional
from sqlalchemy import Integer, Float, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class Metrics(Base):
    __tablename__ = "metrics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    total_lines_of_code: Mapped[int] = mapped_column(Integer, default=0)
    avg_complexity: Mapped[float] = mapped_column(Float, default=0)
    max_complexity: Mapped[float] = mapped_column(Float, default=0)
    technical_debt_hours: Mapped[float] = mapped_column(Float, default=0)
    code_duplication_pct: Mapped[float] = mapped_column(Float, default=0)
    test_coverage_pct: Mapped[Optional[float]] = mapped_column(Float)
    languages: Mapped[dict] = mapped_column(JSONB, default=dict)
    quality_score: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (
        CheckConstraint("quality_score >= 0 AND quality_score <= 100", name="quality_range"),
    )
```

### backend/app/models/insight.py
```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    section: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

### backend/app/schemas/auth.py
```python
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str
    github_username: str | None = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
```

### backend/app/schemas/user.py
```python
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserUpdate(BaseModel):
    github_username: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: str
    github_username: Optional[str] = None
    created_at: datetime
    analyses_count: int = 0

    model_config = {"from_attributes": True}
```

### backend/app/schemas/analysis.py
```python
from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


class AnalysisCreate(BaseModel):
    repo_url: str


class AnalysisResponse(BaseModel):
    id: str
    user_id: str
    repo_url: str
    repo_name: Optional[str] = None
    repo_owner: Optional[str] = None
    primary_language: Optional[str] = None
    status: str
    progress: int
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AnalysisListResponse(BaseModel):
    analyses: list[AnalysisResponse]
    total: int
    page: int
    limit: int
```

### backend/app/api/deps.py
```python
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise ValueError("Not an access token")
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("No subject")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### backend/app/api/v1/auth.py
```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, RefreshRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    await db.flush()

    return {
        "user": {"id": str(user.id), "email": user.email},
        "access_token": create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
    }


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "user": {"id": str(user.id), "email": user.email},
        "access_token": create_access_token({"sub": str(user.id)}),
        "refresh_token": create_refresh_token({"sub": str(user.id)}),
    }


@router.post("/refresh")
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Wrong token type")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = await db.get(User, uuid.UUID(user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"access_token": create_access_token({"sub": str(user.id)})}


@router.post("/logout", status_code=204)
async def logout():
    return None  # Stateless JWT — client discards the token
```

### backend/app/api/v1/users.py
```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.schemas.user import UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count_result = await db.execute(
        select(func.count()).where(Analysis.user_id == current_user.id)
    )
    analyses_count = count_result.scalar() or 0

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "github_username": current_user.github_username,
        "created_at": current_user.created_at.isoformat(),
        "analyses_count": analyses_count,
    }


@router.put("/me")
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.github_username is not None:
        current_user.github_username = body.github_username
    return {"id": str(current_user.id), "email": current_user.email, "github_username": current_user.github_username}
```

### backend/app/api/v1/analyses.py
```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.schemas.analysis import AnalysisCreate
import uuid

router = APIRouter(prefix="/analyses", tags=["analyses"])


@router.post("/", status_code=201)
async def create_analysis(
    body: AnalysisCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = Analysis(
        user_id=current_user.id,
        repo_url=str(body.repo_url),
        status="queued",
        progress=0,
    )
    db.add(analysis)
    await db.flush()

    # Phase 2 will add: background_tasks.add_task(run_analysis, analysis.id)

    return {
        "id": str(analysis.id),
        "status": analysis.status,
        "progress": analysis.progress,
        "created_at": analysis.created_at.isoformat(),
    }


@router.get("/")
async def list_analyses(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    offset = (page - 1) * limit
    result = await db.execute(
        select(Analysis)
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    analyses = result.scalars().all()

    count_result = await db.execute(
        select(func.count()).where(Analysis.user_id == current_user.id)
    )
    total = count_result.scalar() or 0

    return {
        "analyses": [
            {
                "id": str(a.id),
                "repo_url": a.repo_url,
                "repo_name": a.repo_name,
                "status": a.status,
                "progress": a.progress,
                "created_at": a.created_at.isoformat(),
            }
            for a in analyses
        ],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(Analysis, analysis_id)
    if not analysis or analysis.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "id": str(analysis.id),
        "repo_url": analysis.repo_url,
        "repo_name": analysis.repo_name,
        "status": analysis.status,
        "progress": analysis.progress,
        "error_message": analysis.error_message,
        "created_at": analysis.created_at.isoformat(),
        "completed_at": analysis.completed_at.isoformat() if analysis.completed_at else None,
    }


@router.delete("/{analysis_id}", status_code=204)
async def delete_analysis(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    analysis = await db.get(Analysis, analysis_id)
    if not analysis or analysis.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")
    await db.delete(analysis)
    return None
```

### backend/app/main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import auth, users, analyses

app = FastAPI(
    title="CodeAutopsy API",
    description="Analyze GitHub repositories — dependency graphs, metrics, AI insights",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(analyses.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "environment": settings.ENVIRONMENT}
```

---

## STEP 4 — Alembic setup

### Run this inside the backend/ directory:
```bash
cd backend
pip install -r requirements.txt
alembic init alembic
```

### backend/alembic.ini — update this one line:
```ini
sqlalchemy.url = postgresql://postgres:postgres@localhost:5432/codeautopsy
```

### backend/alembic/env.py — replace the entire file with:
```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Import all models so Alembic can detect them
from app.core.database import Base
from app.models import user, analysis, file, dependency, pattern, metrics, insight  # noqa

from app.core.config import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Use sync URL for Alembic (strip +asyncpg)
SYNC_URL = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")


def run_migrations_offline() -> None:
    context.configure(
        url=SYNC_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = SYNC_URL
    connectable = async_engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### Generate and run the initial migration:
```bash
# While postgres is running (docker compose up postgres -d)
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

---

## STEP 5 — Frontend scaffold

### Run these commands from the project root:
```bash
cd frontend
npm create vite@latest . -- --template react
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios zustand react-router-dom @tanstack/react-query d3
npx shadcn-ui@latest init
```

### When shadcn/ui asks:
- Style: Default
- Base color: Slate
- CSS variables: Yes

### frontend/src/api/client.js
```javascript
import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Attach token to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`,
          { refresh_token: refresh }
        )
        localStorage.setItem('access_token', data.access_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return client(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default client
```

### frontend/src/store/authStore.js
```javascript
import { create } from 'zustand'

const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('access_token'),

  login: (user, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)
    localStorage.setItem('user', JSON.stringify(user))
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.clear()
    set({ user: null, isAuthenticated: false })
  },
}))

export default useAuthStore
```

### frontend/src/App.jsx
```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useAuthStore from './store/authStore'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Analysis from './pages/Analysis'

const queryClient = new QueryClient()

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/analysis/:id" element={<PrivateRoute><Analysis /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

### frontend/src/pages/Landing.jsx
```jsx
import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main style={{ padding: '4rem', textAlign: 'center' }}>
      <h1>🔬 CodeAutopsy</h1>
      <p>Analyze any GitHub repo. Get dependency graphs, quality metrics, and AI insights.</p>
      <Link to="/login">Get Started</Link>
    </main>
  )
}
```

### frontend/src/pages/Login.jsx
```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import useAuthStore from '../store/authStore'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const endpoint = isRegister ? '/api/v1/auth/register' : '/api/v1/auth/login'
      const { data } = await client.post(endpoint, { email, password })
      login(data.user, data.access_token, data.refresh_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong')
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '2rem' }}>
      <h2>{isRegister ? 'Create account' : 'Sign in'}</h2>
      <form onSubmit={handleSubmit}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8 }} />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: 10 }}>{isRegister ? 'Register' : 'Login'}</button>
      </form>
      <button onClick={() => setIsRegister(!isRegister)} style={{ marginTop: 12 }}>
        {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
      </button>
    </main>
  )
}
```

### frontend/src/pages/Dashboard.jsx
```jsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../api/client'
import useAuthStore from '../store/authStore'

export default function Dashboard() {
  const [analyses, setAnalyses] = useState([])
  const [repoUrl, setRepoUrl] = useState('')
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    client.get('/api/v1/analyses/').then(({ data }) => setAnalyses(data.analyses))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { data } = await client.post('/api/v1/analyses/', { repo_url: repoUrl })
    setRepoUrl('')
    navigate(`/analysis/${data.id}`)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Your Analyses</h2>
        <button onClick={() => { logout(); navigate('/') }}>Logout</button>
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, margin: '1.5rem 0' }}>
        <input
          type="url"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          required
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Analyze</button>
      </form>
      {analyses.length === 0 ? (
        <p>No analyses yet. Paste a GitHub URL above to start.</p>
      ) : (
        analyses.map(a => (
          <div key={a.id} onClick={() => navigate(`/analysis/${a.id}`)}
            style={{ border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 8, cursor: 'pointer' }}>
            <strong>{a.repo_name || a.repo_url}</strong>
            <span style={{ marginLeft: 8, opacity: 0.6 }}>{a.status} · {a.progress}%</span>
          </div>
        ))
      )}
    </main>
  )
}
```

### frontend/src/pages/Analysis.jsx
```jsx
import { useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import client from '../api/client'

export default function Analysis() {
  const { id } = useParams()
  const [analysis, setAnalysis] = useState(null)

  useEffect(() => {
    client.get(`/api/v1/analyses/${id}`).then(({ data }) => setAnalysis(data))
  }, [id])

  if (!analysis) return <p style={{ padding: '2rem' }}>Loading...</p>

  return (
    <main style={{ padding: '2rem' }}>
      <h2>{analysis.repo_name || analysis.repo_url}</h2>
      <p>Status: <strong>{analysis.status}</strong> ({analysis.progress}%)</p>
      <p style={{ opacity: 0.6 }}>Full graph and insights UI coming in Phase 3.</p>
    </main>
  )
}
```

### frontend/Dockerfile
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

---

## STEP 6 — Run and verify

```bash
# From project root
docker compose up --build

# In a second terminal — run migrations
docker compose exec backend alembic upgrade head

# Test the API
curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' | python3 -m json.tool
```

Expected response:
```json
{
  "user": { "id": "...", "email": "test@test.com" },
  "access_token": "eyJ...",
  "refresh_token": "eyJ..."
}
```

Then open http://localhost:5173 — you should see the Landing page and be able to register/login.

Also check API docs at http://localhost:8000/docs — all routes should be visible and testable.

---

## WHAT COMES NEXT (do NOT build in Phase 1)

Phase 2 prompt will cover:
- services/github.py — clone the repo
- services/ast_parser.py — Tree-sitter parsing
- services/metrics_engine.py — radon complexity
- services/graph_builder.py — dependency edges
- services/pattern_detector.py — design pattern detection
- services/llm_client.py — Groq/Ollama abstraction
- workers/analysis_job.py — the full pipeline
- SSE status stream endpoint
- Wiring BackgroundTasks into the analyses route

Phase 3 will cover the full frontend: D3 dependency graph, file tree, insights panels, progress overlay.
