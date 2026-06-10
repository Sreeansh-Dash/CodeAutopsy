from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.analysis import Analysis
from app.schemas.analysis import AnalysisCreate
import uuid
import asyncio
import json
from fastapi.responses import StreamingResponse

from app.workers.analysis_job import _run

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

    background_tasks.add_task(_run, analysis.id)

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
