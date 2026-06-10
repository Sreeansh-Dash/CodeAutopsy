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
