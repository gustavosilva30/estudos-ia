"""Categorias de matéria e o "perfil" de IA de cada uma.

A categoria é escolhida pelo usuário ao criar a matéria. Ela muda COMO a IA resume, explica e resolve
(foco, notação, cuidados), nunca o que ela pode inventar: as regras gerais continuam valendo.
Para criar uma categoria nova basta acrescentar uma entrada em CATEGORIES.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SubjectProfile:
    id: str
    label: str
    description: str  # mostrada ao usuário
    study: str  # acrescentado às operações de estudo (resumo, tópicos...); "" = nada
    solve: str  # acrescentado à resolução de problemas


_MATH_NOTATION = "Escreva fórmulas e expressões em LaTeX, entre $...$ (no meio do texto) ou $$...$$ (em destaque)."

CATEGORIES: dict[str, SubjectProfile] = {
    p.id: p
    for p in (
        SubjectProfile(
            "matematica", "Matemática", "Fórmulas, propriedades e resolução passo a passo com conferência.",
            study=(
                "Matéria de MATEMÁTICA. Preserve definições, teoremas, propriedades, condições de validade e exemplos "
                f"resolvidos exatamente como no material. {_MATH_NOTATION} Nunca crie fórmulas que não estejam no material."
            ),
            solve=(
                "Problema de MATEMÁTICA. Resolva passo a passo, mostrando cada transformação algébrica ou cálculo; "
                f"{_MATH_NOTATION} Indique restrições de domínio e liste todas as soluções quando houver mais de uma. "
                "Confira o resultado (substituindo na equação original ou por outro método) e descreva a conferência."
            ),
        ),
        SubjectProfile(
            "fisica", "Física", "Grandezas, unidades, leis e resolução com análise de unidades.",
            study=(
                "Matéria de FÍSICA. Preserve grandezas, símbolos, unidades, leis e relações entre elas como no material. "
                f"{_MATH_NOTATION} Não troque unidades nem invente valores."
            ),
            solve=(
                "Problema de FÍSICA. Liste os dados com unidades, identifique a lei ou fórmula aplicável, resolva "
                f"simbolicamente antes de substituir os números e confira as unidades e a ordem de grandeza. {_MATH_NOTATION}"
            ),
        ),
        SubjectProfile(
            "quimica", "Química", "Reações, estequiometria, unidades e fórmulas químicas.",
            study=(
                "Matéria de QUÍMICA. Preserve fórmulas químicas, equações, estados físicos, unidades e nomenclatura como "
                f"no material. {_MATH_NOTATION} Use notação química correta (ex.: $H_2O$, $CO_2$)."
            ),
            solve=(
                "Problema de QUÍMICA. Escreva e balanceie as equações, converta unidades, use mol e estequiometria quando "
                f"couber, respeite algarismos significativos e confira o resultado. {_MATH_NOTATION}"
            ),
        ),
        SubjectProfile(
            "biologia", "Biologia", "Processos, estruturas, termos técnicos e genética.",
            study=(
                "Matéria de BIOLOGIA. Preserve termos técnicos, nomes de estruturas e organismos e a sequência dos processos. "
                "Organize por conceito (estrutura, função, processo) quando o material permitir."
            ),
            solve=(
                "Problema de BIOLOGIA. Relacione a resposta aos conceitos envolvidos; em genética mostre os genótipos, o "
                "cruzamento e as proporções passo a passo. Justifique cada conclusão."
            ),
        ),
        SubjectProfile(
            "ciencias", "Ciências", "Ciências em geral (ensino fundamental), com linguagem clara.",
            study="Matéria de CIÊNCIAS. Preserve termos e conceitos; prefira frases curtas e exemplos que estejam no material.",
            solve=(
                "Questão de CIÊNCIAS. Explique com linguagem simples e justifique a resposta. "
                f"Se houver cálculo, mostre-o passo a passo. {_MATH_NOTATION}"
            ),
        ),
        SubjectProfile(
            "geografia", "Geografia", "Localização, conceitos, escalas, mapas, gráficos e dados.",
            study=(
                "Matéria de GEOGRAFIA. Preserve nomes de lugares, conceitos, escalas e dados numéricos exatamente como no "
                "material, sem arredondar nem atualizar números."
            ),
            solve=(
                "Questão de GEOGRAFIA. Interprete mapas, gráficos e tabelas descritos no enunciado; faça cálculos de escala, "
                "densidade ou proporção passo a passo quando pedido. Não invente dados que não estejam no enunciado."
            ),
        ),
        SubjectProfile(
            "historia", "História", "Cronologia, personagens, causas e consequências.",
            study=(
                "Matéria de HISTÓRIA. Organize em ordem cronológica quando fizer sentido e destaque personagens, causas e "
                "consequências. NUNCA invente datas, nomes ou fatos: se o material não trouxer a data, diga que não consta."
            ),
            solve=(
                "Questão de HISTÓRIA. Responda com justificativa baseada no enunciado e em fatos históricos amplamente "
                "estabelecidos; se não tiver certeza de uma data ou fato, diga isso em vez de afirmar."
            ),
        ),
        SubjectProfile(
            "ciencias_humanas", "Ciências Humanas", "Filosofia, sociologia e correntes de pensamento.",
            study=(
                "Matéria de CIÊNCIAS HUMANAS (filosofia, sociologia etc.). Preserve autores, correntes e conceitos como no "
                "material e, quando houver, destaque comparações entre eles. Não atribua ideias a autores sem base no material."
            ),
            solve=(
                "Questão de CIÊNCIAS HUMANAS. Responda com argumentação clara baseada no enunciado; não atribua ideias a "
                "autores sem certeza."
            ),
        ),
        SubjectProfile(
            "portugues", "Língua Portuguesa", "Gramática, interpretação de texto e regras com exemplos.",
            study=(
                "Matéria de LÍNGUA PORTUGUESA. Preserve regras gramaticais, nomenclatura e exemplos como no material, "
                "sem corrigir nem alterar os exemplos."
            ),
            solve=(
                "Questão de LÍNGUA PORTUGUESA. Em gramática, aplique a regra e justifique; em interpretação, fundamente a "
                "resposta em trechos do próprio texto da questão."
            ),
        ),
        SubjectProfile(
            "literatura", "Literatura", "Autores, obras e características das escolas literárias.",
            study=(
                "Matéria de LITERATURA. Preserve autores, obras, períodos e características das escolas literárias como no "
                "material. Não invente obras, datas nem citações."
            ),
            solve="Questão de LITERATURA. Fundamente a resposta em trechos do texto da questão e nas características indicadas.",
        ),
        SubjectProfile(
            "linguas_estrangeiras", "Línguas estrangeiras", "Vocabulário, estruturas e exemplos com tradução.",
            study=(
                "Matéria de LÍNGUA ESTRANGEIRA. Preserve vocabulário, estruturas gramaticais e exemplos no idioma original, "
                "com a tradução quando o material trouxer. Não traduza termos que o material mantém no idioma original."
            ),
            solve=(
                "Questão de LÍNGUA ESTRANGEIRA. Responda com a regra aplicada, o exemplo e a tradução; mantenha o idioma "
                "original das frases da questão."
            ),
        ),
        SubjectProfile(
            "programacao", "Programação", "Código, lógica, complexidade e exemplos de execução.",
            study=(
                "Matéria de PROGRAMAÇÃO. Preserve trechos de código, nomes de funções e conceitos exatamente; use blocos de "
                "código Markdown para código."
            ),
            solve=(
                "Problema de PROGRAMAÇÃO. Explique o raciocínio, apresente o código corrigido ou completo em bloco de "
                "código, mostre um exemplo de execução e comente a complexidade quando relevante."
            ),
        ),
        SubjectProfile(
            "outro", "Outra", "Sem ajuste específico: a IA usa as regras gerais.",
            study="", solve="Resolva de forma clara, passo a passo, justificando cada conclusão.",
        ),
    )
}

DEFAULT_CATEGORY = "outro"


def get_profile(category: str | None) -> SubjectProfile:
    return CATEGORIES.get(category or DEFAULT_CATEGORY, CATEGORIES[DEFAULT_CATEGORY])
