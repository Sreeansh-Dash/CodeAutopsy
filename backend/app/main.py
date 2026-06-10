from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1 import auth, users, analyses, results

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
app.include_router(results.router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health_check():
    """Used by Render health checks and UptimeRobot keep-alive pings."""
    return {"status": "ok"}
