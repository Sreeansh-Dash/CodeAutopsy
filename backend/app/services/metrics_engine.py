from typing import Optional
from app.services.ast_parser import ParsedFile

try:
    from radon.complexity import cc_visit
    from radon.metrics import mi_visit
    RADON_AVAILABLE = True
except ImportError:
    RADON_AVAILABLE = False


def calculate_file_complexity(content: str) -> tuple[float, Optional[float]]:
    """Returns (avg_cyclomatic_complexity, maintainability_index)."""
    if not RADON_AVAILABLE or not content.strip():
        return 0.0, None

    try:
        blocks = cc_visit(content)
        avg_cc = sum(b.complexity for b in blocks) / len(blocks) if blocks else 0.0
    except Exception:
        avg_cc = 0.0

    try:
        mi = mi_visit(content, multi=True)
    except Exception:
        mi = None

    return round(avg_cc, 2), mi


def calculate_metrics(parsed_files: list[ParsedFile]) -> dict:
    """Aggregate metrics for the whole repo."""
    total_files = len(parsed_files)
    total_loc = sum(f.lines_of_code for f in parsed_files)

    language_loc: dict[str, int] = {}
    complexity_scores: list[float] = []

    for pf in parsed_files:
        # Language distribution
        language_loc[pf.language] = language_loc.get(pf.language, 0) + pf.lines_of_code

        # Complexity (Python only via radon)
        if pf.language == "Python" and RADON_AVAILABLE and pf.raw_content:
            try:
                blocks = cc_visit(pf.raw_content)
                if blocks:
                    avg = sum(b.complexity for b in blocks) / len(blocks)
                    complexity_scores.append(avg)
            except Exception:
                pass

    # Language percentages
    lang_pct: dict[str, float] = {}
    if total_loc > 0:
        for lang, loc in language_loc.items():
            lang_pct[lang] = round((loc / total_loc) * 100, 1)

    avg_complexity = round(
        sum(complexity_scores) / len(complexity_scores), 2
    ) if complexity_scores else 0.0

    max_complexity = round(max(complexity_scores), 2) if complexity_scores else 0.0

    # Quality score: starts at 100, deducted for high complexity
    quality_score = max(0, min(100, int(
        100
        - (avg_complexity * 4)
        - (max_complexity * 1.5)
        - (max(0, total_files - 100) * 0.05)
    )))

    return {
        "total_files": total_files,
        "total_lines_of_code": total_loc,
        "avg_complexity": avg_complexity,
        "max_complexity": max_complexity,
        "technical_debt_hours": round(avg_complexity * total_files * 0.1, 1),
        "code_duplication_pct": 0.0,
        "test_coverage_pct": None,
        "languages": lang_pct,
        "quality_score": quality_score,
    }
