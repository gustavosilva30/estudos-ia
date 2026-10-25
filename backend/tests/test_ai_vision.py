"""Imagem -> texto, resolver problemas, categorias de matéria e modelo forte (sem banco e sem chamadas reais)."""

import base64
import json

import httpx
import pytest

from app.ai.cost import estimate_cost_usd
from app.ai.operations import (
    OPERATIONS,
    OcrResult,
    ProblemResult,
    build_image_user_message,
    build_system_prompt,
    build_user_message,
)
from app.ai.profiles import CATEGORIES, DEFAULT_CATEGORY, get_profile
from app.ai.provider import ImagePart, LLMRequest
from app.ai.providers.fake import FakeProvider
from app.ai.providers.gemini import GeminiProvider
from app.ai.render import PROBLEM_DISCLAIMER, render_markdown
from app.config import Settings

PNG = b"\x89PNG\r\n\x1a\n" + b"fake-image-bytes"


# ---------- categorias e perfis ----------

def test_categorias_cobrem_as_areas_pedidas():
    for wanted in ("matematica", "geografia", "ciencias", "ciencias_humanas", "fisica", "quimica", "historia", "outro"):
        assert wanted in CATEGORIES
    assert all(p.label and p.description for p in CATEGORIES.values())
    assert get_profile(None).id == get_profile("categoria-inexistente").id == DEFAULT_CATEGORY


def test_perfil_muda_o_prompt_de_estudo_sem_afrouxar_as_regras():
    op = OPERATIONS["resumo_completo"]
    historia = build_system_prompt(op, "medio", get_profile("historia"))
    matematica = build_system_prompt(op, "medio", get_profile("matematica"))
    outro = build_system_prompt(op, "medio", get_profile("outro"))
    assert "HISTÓRIA" in historia and "NUNCA invente datas" in historia
    assert "MATEMÁTICA" in matematica and "LaTeX" in matematica
    assert "ÁREA DA MATÉRIA" not in outro
    for prompt in (historia, matematica, outro):  # regras gerais sempre presentes
        assert "NÃO invente" in prompt and "DADO fornecido pelo usuário" in prompt


def test_perfil_muda_o_prompt_de_resolucao():
    op = OPERATIONS["resolver_problema"]
    fisica = build_system_prompt(op, "medio", get_profile("fisica"), has_image=True)
    assert "FÍSICA" in fisica and "unidades" in fisica
    assert "na imagem anexa" in fisica
    texto = build_system_prompt(op, "medio", get_profile("quimica"), has_image=False)
    assert "no texto entre <material_do_usuario>" in texto and "QUÍMICA" in texto


# ---------- prompts de imagem ----------

def test_prompt_de_ocr_exige_fidelidade_e_trata_imagem_como_dado():
    prompt = build_system_prompt(OPERATIONS["ocr_imagem"], "medio", None, has_image=True)
    for must in ("FIELMENTE", "NÃO resuma", "NÃO traduza", "NÃO invente", "[ilegível]", "LaTeX", "DADO fornecido pelo usuário"):
        assert must in prompt, must
    assert "ÁREA DA MATÉRIA" not in prompt  # a transcrição é igual em qualquer área


def test_prompt_de_resolucao_exige_passos_verificacao_e_limites():
    prompt = build_system_prompt(OPERATIONS["resolver_problema"], "medio", get_profile("matematica"), has_image=True)
    for must in ("passo a passo", "NÃO invente dados", "verification", "limitations", "DADO fornecido pelo usuário"):
        assert must in prompt, must


def test_mensagem_que_acompanha_a_imagem_e_fixa():
    ocr = build_image_user_message(OPERATIONS["ocr_imagem"])
    solve = build_image_user_message(OPERATIONS["resolver_problema"])
    assert "Transcreva" in ocr and "Resolva" in solve
    assert "material_do_usuario" not in ocr + solve  # nada digitado pelo usuário entra aqui


def test_operacoes_de_imagem_e_entradas_aceitas():
    assert OPERATIONS["ocr_imagem"].inputs == ("attachment",)
    assert set(OPERATIONS["resolver_problema"].inputs) == {"attachment", "material"}
    assert OPERATIONS["resolver_problema"].tier == "strong"
    assert all(o.inputs == ("material",) and o.tier == "default" for k, o in OPERATIONS.items() if o.kind == "study")


# ---------- provedor de teste ----------

def request_for(op_id, images=(), material=None):
    op = OPERATIONS[op_id]
    return LLMRequest(
        operation=op.id, system=build_system_prompt(op, "medio", None, has_image=bool(images)),
        user=build_user_message(material) if material else build_image_user_message(op),
        json_schema={}, max_output_tokens=1000, timeout_seconds=10, images=tuple(images),
    )


def test_fake_gera_ocr_e_resolucao_validos_para_imagem_e_texto():
    fake = FakeProvider()
    img = (ImagePart("image/png", PNG),)
    ocr = OcrResult.model_validate_json(fake.complete(request_for("ocr_imagem", img)).text)
    assert "$x^2 + 1 = 5$" in ocr.text
    from_image = ProblemResult.model_validate_json(fake.complete(request_for("resolver_problema", img)).text)
    from_text = ProblemResult.model_validate_json(
        fake.complete(request_for("resolver_problema", material="Resolva x + 2 = 5")).text
    )
    assert "Resolva x + 2 = 5" in from_text.problem_statement
    assert len(from_image.steps) >= 1 and from_image.final_answer


def test_render_da_resolucao_tem_aviso_passos_formulas_e_resposta():
    result = ProblemResult.model_validate_json(FakeProvider().complete(request_for("resolver_problema", (ImagePart("image/png", PNG),))).text)
    md = render_markdown(result)
    assert md.startswith("# Problema de teste")
    assert PROBLEM_DISCLAIMER in md
    for section in ("## Enunciado", "## Dados", "## O que se pede", "## Resolução passo a passo", "### 1. Isolar x", "## Resposta final", "## Verificação"):
        assert section in md, section
    assert "$$\nx = 5 - 2\n$$" in md  # fórmula do passo em destaque
    assert "**$x = 3$**" in md


def test_render_de_formula_aceita_delimitadores_vindos_do_modelo():
    result = ProblemResult(
        title="t", problem_statement="p", steps=[{"title": "a", "explanation": "b", "formula": "$$ y = 2 $$"}],
        final_answer="2", verification="v",
    )
    md = render_markdown(result)
    assert "$$\ny = 2\n$$" in md and "$$ $$" not in md
    vazio = ProblemResult(title="t", problem_statement="p", steps=[{"title": "a", "explanation": "b", "formula": " $ $ "}],
                          final_answer="2", verification="v")
    assert "$$" not in render_markdown(vazio)  # fórmula vazia não gera bloco


def test_render_do_ocr_e_o_texto_transcrito_com_limitacoes_separadas():
    result = OcrResult(title="Prova", text="Questão 1: $a+b$", limitations=["Linha 3 borrada."])
    md = render_markdown(result)
    assert md.startswith("# Prova\n\nQuestão 1: $a+b$")
    assert "## Limitações\n- Linha 3 borrada." in md


# ---------- Gemini com imagem ----------

def gemini_with(handler, **kw):
    return GeminiProvider(api_key="k-test", model="gemini-padrao", transport=httpx.MockTransport(handler), **kw)


def interaction(text):
    return {"status": "completed", "model": "gemini-forte", "steps": [{"type": "model_output", "content": [{"type": "text", "text": text}]}],
            "usage": {"total_input_tokens": 1800, "total_tokens": 2000}}


def test_gemini_envia_texto_e_depois_a_imagem_em_base64_com_o_modelo_da_chamada():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=interaction("{}"))

    req = request_for("resolver_problema", (ImagePart("image/png", PNG), ImagePart("image/jpeg", b"jpeg")))
    object.__setattr__(req, "model", "gemini-forte")
    gemini_with(handler).complete(req)

    body = seen["body"]
    assert body["model"] == "gemini-forte"  # modelo da chamada vence o padrão do provedor
    parts = body["input"]
    assert [p["type"] for p in parts] == ["text", "image", "image"]  # texto primeiro
    assert parts[0]["text"] == req.user
    assert parts[1] == {"type": "image", "data": base64.b64encode(PNG).decode(), "mime_type": "image/png"}
    assert parts[2]["mime_type"] == "image/jpeg"
    assert body["store"] is False


def test_gemini_sem_imagem_continua_enviando_so_texto_e_usa_o_modelo_padrao():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=interaction("{}"))

    resp = gemini_with(handler).complete(request_for("resumo_completo", material="Texto."))
    assert isinstance(seen["body"]["input"], str) and seen["body"]["model"] == "gemini-padrao"
    assert resp.model == "gemini-forte"  # o modelo informado na resposta é o que vale


def test_gemini_usa_o_modelo_pedido_quando_a_resposta_nao_informa():
    def handler(request: httpx.Request) -> httpx.Response:
        data = interaction("{}")
        del data["model"]
        return httpx.Response(200, json=data)

    req = request_for("ocr_imagem", (ImagePart("image/png", PNG),))
    object.__setattr__(req, "model", "gemini-pedido")
    assert gemini_with(handler).complete(req).model == "gemini-pedido"


# ---------- custo com modelo forte ----------

def test_custo_do_modelo_forte_usa_preco_proprio_ou_o_padrao():
    base = Settings(app_env="test", ai_price_input_per_mtok=0.30, ai_price_output_per_mtok=2.50)
    assert float(estimate_cost_usd(base, 1_000_000, 1_000_000)) == pytest.approx(2.80)
    assert float(estimate_cost_usd(base, 1_000_000, 1_000_000, strong=True)) == pytest.approx(2.80)  # sem preço próprio

    forte = Settings(
        app_env="test", ai_price_input_per_mtok=0.30, ai_price_output_per_mtok=2.50,
        ai_price_input_per_mtok_strong=0.75, ai_price_output_per_mtok_strong=3.75,
    )
    assert float(estimate_cost_usd(forte, 1_000_000, 1_000_000, strong=True)) == pytest.approx(4.50)
    assert float(estimate_cost_usd(forte, 1_000_000, 1_000_000)) == pytest.approx(2.80)  # modelo padrão não muda
