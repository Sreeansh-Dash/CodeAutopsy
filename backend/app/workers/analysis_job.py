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
