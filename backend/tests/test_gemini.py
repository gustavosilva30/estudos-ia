"""Provedor Gemini testado com respostas simuladas (httpx.MockTransport): nenhuma chamada real, nenhum custo."""

import json
import logging

import httpx
import pytest

from app.ai import check
from app.ai.operations import OPERATIONS, build_system_prompt, build_user_message
from app.ai.provider import (
    LLMRequest,
    ProviderError,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from app.ai.providers import build_provider
from app.ai.providers.gemini import GeminiProvider, simplify_schema
from app.config import Settings

KEY = "AIza-chave-secreta-de-teste-123"
RESULT = {"title": "Resumo", "sections": [{"heading": "A", "content": "texto"}]}


def make_request(operation="resumo_completo", material="Texto do usuário sobre fotossíntese."):
    op = OPERATIONS[operation]
    return LLMRequest(
        operation=op.id,
        system=build_system_prompt(op, "medio"),
        user=build_user_message(material),
        json_schema=op.result_model.model_json_schema(),
        max_output_tokens=2000,
        timeout_seconds=30,
    )


def interaction(text=None, status="completed", usage=None, model="gemini-3.5-flash-lite"):
    return {
        "id": "int_1",
        "object": "interaction",
        "status": status,
        "model": model,
        "steps": [] if text is None else [
            {"type": "thought", "summary": "pensando"},
            {"type": "model_output", "content": [{"type": "text", "text": text}]},
        ],
        "usage": usage or {"total_input_tokens": 100, "total_output_tokens": 40, "total_thought_tokens": 10, "total_tokens": 150},
    }


def provider_with(handler, **kwargs):
    return GeminiProvider(
        api_key=KEY, model="gemini-3.5-flash-lite", transport=httpx.MockTransport(handler), **kwargs
    )


def ok_handler(payload=None):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=payload or interaction(json.dumps(RESULT)))

    return handler


# ---------- formato do pedido ----------

def test_pedido_segue_a_api_e_nao_expoe_a_chave_na_url_nem_no_corpo():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["headers"] = dict(request.headers)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=interaction(json.dumps(RESULT)))

    req = make_request()
    provider_with(handler, thinking_level="low").complete(req)

    assert seen["url"] == "https://generativelanguage.googleapis.com/v1beta/interactions"
    assert seen["headers"]["x-goog-api-key"] == KEY
    assert KEY not in seen["url"] and KEY not in json.dumps(seen["body"])
    body = seen["body"]
    assert body["model"] == "gemini-3.5-flash-lite"
    assert body["input"] == req.user and body["system_instruction"] == req.system
    assert body["store"] is False  # o Google não guarda a interação
    assert body["generation_config"] == {"max_output_tokens": 2000, "thinking_level": "low"}
    fmt = body["response_format"]
    assert fmt["type"] == "text" and fmt["mime_type"] == "application/json"
    assert "sections" in fmt["schema"]["properties"]


def test_nivel_de_raciocinio_so_e_enviado_quando_configurado():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["config"] = json.loads(request.content)["generation_config"]
        return httpx.Response(200, json=interaction(json.dumps(RESULT)))

    provider_with(handler).complete(make_request())
    assert "thinking_level" not in seen["config"]


@pytest.mark.parametrize("operation", list(OPERATIONS))
def test_schema_enviado_e_simples_para_todas_as_operacoes(operation):
    schema = simplify_schema(OPERATIONS[operation].result_model.model_json_schema())
    text = json.dumps(schema)
    for banned in ('"$ref"', '"$defs"', '"maxItems"', '"minItems"', '"maxLength"', '"minLength"', '"default"'):
        assert banned not in text, banned
    assert schema["type"] == "object" and "title" in schema["properties"]  # campo chamado "title" é mantido
    assert "title" in schema["required"]


def test_schema_resolve_referencias_aninhadas():
    schema = simplify_schema(OPERATIONS["resumo_completo"].result_model.model_json_schema())
    section = schema["properties"]["sections"]["items"]
    assert section["type"] == "object" and set(section["properties"]) == {"heading", "content"}


# ---------- resposta ----------

def test_resposta_valida_e_tokens_cobrados_incluem_raciocinio():
    resp = provider_with(ok_handler()).complete(make_request())
    assert json.loads(resp.text) == RESULT
    assert resp.model == "gemini-3.5-flash-lite"
    assert resp.input_tokens == 100
    assert resp.output_tokens == 50  # total (150) - entrada (100) = saída + raciocínio


def test_tokens_sem_total_somam_saida_e_raciocinio_e_ausencia_vira_none():
    usage = {"total_input_tokens": 10, "total_output_tokens": 5, "total_thought_tokens": 7}
    resp = provider_with(ok_handler(interaction(json.dumps(RESULT), usage=usage))).complete(make_request())
    assert (resp.input_tokens, resp.output_tokens) == (10, 12)
    sem_uso = interaction(json.dumps(RESULT))
    sem_uso["usage"] = {}
    resp = provider_with(ok_handler(sem_uso)).complete(make_request())
    assert resp.input_tokens is None and resp.output_tokens is None  # o serviço estima


def test_status_incompleto_e_erro_sem_repeticao():
    with pytest.raises(ProviderError) as exc:
        provider_with(ok_handler(interaction('{"title":', status="incomplete"))).complete(make_request())
    assert not exc.value.retryable and "incompleta" in str(exc.value)


def test_status_failed_pode_ser_repetido():
    with pytest.raises(ProviderUnavailable):
        provider_with(ok_handler(interaction(None, status="failed"))).complete(make_request())


def test_sem_texto_de_saida_e_erro():
    with pytest.raises(ProviderError, match="não devolveu texto"):
        provider_with(ok_handler(interaction(None))).complete(make_request())


@pytest.mark.parametrize("body", ["não é json", "[1, 2]"])
def test_corpo_inesperado_e_erro(body):
    with pytest.raises(ProviderError):
        provider_with(lambda r: httpx.Response(200, content=body)).complete(make_request())


# ---------- erros HTTP e de rede ----------

@pytest.mark.parametrize(
    ("code", "exc_type", "retryable"),
    [
        (429, ProviderRateLimited, True),
        (503, ProviderRateLimited, True),
        (500, ProviderUnavailable, True),
        (502, ProviderUnavailable, True),
        (504, ProviderUnavailable, True),
        (400, ProviderError, False),
        (401, ProviderError, False),
        (403, ProviderError, False),
        (404, ProviderError, False),
    ],
)
def test_codigos_http_viram_erros_do_provedor(code, exc_type, retryable):
    handler = lambda r: httpx.Response(code, json={"error": {"code": code, "message": "detalhe interno do Google"}})
    with pytest.raises(ProviderError) as exc:
        provider_with(handler).complete(make_request())
    assert type(exc.value) is exc_type
    assert exc.value.retryable is retryable
    assert "detalhe interno" not in str(exc.value)  # a mensagem do Google não vira texto do erro


def test_timeout_vira_provider_timeout():
    def handler(request):
        raise httpx.ReadTimeout("lento", request=request)

    with pytest.raises(ProviderTimeout):
        provider_with(handler).complete(make_request())


def test_falha_de_rede_e_transitoria_e_nao_vaza_a_chave():
    def handler(request):
        raise httpx.ConnectError("sem rota", request=request)

    with pytest.raises(ProviderUnavailable) as exc:
        provider_with(handler).complete(make_request())
    assert exc.value.retryable and KEY not in str(exc.value)


def test_logs_nao_contem_chave_nem_conteudo(caplog):
    handler = lambda r: httpx.Response(400, json={"error": {"message": "API key not valid. Please pass a valid API key."}})
    caplog.set_level(logging.DEBUG)
    with pytest.raises(ProviderError):
        provider_with(handler).complete(make_request(material="SEGREDO-DO-USUARIO-XYZ"))
    assert KEY not in caplog.text and "SEGREDO-DO-USUARIO-XYZ" not in caplog.text
    assert "gemini_http_error status=400" in caplog.text
    assert "API key not valid" in caplog.text  # o motivo do Google fica no log do servidor


# ---------- configuração ----------

def test_gemini_exige_chave_na_partida():
    with pytest.raises(RuntimeError, match="AI_API_KEY"):
        build_provider(Settings(app_env="test", ai_provider="gemini"))
    with pytest.raises(RuntimeError, match="AI_API_KEY"):
        build_provider(Settings(app_env="test", ai_provider="gemini", ai_api_key="   "))


def test_gemini_e_criado_a_partir_das_variaveis():
    s = Settings(app_env="test", ai_provider="gemini", ai_api_key=KEY, ai_model="gemini-3.8-flash", ai_thinking_level="low")
    p = build_provider(s)
    assert p.name == "gemini" and p.model == "gemini-3.8-flash"
    assert KEY not in repr(s)  # SecretStr não aparece em repr/logs


def test_nivel_de_raciocinio_invalido_e_recusado():
    with pytest.raises(ValueError):
        Settings(app_env="test", ai_thinking_level="altissimo")


# ---------- integração com o serviço de geração (cota, falhas, custo) ----------

def test_servico_usa_o_gemini_registra_uso_e_nao_repete_erro_de_configuracao(db):
    from conftest import build_app
    from test_library import User

    app = build_app(db, ai_provider="gemini", ai_api_key=KEY, ai_model="gemini-3.5-flash-lite",
                    ai_retry_backoff_seconds=0, ai_price_input_per_mtok=0.30, ai_price_output_per_mtok=2.50)
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, json=interaction(json.dumps(RESULT)))
        return httpx.Response(401, json={"error": {"message": "chave inválida"}})

    app.state.provider = provider_with(handler)
    ana = User(app, "ana@example.com")
    aula = ana.lesson(ana.subject()["id"], "Aula", content="Conteúdo da aula sobre células.")
    mid = aula["materials"][0]["id"]

    ok = ana.post("/api/v1/ai/generate", {"material_id": mid, "operation": "resumo_completo"})
    assert ok.status_code == 200
    body = ok.json()
    assert body["provider"] == "gemini" and body["input_tokens"] == 100 and body["output_tokens"] == 50
    assert body["estimated_cost_usd"] == pytest.approx(100 * 0.30 / 1e6 + 50 * 2.50 / 1e6, abs=1e-6)

    falha = ana.post("/api/v1/ai/generate", {"material_id": mid, "operation": "topicos_principais"})
    assert falha.status_code == 502
    assert "chave inválida" not in falha.text  # nada do provedor chega ao usuário
    assert calls["n"] == 2  # erro 401 não é repetido


# ---------- comando de diagnóstico ----------

def test_comando_de_diagnostico_ok_e_falha(monkeypatch, capsys):
    monkeypatch.setattr(check, "get_settings", lambda: Settings(app_env="test", ai_provider="fake"))
    assert check.main() == 0
    assert "OK: resposta válida" in capsys.readouterr().out

    monkeypatch.setattr(check, "get_settings", lambda: Settings(app_env="test", ai_provider="gemini"))
    assert check.main() == 1
    assert "AI_API_KEY" in capsys.readouterr().out

    settings = Settings(app_env="test", ai_provider="gemini", ai_api_key=KEY)
    monkeypatch.setattr(check, "get_settings", lambda: settings)
    monkeypatch.setattr(
        check, "build_provider", lambda s: provider_with(lambda r: httpx.Response(403, json={"error": {"message": "x"}}))
    )
    assert check.main() == 1
    out = capsys.readouterr().out
    assert "ERRO ao chamar a IA" in out and KEY not in out


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (httpx.Response(402, json={"error": {"message": "Billing account required"}}), "Billing account required"),
        (httpx.Response(402, json={"error": {"status": "FAILED_PRECONDITION"}}), "FAILED_PRECONDITION"),
        (httpx.Response(402, json={"error": "pagamento pendente"}), "pagamento pendente"),
        (httpx.Response(402, content=b"Payment   Required  "), "Payment Required"),  # corpo que não é JSON
        (httpx.Response(402, json={"error": {"message": ""}}), ""),
    ],
)
def test_detalhe_do_provedor_e_capturado_mesmo_sem_mensagem(response, expected):
    with pytest.raises(ProviderError) as exc:
        provider_with(lambda r: response).complete(make_request())
    assert expected in exc.value.detail
    assert "Gemini HTTP 402" == str(exc.value) and not exc.value.retryable
    assert len(exc.value.detail) <= 200


def test_diagnostico_mostra_o_detalhe_e_nao_a_chave(monkeypatch, capsys):
    settings = Settings(app_env="test", ai_provider="gemini", ai_api_key=KEY)
    monkeypatch.setattr(check, "get_settings", lambda: settings)
    monkeypatch.setattr(
        check, "build_provider",
        lambda s: provider_with(lambda r: httpx.Response(402, json={"error": {"message": "Billing required"}})),
    )
    assert check.main() == 1
    out = capsys.readouterr().out
    assert "Detalhe enviado pelo provedor: Billing required" in out and KEY not in out
