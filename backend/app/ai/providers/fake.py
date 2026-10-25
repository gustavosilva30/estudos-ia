"""Provedor falso e determinístico: desenvolvimento e testes sem custo.

Não "entende" o texto: monta respostas válidas a partir das frases do material.
Para testes, `queue` permite programar a próxima resposta (texto) ou falha (exceção).
"""

import json
import re

from app.ai.operations import CLOSE_TAG, OPEN_TAG
from app.ai.provider import LLMRequest, LLMResponse


def _material_from(request: LLMRequest) -> str:
    if OPEN_TAG not in request.user:  # operações sobre imagem: não há texto do usuário
        return ""
    start = request.user.find(OPEN_TAG) + len(OPEN_TAG)
    end = request.user.find(CLOSE_TAG)
    return request.user[start:end].strip()


def _sentences(text: str) -> list[str]:
    parts = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if s.strip()]
    return parts or ["(sem conteúdo)"]


class FakeProvider:
    name = "fake"

    def __init__(self, model: str = "fake-1") -> None:
        self.model = model
        self.calls: list[LLMRequest] = []
        self.queue: list[BaseException | str] = []

    def complete(self, request: LLMRequest) -> LLMResponse:
        self.calls.append(request)
        if self.queue:
            item = self.queue.pop(0)
            if isinstance(item, BaseException):
                raise item
            return LLMResponse(text=item, model=request.model or self.model)
        return LLMResponse(
            text=json.dumps(self._build(request), ensure_ascii=False), model=request.model or self.model
        )

    def _build(self, request: LLMRequest) -> dict:
        op = request.operation
        if op == "ocr_imagem":
            return {
                "title": "Imagem de teste",
                "text": "Texto simulado da imagem (provedor de teste). $x^2 + 1 = 5$",
                "limitations": ["Transcrição simulada pelo provedor de teste (FakeProvider)."],
            }
        if op == "resolver_problema":
            statement = _material_from(request) or "Enunciado simulado da imagem: $x + 2 = 5$."
            return {
                "title": "Problema de teste",
                "problem_statement": statement[:500],
                "given": ["$x + 2 = 5$"],
                "asked": ["O valor de $x$"],
                "steps": [
                    {"title": "Isolar x", "explanation": "Subtraia 2 dos dois lados.", "formula": "x = 5 - 2"},
                    {"title": "Calcular", "explanation": "Faça a subtração.", "formula": "x = 3"},
                ],
                "final_answer": "$x = 3$",
                "verification": "Substituindo: $3 + 2 = 5$.",
                "limitations": ["Resolução simulada pelo provedor de teste (FakeProvider)."],
            }
        s = _sentences(_material_from(request))
        title = s[0][:80]
        base = {"title": title, "limitations": ["Resposta gerada pelo provedor de teste (FakeProvider)."]}
        if op in ("resumo_completo", "resumo_rapido"):
            return {**base, "sections": [{"heading": f"Parte {i + 1}", "content": x} for i, x in enumerate(s[:6])]}
        if op == "topicos_principais":
            return {**base, "topics": [{"topic": x[:60], "explanation": x} for x in s[:8]]}
        if op == "explicacao_simplificada":
            return {
                **base,
                "explanation": " ".join(s[:5]),
                "key_terms": [{"term": x.split()[0], "meaning": x} for x in s[:3]],
            }
        if op == "preparacao_aula":
            return {
                **base,
                "introduction": s[0],
                "fundamental_concepts": s[:4],
                "prerequisites": ["Conhecimentos básicos do tema."],
                "technical_vocabulary": [{"term": x.split()[0], "meaning": x} for x in s[:3]],
                "main_points": s[:5],
                "reflection_questions": [f"Por que isto é importante: {x[:60]}?" for x in s[:3]],
                "questions_for_teacher": ["Quais partes costumam cair em prova?"],
                "final_summary": " ".join(s[:3]),
            }
        raise ValueError(f"FakeProvider não conhece a operação {op!r}")
