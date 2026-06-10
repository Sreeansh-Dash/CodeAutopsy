import os
import re
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional

# Map file extensions to language names
LANGUAGE_MAP = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cpp": "C++",
    ".c": "C",
    ".cs": "C#",
}

# Directories to skip entirely
SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".next", "vendor", ".mypy_cache", ".pytest_cache",
    "coverage", ".eggs", "*.egg-info",
}

# Extensions that are not source code
SKIP_EXTENSIONS = {
    ".json", ".md", ".txt", ".lock", ".yaml", ".yml", ".toml",
    ".cfg", ".ini", ".env", ".log", ".csv", ".xml", ".html",
    ".css", ".scss", ".sass", ".less", ".svg", ".png", ".jpg",
    ".gif", ".ico", ".woff", ".ttf", ".eot", ".map",
}


@dataclass
class ParsedFile:
    path: str               # relative path from repo root
    language: str
    lines_of_code: int
    imports: list[str] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    functions: list[str] = field(default_factory=list)
    raw_content: str = ""


def detect_language(file_path: Path) -> Optional[str]:
    return LANGUAGE_MAP.get(file_path.suffix.lower())


def count_loc(content: str) -> int:
    """Non-empty, non-comment lines."""
    count = 0
    for line in content.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("//"):
            count += 1
    return count


def extract_python_imports(content: str) -> list[str]:
    imports = []
    for line in content.splitlines():
        line = line.strip()
        # Relative imports: from . import x  /  from .module import y
        m = re.match(r"^from\s+(\.+\w*)\s+import", line)
        if m:
            imports.append(m.group(1))
            continue
        m = re.match(r"^import\s+([\w.]+)", line)
        if m:
            imports.append(m.group(1))
            continue
        m = re.match(r"^from\s+([\w.]+)\s+import", line)
        if m:
            imports.append(m.group(1))
    return imports



def extract_js_imports(content: str) -> list[str]:
    imports = []
    for line in content.splitlines():
        stripped = line.strip()
        # ES6 import
        m = re.match(r"""^import\s+.*?from\s+['"](.+?)['"]""", stripped)
        if m:
            imports.append(m.group(1))
            continue
        # CommonJS require
        m = re.search(r"""require\s*\(\s*['"](.+?)['"]\s*\)""", stripped)
        if m:
            imports.append(m.group(1))
    return imports


def extract_python_definitions(content: str) -> tuple[list[str], list[str]]:
    classes = re.findall(r"^class\s+(\w+)", content, re.MULTILINE)
    functions = re.findall(r"^(?:    )?def\s+(\w+)", content, re.MULTILINE)
    return classes, functions


def parse_all_files(repo_path: Path) -> list[ParsedFile]:
    """Walk repo_path and parse every source file."""
    parsed = []

    for root, dirs, files in os.walk(repo_path):
        # Prune unwanted directories in-place
        dirs[:] = [
            d for d in dirs
            if d not in SKIP_DIRS and not d.startswith(".")
        ]

        for filename in files:
            file_path = Path(root) / filename

            if file_path.suffix.lower() in SKIP_EXTENSIONS:
                continue

            language = detect_language(file_path)
            if not language:
                continue

            # Skip very large files (> 500KB) — likely generated
            try:
                if file_path.stat().st_size > 500_000:
                    continue
                content = file_path.read_text(encoding="utf-8", errors="ignore")
            except (OSError, PermissionError):
                continue

            relative_path = str(file_path.relative_to(repo_path))
            loc = count_loc(content)

            if language == "Python":
                imports = extract_python_imports(content)
                classes, functions = extract_python_definitions(content)
            elif language in ("JavaScript", "TypeScript"):
                imports = extract_js_imports(content)
                classes, functions = [], []
            else:
                imports, classes, functions = [], [], []

            parsed.append(ParsedFile(
                path=relative_path,
                language=language,
                lines_of_code=loc,
                imports=imports,
                classes=classes,
                functions=functions,
                raw_content=content,
            ))

    return parsed
