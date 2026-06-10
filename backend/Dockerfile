FROM python:3.11-slim

WORKDIR /app

# git is required by gitpython to clone repositories
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Working directory for cloned repos (ephemeral, fine for containers)
RUN mkdir -p /tmp/repos

EXPOSE 8000

# Render injects $PORT; fall back to 8000 for local docker compose
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
