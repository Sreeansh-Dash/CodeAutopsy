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
