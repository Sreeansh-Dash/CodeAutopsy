import re
from dataclasses import dataclass
from app.services.ast_parser import ParsedFile


@dataclass
class DetectedPattern:
    pattern_name: str
    file_path: str
    confidence_score: float
    description: str
    line_start: int = 0
    line_end: int = 0


def _detect_singleton(content: str, file_path: str) -> DetectedPattern | None:
    hits = 0
    if re.search(r"_instance\s*=\s*None", content):
        hits += 1
    if "__new__" in content:
        hits += 1
    if re.search(r"@classmethod", content) and re.search(r"def\s+get_instance|def\s+instance", content):
        hits += 1
    if hits >= 2:
        return DetectedPattern(
            pattern_name="Singleton",
            file_path=file_path,
            confidence_score=round(hits / 3, 2),
            description="Class controls its own instantiation with a single shared instance",
        )
    return None


def _detect_factory(content: str, file_path: str, classes: list[str]) -> DetectedPattern | None:
    hits = 0
    if re.search(r"@(classmethod|staticmethod)", content):
        hits += 1
    if re.search(r"def\s+(create|make|build|get|produce)\w*\s*\(", content):
        hits += 1
    if len(classes) >= 2:
        hits += 1
    if hits >= 2:
        return DetectedPattern(
            pattern_name="Factory",
            file_path=file_path,
            confidence_score=round(hits / 3, 2),
            description="Method or class responsible for creating and returning object instances",
        )
    return None


def _detect_repository(functions: list[str]) -> bool:
    crud = {"get", "get_all", "find", "find_by", "create", "save", "update", "delete", "remove"}
    return len(crud.intersection(set(functions))) >= 3


def _detect_observer(content: str) -> bool:
    keywords = ["subscribe", "unsubscribe", "notify", "listeners", "observers", "dispatch", "emit", "on_event"]
    return sum(1 for kw in keywords if kw in content) >= 2


def _detect_decorator_pattern(content: str, classes: list[str]) -> bool:
    """Detect structural Decorator (not Python @decorator syntax)."""
    return (
        len(classes) >= 2
        and "__init__" in content
        and re.search(r"self\.\w+\s*=\s*\w+", content) is not None
        and re.search(r"def\s+\w+.*:\s*\n\s+.*self\.\w+\.\w+", content) is not None
    )


def detect_patterns(parsed_files: list[ParsedFile]) -> list[DetectedPattern]:
    results = []

    for pf in parsed_files:
        if pf.language != "Python":
            continue

        content = pf.raw_content

        p = _detect_singleton(content, pf.path)
        if p:
            results.append(p)

        p = _detect_factory(content, pf.path, pf.classes)
        if p:
            results.append(p)

        if _detect_repository(pf.functions):
            results.append(DetectedPattern(
                pattern_name="Repository",
                file_path=pf.path,
                confidence_score=0.85,
                description="Data access layer implementing CRUD operations",
            ))

        if _detect_observer(content):
            results.append(DetectedPattern(
                pattern_name="Observer",
                file_path=pf.path,
                confidence_score=0.75,
                description="Publish-subscribe event notification pattern",
            ))

        if _detect_decorator_pattern(content, pf.classes):
            results.append(DetectedPattern(
                pattern_name="Decorator",
                file_path=pf.path,
                confidence_score=0.65,
                description="Wraps objects to extend behaviour without subclassing",
            ))

    return results
