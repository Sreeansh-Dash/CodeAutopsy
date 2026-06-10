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
