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
