# CodeAutopsy — Phase 2 Agent Prompt
# Feed this entire file to your coding agent.
# Prerequisite: Phase 1 must be complete and working.
# Goal: the full analysis pipeline — clone → parse → graph → metrics → patterns → AI insights.
---

## YOUR TASK

Add the analysis engine to CodeAutopsy. When Phase 2 is done:
1. `POST /api/v1/analyses/` triggers a real background job
2. `GET /api/v1/analyses/:id/status` streams live progress via SSE
3. All result endpoints return real data: files, dependency graph, patterns, metrics, AI insights
4. Submitting `https://github.com/pallets/flask` (or any public Python repo) runs to completion

## CRITICAL RULES
- Do NOT modify or rewrite any Phase 1 files except the two listed under "Files to Update"
- Do NOT change models, auth, users, core/config, core/database, core/security
- Only ADD new files and UPDATE the two specified files
- If a file already exists with working code, leave it alone

---

## FILES TO CREATE (all new)

### backend/app/services/github.py
```python
import re
import shutil
from pathlib import Path
from typing import Optional

from git import Repo, GitCommandError
from github import Github, GithubException

from app.core.config import settings


def parse_github_url(url: str) -> tuple[str, str]:
    """Extract (owner, repo_name) from any GitHub URL format."""
    patterns = [
        r"github\.com[:/]([^/]+)/([^/\s.]+?)(?:\.git)?$",
        r"github\.com/([^/]+)/([^/\s?#]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url.strip())
        if match:
            return match.group(1), match.group(2).rstrip("/")
    raise ValueError(f"Cannot parse GitHub URL: {url}")


def clone_repo(repo_url: str, analysis_id: str) -> Path:
    """Shallow-clone a repository to /tmp/repos/{analysis_id}."""
    clone_path = Path(f"/tmp/repos/{analysis_id}")

    if clone_path.exists():
        shutil.rmtree(clone_path)
    clone_path.parent.mkdir(parents=True, exist_ok=True)

    # Inject token for private repos
    auth_url = repo_url
    if settings.GITHUB_TOKEN and "github.com" in repo_url:
        auth_url = repo_url.replace("https://", f"https://{settings.GITHUB_TOKEN}@")

    try:
        Repo.clone_from(auth_url, str(clone_path), depth=1, single_branch=True)
    except GitCommandError as e:
        raise RuntimeError(f"Failed to clone repository: {e}") from e

    return clone_path


def get_repo_metadata(owner: str, repo_name: str) -> dict:
    """Fetch repo metadata from GitHub API. Falls back gracefully if token missing."""
    try:
        g = Github(settings.GITHUB_TOKEN or None)
        repo = g.get_repo(f"{owner}/{repo_name}")
        return {
            "name": repo.name,
            "owner": repo.owner.login,
            "primary_language": repo.language,
        }
    except GithubException:
        return {"name": repo_name, "owner": owner, "primary_language": None}
    except Exception:
        return {"name": repo_name, "owner": owner, "primary_language": None}
```

### backend/app/services/ast_parser.py
```python
import os
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# Map file extensions to language names
LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cpp": "C++",
    ".c": "C",
    ".cs": "C#",
}

# Directories to skip entirely
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "vendor", ".mypy_cache", ".pytest_cache",
    "coverage", ".eggs", "*.egg-info",
}

# Extensions that are not source code
SKIP_EXTENSIONS = {
    ".json", ".md", ".txt", ".lock", ".yaml", ".yml", ".toml",
    ".cfg", ".ini", ".env", ".log", ".csv", ".xml", ".html",
    ".css", ".scss", ".sass", ".less", ".svg", ".png", ".jpg",
    ".gif", ".ico", ".woff", ".ttf", ".eot", ".map",
}


@dataclass
class ParsedFile:
    path: str               # relative path from repo root
    language: str
    lines_of_code: int
    imports: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    functions: list[str] = field(default_factory=list)
    raw_content: str = ""


def detect_language(file_path: Path) -> Optional[str]:
    return LANGUAGE_MAP.get(file_path.suffix.lower())


def count_loc(content: str) -> int:
    """Non-empty, non-comment lines."""
    count = 0
    for line in content.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("//"):
            count += 1
    return count


def extract_python_imports(content: str) -> list[str]:
    imports = []
    for line in content.splitlines():
        line = line.strip()
        m = re.match(r"^import\s+([\w.]+)", line)
        if m:
            imports.append(m.group(1))
            continue
        m = re.match(r"^from\s+([\w.]+)\s+import", line)
        if m:
            imports.append(m.group(1))
    return imports


def extract_js_imports(content: str) -> list[str]:
    imports = []
    for line in content.splitlines():
        stripped = line.strip()
        # ES6 import
        m = re.match(r"""^import\s+.*?from\s+['"](.+?)['"]""", stripped)
        if m:
            imports.append(m.group(1))
            continue
        # CommonJS require
        m = re.search(r"""require\s*\(\s*['"](.+?)['"]\s*\)""", stripped)
        if m:
            imports.append(m.group(1))
    return imports


def extract_python_definitions(content: str) -> tuple[list[str], list[str]]:
    classes = re.findall(r"^class\s+(\w+)", content, re.MULTILINE)
    functions = re.findall(r"^(?:    )?def\s+(\w+)", content, re.MULTILINE)
    return classes, functions


def parse_all_files(repo_path: Path) -> list[ParsedFile]:
    """Walk repo_path and parse every source file."""
    parsed = []

    for root, dirs, files in os.walk(repo_path):
        # Prune unwanted directories in-place
        dirs[:] = [
            d for d in dirs
            if d not in SKIP_DIRS and not d.startswith(".")
        ]

        for filename in files:
            file_path = Path(root) / filename

            if file_path.suffix.lower() in SKIP_EXTENSIONS:
                continue

            language = detect_language(file_path)
            if not language:
                continue

            # Skip very large files (> 500KB) — likely generated
            try:
                if file_path.stat().st_size > 500_000:
                    continue
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except (OSError, PermissionError):
                continue

            relative_path = str(file_path.relative_to(repo_path))
            loc = count_loc(content)

            if language == "Python":
                imports = extract_python_imports(content)
                classes, functions = extract_python_definitions(content)
            elif language in ("JavaScript", "TypeScript"):
                imports = extract_js_imports(content)
                classes, functions = [], []
            else:
                imports, classes, functions = [], [], []

            parsed.append(ParsedFile(
                path=relative_path,
                language=language,
                lines_of_code=loc,
                imports=imports,
                classes=classes,
                functions=functions,
                raw_content=content,
            ))

    return parsed
```

### backend/app/services/metrics_engine.py
```python
from app.services.ast_parser import ParsedFile

try:
    from radon.complexity import cc_visit
    from radon.metrics import mi_visit
    RADON_AVAILABLE = True
except ImportError:
    RADON_AVAILABLE = False


def calculate_file_complexity(content: str) -> tuple[float, Optional[float]]:
    """Returns (avg_cyclomatic_complexity, maintainability_index)."""
    if not RADON_AVAILABLE or not content.strip():
        return 0.0, None

    try:
        blocks = cc_visit(content)
        avg_cc = sum(b.complexity for b in blocks) / len(blocks) if blocks else 0.0
    except Exception:
        avg_cc = 0.0

    try:
        mi = mi_visit(content, multi=True)
    except Exception:
        mi = None

    return round(avg_cc, 2), mi


def calculate_metrics(parsed_files: list[ParsedFile]) -> dict:
    """Aggregate metrics for the whole repo."""
    total_files = len(parsed_files)
    total_loc = sum(f.lines_of_code for f in parsed_files)

    language_loc: dict[str, int] = {}
    complexity_scores: list[float] = []

    for pf in parsed_files:
        # Language distribution
        language_loc[pf.language] = language_loc.get(pf.language, 0) + pf.lines_of_code

        # Complexity (Python only via radon)
        if pf.language == "Python" and RADON_AVAILABLE and pf.raw_content:
            try:
                blocks = cc_visit(pf.raw_content)
                if blocks:
                    avg = sum(b.complexity for b in blocks) / len(blocks)
                    complexity_scores.append(avg)
            except Exception:
                pass

    # Language percentages
    lang_pct: dict[str, float] = {}
    if total_loc > 0:
        for lang, loc in language_loc.items():
            lang_pct[lang] = round((loc / total_loc) * 100, 1)

    avg_complexity = round(
        sum(complexity_scores) / len(complexity_scores), 2
    ) if complexity_scores else 0.0

    max_complexity = round(max(complexity_scores), 2) if complexity_scores else 0.0

    # Quality score: starts at 100, deducted for high complexity
    quality_score = max(0, min(100, int(
        100
        - (avg_complexity * 4)
        - (max_complexity * 1.5)
        - (max(0, total_files - 100) * 0.05)
    )))

    return {
        "total_files": total_files,
        "total_lines_of_code": total_loc,
        "avg_complexity": avg_complexity,
        "max_complexity": max_complexity,
        "technical_debt_hours": round(avg_complexity * total_files * 0.1, 1),
        "code_duplication_pct": 0.0,
        "test_coverage_pct": None,
        "languages": lang_pct,
        "quality_score": quality_score,
    }


# Fix missing Optional import
from typing import Optional
```

### backend/app/services/graph_builder.py
```python
from dataclasses import dataclass
from app.services.ast_parser import ParsedFile


@dataclass
class DependencyEdge:
    from_path: str
    to_path: str
    dep_type: str = "import"


def resolve_import(import_str: str, all_paths: set[str]) -> str | None:
    """
    Try to resolve a Python import string like 'app.models.user'
    to an actual file path like 'app/models/user.py'.
    """
    candidates = [
        import_str.replace(".", "/") + ".py",
        import_str.replace(".", "/") + "/__init__.py",
    ]
    for candidate in candidates:
        if candidate in all_paths:
            return candidate
    return None


def build_dependency_edges(parsed_files: list[ParsedFile]) -> list[DependencyEdge]:
    """Build directed import edges between files."""
    all_paths = {f.path for f in parsed_files}
    # Normalize path separators
    all_paths_normalized = {p.replace("\\", "/") for p in all_paths}

    edges = []
    seen = set()  # deduplicate edges

    for pf in parsed_files:
        from_path = pf.path.replace("\\", "/")

        for import_str in pf.imports:
            # Only try to resolve internal imports
            if import_str.startswith(".") or not import_str:
                continue

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

### backend/app/services/pattern_detector.py
```python
import re
from dataclasses import dataclass
from app.services.ast_parser import ParsedFile


@dataclass
class DetectedPattern:
    pattern_name: str
    file_path: str
    confidence_score: float
    description: str
    line_start: int = 0
    line_end: int = 0


def _detect_singleton(content: str, file_path: str) -> DetectedPattern | None:
    hits = 0
    if re.search(r"_instance\s*=\s*None", content):
        hits += 1
    if "__new__" in content:
        hits += 1
    if re.search(r"@classmethod", content) and re.search(r"def\s+get_instance|def\s+instance", content):
        hits += 1
    if hits >= 2:
        return DetectedPattern(
            pattern_name="Singleton",
            file_path=file_path,
            confidence_score=round(hits / 3, 2),
            description="Class controls its own instantiation with a single shared instance",
        )
    return None


def _detect_factory(content: str, file_path: str, classes: list[str]) -> DetectedPattern | None:
    hits = 0
    if re.search(r"@(classmethod|staticmethod)", content):
        hits += 1
    if re.search(r"def\s+(create|make|build|get|produce)\w*\s*\(", content):
        hits += 1
    if len(classes) >= 2:
        hits += 1
    if hits >= 2:
        return DetectedPattern(
            pattern_name="Factory",
            file_path=file_path,
            confidence_score=round(hits / 3, 2),
            description="Method or class responsible for creating and returning object instances",
        )
    return None


def _detect_repository(functions: list[str]) -> bool:
    crud = {"get", "get_all", "find", "find_by", "create", "save", "update", "delete", "remove"}
    return len(crud.intersection(set(functions))) >= 3


def _detect_observer(content: str) -> bool:
    keywords = ["subscribe", "unsubscribe", "notify", "listeners", "observers", "dispatch", "emit", "on_event"]
    return sum(1 for kw in keywords if kw in content) >= 2


def _detect_decorator_pattern(content: str, classes: list[str]) -> bool:
    """Detect structural Decorator (not Python @decorator syntax)."""
    return (
        len(classes) >= 2
        and "__init__" in content
        and re.search(r"self\.\w+\s*=\s*\w+", content) is not None
        and re.search(r"def\s+\w+.*:\s*\n\s+.*self\.\w+\.\w+", content) is not None
    )


def detect_patterns(parsed_files: list[ParsedFile]) -> list[DetectedPattern]:
    results = []

    for pf in parsed_files:
        if pf.language != "Python":
            continue

        content = pf.raw_content

        p = _detect_singleton(content, pf.path)
        if p:
            results.append(p)

        p = _detect_factory(content, pf.path, pf.classes)
        if p:
            results.append(p)

        if _detect_repository(pf.functions):
            results.append(DetectedPattern(
                pattern_name="Repository",
                file_path=pf.path,
                confidence_score=0.85,
                description="Data access layer implementing CRUD operations",
            ))

        if _detect_observer(content):
            results.append(DetectedPattern(
                pattern_name="Observer",
                file_path=pf.path,
                confidence_score=0.75,
                description="Publish-subscribe event notification pattern",
            ))

        if _detect_decorator_pattern(content, pf.classes):
            results.append(DetectedPattern(
                pattern_name="Decorator",
                file_path=pf.path,
                confidence_score=0.65,
                description="Wraps objects to extend behaviour without subclassing",
            ))

    return results
```

### backend/app/services/llm_client.py
```python
from app.core.config import settings

PROMPTS = {
    "summary": """\
You are a senior software engineer. Analyze this codebase and write a 2-3 sentence summary.

Repository: {repo_name}
Files: {total_files} | Lines of code: {total_loc}
Primary language: {primary_language}
Languages: {languages}
Quality score: {quality_score}/100

Write a concise technical summary covering what the codebase does and its overall health.""",

    "architecture": """\
Describe the architecture of this codebase in 3-4 sentences.

Top files by size: {top_files}
Dependency summary: {dependency_summary}
Detected patterns: {patterns}

Focus on: main layers, key components, and how they interact.""",

    "quality": """\
Give a quality assessment for this codebase. Be specific and direct.

Average cyclomatic complexity: {avg_complexity}
Max cyclomatic complexity: {max_complexity}
Quality score: {quality_score}/100
Estimated technical debt: {debt_hours} hours

Identify the top 2-3 quality concerns in 3-4 sentences.""",

    "recommendations": """\
Provide 3 specific, actionable improvement recommendations for this codebase.

Quality score: {quality_score}/100
Avg complexity: {avg_complexity}
Detected patterns: {patterns}
Most complex files: {complex_files}

Format as a numbered list. Be concrete, not generic.""",
}


class LLMClient:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER

        if self.provider == "groq":
            try:
                import groq
                self._client = groq.Groq(api_key=settings.GROQ_API_KEY)
                self._model = settings.GROQ_MODEL
            except Exception as e:
                print(f"Groq init failed: {e}. Falling back to mock.")
                self.provider = "mock"

    def generate(self, prompt: str, max_tokens: int = 600) -> str:
        if self.provider == "mock":
            return f"[Mock insight — configure LLM_PROVIDER in .env to enable AI]"

        if self.provider == "groq":
            try:
                resp = self._client.chat.completions.create(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=0.3,
                )
                return resp.choices[0].message.content
            except Exception as e:
                return f"[Groq error: {e}]"

        if self.provider == "ollama":
            try:
                import httpx
                resp = httpx.post(
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False},
                    timeout=120.0,
                )
                return resp.json()["response"]
            except Exception as e:
                return f"[Ollama error: {e}]"

        return "[No LLM provider configured]"


llm_client = LLMClient()


def generate_all_insights(
    repo_name: str,
    metrics: dict,
    patterns: list,
    top_files: list,
    dependency_summary: str,
) -> dict[str, str]:
    primary_language = (
        max(metrics.get("languages", {}).items(), key=lambda x: x[1])[0]
        if metrics.get("languages")
        else "Unknown"
    )
    complex_files = [
        f.path for f in sorted(top_files, key=lambda x: x.lines_of_code, reverse=True)[:3]
    ]

    results = {}
    for section, template in PROMPTS.items():
        try:
            prompt = template.format(
                repo_name=repo_name,
                total_files=metrics.get("total_files", 0),
                total_loc=metrics.get("total_lines_of_code", 0),
                primary_language=primary_language,
                languages=metrics.get("languages", {}),
                quality_score=metrics.get("quality_score", 0),
                avg_complexity=metrics.get("avg_complexity", 0),
                max_complexity=metrics.get("max_complexity", 0),
                debt_hours=metrics.get("technical_debt_hours", 0),
                top_files=[f.path for f in top_files[:5]],
                dependency_summary=dependency_summary,
                patterns=[p.pattern_name for p in patterns],
                complex_files=complex_files,
            )
            results[section] = llm_client.generate(prompt)
        except Exception as e:
            results[section] = f"Could not generate {section}: {e}"

    return results
```

### backend/app/workers/analysis_job.py
```python
"""
Main analysis pipeline.
Called via FastAPI BackgroundTasks — runs in a thread pool.
Uses asyncio.run() to operate async SQLAlchemy from a sync thread context.
"""
import asyncio
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.analysis import Analysis
from app.models.file import File
from app.models.dependency import Dependency
from app.models.pattern import Pattern
from app.models.metrics import Metrics as MetricsModel
from app.models.insight import Insight
from app.services.github import clone_repo, parse_github_url, get_repo_metadata
from app.services.ast_parser import parse_all_files
from app.services.metrics_engine import calculate_metrics, calculate_file_complexity
from app.services.graph_builder import build_dependency_edges
from app.services.pattern_detector import detect_patterns
from app.services.llm_client import generate_all_insights


async def _set_status(analysis_id: uuid.UUID, status: str, progress: int, error: str = None):
    async with AsyncSessionLocal() as db:
        analysis = await db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = status
            analysis.progress = progress
            if error is not None:
                analysis.error_message = error
            await db.commit()


async def _run(analysis_id: uuid.UUID):
    # Fetch the analysis row
    async with AsyncSessionLocal() as db:
        analysis = await db.get(Analysis, analysis_id)
        if not analysis:
            return
        repo_url = analysis.repo_url

    repo_path = None

    try:
        # ── 1. Clone ──────────────────────────────────────────────
        await _set_status(analysis_id, "cloning", 5)

        owner, repo_name_str = parse_github_url(repo_url)
        metadata = get_repo_metadata(owner, repo_name_str)

        async with AsyncSessionLocal() as db:
            a = await db.get(Analysis, analysis_id)
            a.repo_name = metadata["name"]
            a.repo_owner = metadata["owner"]
            a.primary_language = metadata["primary_language"]
            await db.commit()

        repo_path = clone_repo(repo_url, str(analysis_id))

        # ── 2. Parse files ────────────────────────────────────────
        await _set_status(analysis_id, "parsing", 20)
        parsed_files = parse_all_files(repo_path)

        if not parsed_files:
            raise ValueError("No source files found in repository")

        # ── 3. Insert files ───────────────────────────────────────
        await _set_status(analysis_id, "parsing", 35)

        async with AsyncSessionLocal() as db:
            for pf in parsed_files:
                if pf.language == "Python":
                    complexity, mi = calculate_file_complexity(pf.raw_content)
                else:
                    complexity, mi = 0.0, None

                db.add(File(
                    analysis_id=analysis_id,
                    path=pf.path,
                    language=pf.language,
                    lines_of_code=pf.lines_of_code,
                    complexity_score=complexity,
                    maintainability_index=mi,
                ))
            await db.commit()

        # ── 4. Build dependency edges ─────────────────────────────
        await _set_status(analysis_id, "analyzing", 50)
        edges = build_dependency_edges(parsed_files)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(File).where(File.analysis_id == analysis_id)
            )
            db_files = {f.path: f for f in result.scalars().all()}

            for edge in edges:
                src = db_files.get(edge.from_path)
                dst = db_files.get(edge.to_path)
                if src and dst:
                    db.add(Dependency(
                        analysis_id=analysis_id,
                        from_file_id=src.id,
                        to_file_id=dst.id,
                        dep_type=edge.dep_type,
                    ))
            await db.commit()

        # ── 5. Aggregate metrics ──────────────────────────────────
        await _set_status(analysis_id, "analyzing", 62)
        metrics_data = calculate_metrics(parsed_files)

        async with AsyncSessionLocal() as db:
            db.add(MetricsModel(analysis_id=analysis_id, **metrics_data))
            await db.commit()

        # ── 6. Detect design patterns ─────────────────────────────
        await _set_status(analysis_id, "analyzing", 74)
        patterns = detect_patterns(parsed_files)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(File).where(File.analysis_id == analysis_id)
            )
            files_by_path = {f.path: f for f in result.scalars().all()}

            for p in patterns:
                file_obj = files_by_path.get(p.file_path)
                db.add(Pattern(
                    analysis_id=analysis_id,
                    file_id=file_obj.id if file_obj else None,
                    pattern_name=p.pattern_name,
                    confidence_score=p.confidence_score,
                    description=p.description,
                ))
            await db.commit()

        # ── 7. AI insights ────────────────────────────────────────
        await _set_status(analysis_id, "analyzing", 82)

        async with AsyncSessionLocal() as db:
            a = await db.get(Analysis, analysis_id)
            display_name = a.repo_name or repo_url

        dep_summary = f"{len(edges)} dependency edges across {len(parsed_files)} files"
        top_files = sorted(parsed_files, key=lambda x: x.lines_of_code, reverse=True)[:10]

        insights = generate_all_insights(
            repo_name=display_name,
            metrics=metrics_data,
            patterns=patterns,
            top_files=top_files,
            dependency_summary=dep_summary,
        )

        async with AsyncSessionLocal() as db:
            for section, content in insights.items():
                db.add(Insight(
                    analysis_id=analysis_id,
                    section=section,
                    content=content,
                ))
            a = await db.get(Analysis, analysis_id)
            a.status = "complete"
            a.progress = 100
            a.completed_at = datetime.now(timezone.utc)
            await db.commit()

    except Exception as exc:
        await _set_status(analysis_id, "failed", 0, str(exc))

    finally:
        if repo_path is not None and Path(str(repo_path)).exists():
            shutil.rmtree(str(repo_path), ignore_errors=True)


def run_analysis(analysis_id: uuid.UUID):
    """Sync entry point — called by FastAPI BackgroundTasks in a thread pool."""
    asyncio.run(_run(analysis_id))
```

### backend/app/api/v1/results.py
```python
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.models.file import File
from app.models.dependency import Dependency
from app.models.pattern import Pattern
from app.models.metrics import Metrics
from app.models.insight import Insight

router = APIRouter(tags=["results"])


async def _get_complete_analysis(
    analysis_id: uuid.UUID,
    current_user: User,
    db: AsyncSession,
) -> Analysis:
    analysis = await db.get(Analysis, analysis_id)
    if not analysis or analysis.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Analysis not found")
    if analysis.status != "complete":
        raise HTTPException(
            status_code=400,
            detail=f"Analysis not ready (status: {analysis.status}, progress: {analysis.progress}%)",
        )
    return analysis


@router.get("/analyses/{analysis_id}/files")
async def get_files(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_complete_analysis(analysis_id, current_user, db)

    result = await db.execute(select(File).where(File.analysis_id == analysis_id))
    files = result.scalars().all()

    return {
        "files": [
            {
                "id": str(f.id),
                "path": f.path,
                "language": f.language,
                "lines_of_code": f.lines_of_code,
                "complexity_score": f.complexity_score,
                "maintainability_index": f.maintainability_index,
            }
            for f in sorted(files, key=lambda x: x.lines_of_code, reverse=True)
        ],
        "total": len(files),
    }


@router.get("/analyses/{analysis_id}/dependencies")
async def get_dependencies(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_complete_analysis(analysis_id, current_user, db)

    files_result = await db.execute(select(File).where(File.analysis_id == analysis_id))
    files = files_result.scalars().all()

    deps_result = await db.execute(select(Dependency).where(Dependency.analysis_id == analysis_id))
    deps = deps_result.scalars().all()

    # D3 force graph format
    nodes = [
        {
            "id": str(f.id),
            "label": f.path.split("/")[-1],
            "path": f.path,
            "language": f.language,
            "size": f.lines_of_code,
            "complexity": f.complexity_score,
        }
        for f in files
    ]

    edges = [
        {
            "source": str(d.from_file_id),
            "target": str(d.to_file_id),
            "type": d.dep_type,
        }
        for d in deps
    ]

    return {"nodes": nodes, "edges": edges}


@router.get("/analyses/{analysis_id}/patterns")
async def get_patterns(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_complete_analysis(analysis_id, current_user, db)

    result = await db.execute(select(Pattern).where(Pattern.analysis_id == analysis_id))
    patterns = result.scalars().all()

    files_result = await db.execute(select(File).where(File.analysis_id == analysis_id))
    files = {f.id: f.path for f in files_result.scalars().all()}

    return {
        "patterns": [
            {
                "id": str(p.id),
                "pattern_name": p.pattern_name,
                "confidence_score": p.confidence_score,
                "file_path": files.get(p.file_id, ""),
                "description": p.description,
            }
            for p in sorted(patterns, key=lambda x: x.confidence_score, reverse=True)
        ]
    }


@router.get("/analyses/{analysis_id}/metrics")
async def get_metrics(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_complete_analysis(analysis_id, current_user, db)

    result = await db.execute(select(Metrics).where(Metrics.analysis_id == analysis_id))
    metrics = result.scalar_one_or_none()

    if not metrics:
        raise HTTPException(status_code=404, detail="Metrics not found")

    return {
        "total_files": metrics.total_files,
        "total_lines_of_code": metrics.total_lines_of_code,
        "avg_complexity": metrics.avg_complexity,
        "max_complexity": metrics.max_complexity,
        "technical_debt_hours": metrics.technical_debt_hours,
        "code_duplication_pct": metrics.code_duplication_pct,
        "test_coverage_pct": metrics.test_coverage_pct,
        "languages": metrics.languages,
        "quality_score": metrics.quality_score,
    }


@router.get("/analyses/{analysis_id}/insights")
async def get_insights(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_complete_analysis(analysis_id, current_user, db)

    result = await db.execute(select(Insight).where(Insight.analysis_id == analysis_id))
    insights = result.scalars().all()

    return {i.section: i.content for i in insights}
```

---

## FILES TO UPDATE (edit existing files — do not rewrite from scratch)

### UPDATE backend/app/api/v1/analyses.py

Replace the existing `create_analysis` function and add the SSE endpoint.
Do NOT touch list_analyses, get_analysis, or delete_analysis.

Add this import at the top:
```python
import asyncio
import json
from fastapi.responses import StreamingResponse
from app.workers.analysis_job import run_analysis
```

Replace the `create_analysis` function with:
```python
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

    background_tasks.add_task(run_analysis, analysis.id)

    return {
        "id": str(analysis.id),
        "status": analysis.status,
        "progress": analysis.progress,
        "created_at": analysis.created_at.isoformat(),
    }
```

Add this new endpoint (after delete_analysis):
```python
STATUS_MESSAGES = {
    "queued":    "Waiting to start...",
    "cloning":   "Cloning repository...",
    "parsing":   "Parsing source files...",
    "analyzing": "Running analysis pipeline...",
    "complete":  "Analysis complete",
    "failed":    "Analysis failed",
}

@router.get("/{analysis_id}/status")
async def stream_status(
    analysis_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def generator():
        while True:
            analysis = await db.get(Analysis, analysis_id)
            if not analysis or analysis.user_id != current_user.id:
                yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                break

            payload = json.dumps({
                "status": analysis.status,
                "progress": analysis.progress,
                "message": STATUS_MESSAGES.get(analysis.status, ""),
                "error": analysis.error_message,
            })
            yield f"data: {payload}\n\n"

            if analysis.status in ("complete", "failed"):
                break

            await asyncio.sleep(1.5)

    return StreamingResponse(generator(), media_type="text/event-stream")
```

### UPDATE backend/app/main.py

Add the results router. Change the router import line to:
```python
from app.api.v1 import auth, users, analyses, results
```

Add this line after the existing include_router calls:
```python
app.include_router(results.router, prefix="/api/v1")
```

---

## STEP: Rebuild and verify

```bash
docker compose up --build -d
```

Test the full pipeline with a small public repo:
```bash
# 1. Register / login to get a token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Submit a repo for analysis
ANALYSIS_ID=$(curl -s -X POST http://localhost:8000/api/v1/analyses/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"repo_url":"https://github.com/pallets/flask"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Analysis ID: $ANALYSIS_ID"

# 3. Poll status until complete (or watch via SSE)
watch -n 2 "curl -s http://localhost:8000/api/v1/analyses/$ANALYSIS_ID \
  -H 'Authorization: Bearer $TOKEN' | python3 -m json.tool"

# 4. Once status == 'complete', check the results
curl -s http://localhost:8000/api/v1/analyses/$ANALYSIS_ID/metrics \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

curl -s http://localhost:8000/api/v1/analyses/$ANALYSIS_ID/insights \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Expected: metrics shows files/LoC/quality_score, insights shows 4 sections of AI text.

Also check the API docs for all new endpoints: http://localhost:8000/docs

---

## WHAT IS NOT BUILT YET (Phase 3)

Phase 3 will replace the basic React pages with the full frontend:
- D3 force-directed dependency graph (interactive, zoomable, filterable)
- File tree with language icons and complexity highlights
- Live progress overlay (SSE-powered, 0-100% bar)
- Insights, Patterns, and Metrics panels
- Quality score badge
