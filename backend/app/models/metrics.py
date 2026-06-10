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
