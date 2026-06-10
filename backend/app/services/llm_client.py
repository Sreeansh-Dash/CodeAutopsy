from app.core.config import settings

PROMPTS = {
    "summary": """\
You are a senior software engineer. Analyze this codebase and write a 2-3 sentence summary.

Repository: {repo_name}
Files: {total_files} | Lines of code: {total_loc}
Primary language: {primary_language}
Languages: {languages}
Quality score: {quality_score}/100

Write a concise technical summary covering what the codebase does and its overall health.""",

    "architecture": """\
Describe the architecture of this codebase in 3-4 sentences.

Top files by size: {top_files}
Dependency summary: {dependency_summary}
Detected patterns: {patterns}

Focus on: main layers, key components, and how they interact.""",

    "quality": """\
Give a quality assessment for this codebase. Be specific and direct.

Average cyclomatic complexity: {avg_complexity}
Max cyclomatic complexity: {max_complexity}
Quality score: {quality_score}/100
Estimated technical debt: {debt_hours} hours

Identify the top 2-3 quality concerns in 3-4 sentences.""",

    "recommendations": """\
Provide 3 specific, actionable improvement recommendations for this codebase.

Quality score: {quality_score}/100
Avg complexity: {avg_complexity}
Detected patterns: {patterns}
Most complex files: {complex_files}

Format as a numbered list. Be concrete, not generic.""",
}


class LLMClient:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER

        if self.provider == "groq":
            try:
                import groq
                self._client = groq.Groq(api_key=settings.GROQ_API_KEY)
                self._model = settings.GROQ_MODEL
            except Exception as e:
                print(f"Groq init failed: {e}. Falling back to mock.")
                self.provider = "mock"

    def generate(self, prompt: str, max_tokens: int = 600) -> str:
        if self.provider == "mock":
            return f"[Mock insight — configure LLM_PROVIDER in .env to enable AI]"

        if self.provider == "groq":
            try:
                resp = self._client.chat.completions.create(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=max_tokens,
                    temperature=0.3,
                )
                return resp.choices[0].message.content
            except Exception as e:
                return f"[Groq error: {e}]"

        if self.provider == "ollama":
            try:
                import httpx
                resp = httpx.post(
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False},
                    timeout=120.0,
                )
                return resp.json()["response"]
            except Exception as e:
                return f"[Ollama error: {e}]"

        return "[No LLM provider configured]"


llm_client = LLMClient()


def generate_all_insights(
    repo_name: str,
    metrics: dict,
    patterns: list,
    top_files: list,
    dependency_summary: str,
) -> dict[str, str]:
    primary_language = (
        max(metrics.get("languages", {}).items(), key=lambda x: x[1])[0]
        if metrics.get("languages")
        else "Unknown"
    )
    complex_files = [
        f.path for f in sorted(top_files, key=lambda x: x.lines_of_code, reverse=True)[:3]
    ]

    results = {}
    for section, template in PROMPTS.items():
        try:
            prompt = template.format(
                repo_name=repo_name,
                total_files=metrics.get("total_files", 0),
                total_loc=metrics.get("total_lines_of_code", 0),
                primary_language=primary_language,
                languages=metrics.get("languages", {}),
                quality_score=metrics.get("quality_score", 0),
                avg_complexity=metrics.get("avg_complexity", 0),
                max_complexity=metrics.get("max_complexity", 0),
                debt_hours=metrics.get("technical_debt_hours", 0),
                top_files=[f.path for f in top_files[:5]],
                dependency_summary=dependency_summary,
                patterns=[p.pattern_name for p in patterns],
                complex_files=complex_files,
            )
            results[section] = llm_client.generate(prompt)
        except Exception as e:
            results[section] = f"Could not generate {section}: {e}"

    return results
