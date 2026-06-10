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
