"""Converte o resultado estruturado em Markdown editável.

Informações complementares e limitações ficam em blocos separados e rotulados, para o
usuário sempre distinguir o que veio do seu material do que a IA acrescentou."""

from app.ai.operations import (
    BaseResult,
    LessonPrepResult,
    SimplifiedResult,
    SummaryResult,
    TopicsResult,
)


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items)


def _footer(r: BaseResult) -> str:
    parts = []
    if r.complementary_info:
        parts.append(
            "## Informações complementares (não estão no seu material)\n" + _bullets(r.complementary_info)
        )
    if r.limitations:
        parts.append("## Limitações\n" + _bullets(r.limitations))
    return "\n\n".join(parts)


def _join(*blocks: str) -> str:
    return "\n\n".join(b for b in blocks if b).strip() + "\n"


def render_markdown(result: BaseResult) -> str:
    if isinstance(result, SummaryResult):
        body = "\n\n".join(f"## {s.heading}\n{s.content}" for s in result.sections)
    elif isinstance(result, TopicsResult):
        body = "\n".join(f"- **{t.topic}**: {t.explanation}" for t in result.topics)
    elif isinstance(result, SimplifiedResult):
        terms = ""
        if result.key_terms:
            terms = "## Termos importantes\n" + "\n".join(f"- **{k.term}**: {k.meaning}" for k in result.key_terms)
        body = _join(result.explanation, terms).strip()
    elif isinstance(result, LessonPrepResult):
        vocab = "\n".join(f"- **{k.term}**: {k.meaning}" for k in result.technical_vocabulary)
        body = "\n\n".join(
            b for b in (
                f"## Introdução ao tema\n{result.introduction}",
                "## Conceitos fundamentais\n" + _bullets(result.fundamental_concepts),
                "## Conhecimentos prévios necessários\n" + _bullets(result.prerequisites),
                "## Vocabulário técnico\n" + vocab,
                "## Principais pontos para estudar\n" + _bullets(result.main_points),
                "## Perguntas para reflexão\n" + _bullets(result.reflection_questions),
                "## Dúvidas para levar ao professor\n" + _bullets(result.questions_for_teacher),
                f"## Resumo final para revisão rápida\n{result.final_summary}",
            )
            if b
        )
    else:  # operação futura sem renderizador próprio
        body = result.model_dump_json(indent=2)
    return _join(f"# {result.title}", body, _footer(result))
