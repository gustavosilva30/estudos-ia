"""Converte o resultado estruturado em Markdown editável.

Informações complementares e limitações ficam em blocos separados e rotulados, para o
usuário sempre distinguir o que veio do seu material do que a IA acrescentou."""

from app.ai.operations import (
    BaseResult,
    LessonPrepResult,
    OcrResult,
    ProblemResult,
    SimplifiedResult,
    SummaryResult,
    TopicsResult,
)

PROBLEM_DISCLAIMER = "> Resolução gerada por IA. Ela pode conter erros: confira os cálculos e o raciocínio antes de usar."


def _display_math(formula: str) -> str:
    """Fórmula do passo em destaque. Aceita LaTeX com ou sem delimitadores $ vindos do modelo."""
    return "$$\n" + formula.strip().strip("$").strip() + "\n$$"


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


def _render_problem(result: ProblemResult) -> str:
    steps = []
    for number, step in enumerate(result.steps, start=1):
        block = f"### {number}. {step.title}\n{step.explanation}"
        if step.formula and step.formula.strip().strip("$").strip():
            block += "\n\n" + _display_math(step.formula)
        steps.append(block)
    sections = [
        PROBLEM_DISCLAIMER,
        f"## Enunciado\n{result.problem_statement}",
        ("## Dados\n" + _bullets(result.given)) if result.given else "",
        ("## O que se pede\n" + _bullets(result.asked)) if result.asked else "",
        "## Resolução passo a passo\n\n" + "\n\n".join(steps),
        f"## Resposta final\n**{result.final_answer}**",
        f"## Verificação\n{result.verification}",
    ]
    return "\n\n".join(section for section in sections if section)


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
    elif isinstance(result, OcrResult):
        body = result.text
    elif isinstance(result, ProblemResult):
        body = _render_problem(result)
    else:  # operação futura sem renderizador próprio
        body = result.model_dump_json(indent=2)
    return _join(f"# {result.title}", body, _footer(result))
