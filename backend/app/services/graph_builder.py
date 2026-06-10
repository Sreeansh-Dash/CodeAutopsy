from dataclasses import dataclass
from app.services.ast_parser import ParsedFile


@dataclass
class DependencyEdge:
    from_path: str
    to_path: str
    dep_type: str = "import"


def resolve_import(import_str: str, all_paths: set[str]) -> str | None:
    """
    Try to resolve a Python import string like 'app.models.user'
    to an actual file path like 'app/models/user.py'.
    """
    candidates = [
        import_str.replace(".", "/") + ".py",
        import_str.replace(".", "/") + "/__init__.py",
    ]
    for candidate in candidates:
        if candidate in all_paths:
            return candidate
    return None


def _resolve_relative(import_str: str, from_path: str, all_paths: set[str]) -> str | None:
    """Resolve a relative import like '.' or '.helpers' from the importing file's directory."""
    parts = from_path.replace("\\", "/").split("/")
    # Count leading dots to find how many directory levels to go up
    dots = len(import_str) - len(import_str.lstrip("."))
    base_parts = parts[:-(dots)]  # directory of the importing file, n levels up
    suffix = import_str.lstrip(".")
    if suffix:
        candidates = [
            "/".join(base_parts + [suffix.replace(".", "/")]) + ".py",
            "/".join(base_parts + [suffix.replace(".", "/"), "__init__.py"]),
        ]
    else:
        candidates = [
            "/".join(base_parts + ["__init__.py"]),
        ]
    for c in candidates:
        if c in all_paths:
            return c
    return None


def build_dependency_edges(parsed_files: list[ParsedFile]) -> list[DependencyEdge]:
    """Build directed import edges between files."""
    all_paths_normalized = {f.path.replace("\\", "/") for f in parsed_files}
    edges = []
    seen = set()

    for pf in parsed_files:
        from_path = pf.path.replace("\\", "/")

        for import_str in pf.imports:
            if not import_str:
                continue

            if import_str.startswith("."):
                # Relative import
                resolved = _resolve_relative(import_str, from_path, all_paths_normalized)
            else:
                # Absolute import
                resolved = resolve_import(import_str, all_paths_normalized)

            if resolved and resolved != from_path:
                key = (from_path, resolved)
                if key not in seen:
                    seen.add(key)
                    edges.append(DependencyEdge(
                        from_path=from_path,
                        to_path=resolved,
                        dep_type="import",
                    ))

    return edges

